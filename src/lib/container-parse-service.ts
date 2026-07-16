import type { parse_status, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildContainerCreateInput, buildContainerUpdateInput } from "@/lib/container-mapper";
import {
  setCargoParseFailed,
  setCargoParsing,
  updateCargoParseFields,
  type CargoParseFields,
} from "@/lib/cargo-parse-fields";
import { upsertCargoFromGoogleSheet } from "@/lib/cargo-sync";
import {
  deliveryItemToCreateInput,
  parseDeliveryExcelBuffer,
  type DeliveryParseResult,
} from "@/lib/delivery-excel-parser";
import {
  downloadAttachmentBuffer,
  getEmailDetail,
  pickBestEmailForParse,
  searchEmailsByContainer,
  type EmailSearchResult,
} from "@/lib/gmail";
import { parseOrderSheetBuffer, type OrderSheetRow } from "@/lib/order-sheet-import";
import { containerBatchNo } from "@/lib/batch-no";
import {
  alertParseFailure,
  handleParseDbWriteFailure,
  PARSE_DB_WRITE_FAILURE_MESSAGE,
} from "@/lib/parse-db-error";
import { assertContainerNotParsing } from "@/lib/parse-lock";
import { safeWriteParseLog } from "@/lib/parse-log";
import { containerCreateSchema } from "@/lib/validators";

type ParseEmailResult = {
  containerNo: string;
  parseStatus: parse_status;
  email?: EmailSearchResult;
  itemCount: number;
  summaryCount: number;
  summaries: Array<{
    warehouse_code: string;
    total_cartons: number;
    item_count: number;
  }>;
  warnings: string[];
  errorMessage?: string;
};

type EmailMeta = {
  messageId: string;
  subject?: string;
  from?: string;
  date?: string | null;
  attachmentName: string;
};

/** 业务事务内只写业务表，不写 parse_logs */
async function persistDeliveryBusinessData(
  tx: Prisma.TransactionClient,
  containerId: number,
  normalizedNo: string,
  parsed: DeliveryParseResult,
  emailMeta: EmailMeta,
  parseStatus: parse_status,
) {
  await tx.delivery_items.updateMany({
    where: { container_no: normalizedNo, is_history: false },
    data: { is_history: true },
  });
  await tx.warehouse_summaries.updateMany({
    where: { container_no: normalizedNo, is_history: false },
    data: { is_history: true },
  });

  const batchNo = containerBatchNo(containerId);

  await tx.delivery_items.createMany({
    data: parsed.items.map((item) =>
      deliveryItemToCreateInput(item, {
        container_id: containerId,
        batch_no: batchNo,
      }),
    ),
  });

  await rebuildWarehouseSummaries(tx, [normalizedNo], batchNo);

  await updateCargoParseFields(tx, normalizedNo, {
    parse_status: parseStatus,
    error_message: parsed.warnings.length > 0 ? parsed.warnings.join("；") : null,
    email_message_id: emailMeta.messageId,
    email_subject: emailMeta.subject ?? null,
    email_from: emailMeta.from ?? null,
    email_date: emailMeta.date ? new Date(emailMeta.date) : null,
  });

  return batchNo;
}

async function writeParseLogsAfterSuccess(
  normalizedNo: string,
  containerId: number,
  batchNo: string,
  parsed: DeliveryParseResult,
  searchLogMessage?: string,
  extraLogs?: Array<{ step: string; status: "success" | "failed" | "warning"; message: string }>,
) {
  if (searchLogMessage) {
    await safeWriteParseLog({
      container_no: normalizedNo,
      container_id: containerId,
      batch_no: batchNo,
      step: "search_email",
      status: "success",
      message: searchLogMessage,
    });
  }

  for (const log of extraLogs ?? []) {
    await safeWriteParseLog({
      container_no: normalizedNo,
      container_id: containerId,
      batch_no: batchNo,
      step: log.step,
      status: log.status,
      message: log.message,
    });
  }

  await safeWriteParseLog({
    container_no: normalizedNo,
    container_id: containerId,
    batch_no: batchNo,
    step: "parse_excel",
    status: parsed.warnings.length > 0 ? "warning" : "success",
    message: `解析 ${parsed.items.length} 条明细，表头第 ${parsed.headerRow} 行`,
  });

  await safeWriteParseLog({
    container_no: normalizedNo,
    container_id: containerId,
    batch_no: batchNo,
    step: "save_database",
    status: "success",
    message: "数据入库完成",
  });
}

async function saveParsedDeliveryDataInTransaction(
  containerId: number,
  normalizedNo: string,
  parsed: DeliveryParseResult,
  emailMeta: EmailMeta,
  parseStatus: parse_status,
  searchLogMessage?: string,
  extraLogs?: Array<{ step: string; status: "success" | "failed" | "warning"; message: string }>,
) {
  const batchNo = containerBatchNo(containerId);
  try {
    await prisma.$transaction(
      async (tx) => {
        await persistDeliveryBusinessData(
          tx,
          containerId,
          normalizedNo,
          parsed,
          emailMeta,
          parseStatus,
        );
      },
      { maxWait: 10000, timeout: 60000 },
    );

    await writeParseLogsAfterSuccess(
      normalizedNo,
      containerId,
      batchNo,
      parsed,
      searchLogMessage,
      extraLogs,
    );
  } catch (err) {
    const message = await handleParseDbWriteFailure(
      {
        container_no: normalizedNo,
        container_id: containerId,
        batch_no: batchNo,
        email_message_id: emailMeta.messageId,
        attachment_name: emailMeta.attachmentName,
      },
      err,
    );
    throw new Error(message);
  }
}

async function recordCargoParseFailure(
  normalizedNo: string,
  containerId: number | undefined,
  step: string,
  message: string,
  extra?: CargoParseFields,
) {
  const ok = await safeWriteParseLog({
    container_no: normalizedNo,
    container_id: containerId ?? null,
    step,
    status: "failed",
    message,
  });
  if (!ok) {
    alertParseFailure({
      kind: "cargo_parse_log_failed",
      container_no: normalizedNo,
      step,
      message,
    });
  }

  try {
    await setCargoParseFailed(prisma, normalizedNo, message, extra);
  } catch (updateErr) {
    alertParseFailure({
      kind: "cargo_status_update_failed",
      container_no: normalizedNo,
      step,
      message,
      updateErr: String(updateErr),
    });
  }
}

async function handleParsePipelineFailure(
  normalizedNo: string,
  containerId: number | undefined,
  err: unknown,
  emailMeta?: Partial<EmailMeta>,
): Promise<never> {
  const message = err instanceof Error ? err.message : String(err);
  const isDbFailure = message.startsWith(PARSE_DB_WRITE_FAILURE_MESSAGE);

  if (!isDbFailure) {
    const ok = await safeWriteParseLog({
      container_no: normalizedNo,
      container_id: containerId ?? null,
      step: "parse_pipeline",
      status: "failed",
      message,
    });
    if (!ok) {
      alertParseFailure({
        kind: "pipeline_log_failed",
        container_no: normalizedNo,
        message,
      });
    }
  }

  try {
    await setCargoParseFailed(prisma, normalizedNo, message, {
      email_message_id: emailMeta?.messageId ?? null,
      email_subject: emailMeta?.subject ?? null,
      email_from: emailMeta?.from ?? null,
      email_date: emailMeta?.date ? new Date(emailMeta.date) : null,
    });
  } catch (updateErr) {
    alertParseFailure({
      kind: "pipeline_status_update_failed",
      container_no: normalizedNo,
      message,
      updateErr: String(updateErr),
    });
  }

  throw err;
}

export async function importOrderSheetRows(
  rows: OrderSheetRow[],
  userId: bigint,
  upsert = true,
) {
  let created = 0;
  let updated = 0;
  const errors: Array<{ containerNo: string; message: string }> = [];

  const maxSort = await prisma.google_sheet.aggregate({
    where: { deleted_at: null },
    _max: { sort: true },
  });
  let nextSort = (maxSort._max.sort ?? BigInt(0)) + BigInt(1);

  for (const row of rows) {
    const { rowNumber, ...payload } = row;
    void rowNumber;
    const parsed = containerCreateSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push({
        containerNo: row.container_no,
        message: parsed.error.issues[0]?.message ?? "校验失败",
      });
      continue;
    }

    try {
      const existing = await prisma.google_sheet.findFirst({
        where: { container_no: parsed.data.container_no },
      });

      if (existing) {
        if (!upsert) continue;
        const updateData = buildContainerUpdateInput(parsed.data, userId);
        updateData.deleted_at = null;
        updateData.users_google_sheet_deleted_byTousers = { disconnect: true };
        await prisma.google_sheet.update({
          where: { id: existing.id },
          data: updateData,
        });
        updated += 1;
      } else {
        await prisma.google_sheet.create({
          data: {
            ...buildContainerCreateInput(parsed.data, userId),
            sort: nextSort,
          },
        });
        nextSort += BigInt(1);
        created += 1;
      }
    } catch (err) {
      errors.push({
        containerNo: row.container_no,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { created, updated, errors };
}

async function findCargoContainer(normalizedNo: string) {
  const existing = await prisma.containers.findFirst({
    where: { container_no: normalizedNo },
    orderBy: { id: "desc" },
  });
  if (existing) return existing;

  const sheet = await prisma.google_sheet.findFirst({
    where: { container_no: normalizedNo, deleted_at: null },
  });
  if (!sheet) return null;

  return upsertCargoFromGoogleSheet(sheet);
}

export async function importOrderSheetBuffer(buffer: Buffer, userId: bigint) {
  const parsed = await parseOrderSheetBuffer(buffer);
  const persist = await importOrderSheetRows(parsed.rows, userId, true);
  return {
    total: parsed.total,
    imported: parsed.imported,
    skipped: parsed.skipped,
    created: persist.created,
    updated: persist.updated,
    parseErrors: parsed.errors,
    persistErrors: persist.errors,
  };
}

export async function parseContainerEmail(
  containerNo: string,
  userId: bigint,
  accessToken: string,
  refreshToken?: string,
): Promise<ParseEmailResult> {
  const normalizedNo = containerNo.trim().toUpperCase();
  void userId;

  const container = await findCargoContainer(normalizedNo);
  if (!container) {
    throw new Error(`柜号 ${normalizedNo} 不存在，请先在 google_sheet 录入订单`);
  }

  await assertContainerNotParsing(normalizedNo);
  await setCargoParsing(normalizedNo);

  let buffer: Buffer | null = null;
  try {
    const emails = await searchEmailsByContainer(
      normalizedNo,
      undefined,
      accessToken,
      refreshToken,
    );

    if (emails.length === 0) {
      await recordCargoParseFailure(normalizedNo, container.id, "search_email", "未找到相关邮件");
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        itemCount: 0,
        summaryCount: 0,
        summaries: [],
        warnings: [],
        errorMessage: "未找到相关邮件",
      };
    }

    const best = await pickBestEmailForParse(emails, accessToken, refreshToken);
    const detail = await getEmailDetail(best.id, accessToken, refreshToken);
    const excelAttachment = detail.attachments.find((a) => a.isExcel);

    if (!excelAttachment) {
      await recordCargoParseFailure(normalizedNo, container.id, "download_attachment", "邮件无 Excel 附件", {
        email_message_id: detail.id,
        email_subject: detail.subject,
        email_from: detail.from,
        email_date: detail.date ? new Date(detail.date) : null,
      });
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        email: best,
        itemCount: 0,
        summaryCount: 0,
        summaries: [],
        warnings: [],
        errorMessage: "邮件无 Excel 附件",
      };
    }

    buffer = await downloadAttachmentBuffer(
      best.id,
      excelAttachment.attachmentId,
      accessToken,
      refreshToken,
    );
    const parsed = await parseDeliveryExcelBuffer(buffer);

    if (parsed.items.length === 0) {
      await recordCargoParseFailure(normalizedNo, container.id, "parse_excel", "附件中无有效明细行");
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        email: best,
        itemCount: 0,
        summaryCount: 0,
        summaries: [],
        warnings: parsed.warnings,
        errorMessage: "附件中无有效明细行",
      };
    }

    const parseStatus: parse_status =
      parsed.warnings.length > 0 ? "partial_success" : "success";

    const emailMeta: EmailMeta = {
      messageId: detail.id,
      subject: detail.subject,
      from: detail.from,
      date: detail.date,
      attachmentName: excelAttachment.filename,
    };

    await saveParsedDeliveryDataInTransaction(
      container.id,
      normalizedNo,
      parsed,
      emailMeta,
      parseStatus,
      `找到 ${emails.length} 封邮件，选用 ${best.subject || best.id}`,
    );

    return {
      containerNo: normalizedNo,
      parseStatus,
      email: best,
      itemCount: parsed.items.length,
      summaryCount: parsed.summaries.length,
      summaries: parsed.summaries,
      warnings: parsed.warnings,
    };
  } catch (err) {
    return handleParsePipelineFailure(normalizedNo, container.id, err);
  } finally {
    buffer = null;
  }
}

/** 用户从邮件列表选中指定附件：下载 → 解析 → 入库 → 汇总 */
export async function parseContainerAttachment(
  containerNo: string,
  messageId: string,
  attachmentId: string,
  attachmentName: string,
  userId: bigint,
  accessToken: string,
  refreshToken?: string,
): Promise<ParseEmailResult> {
  const normalizedNo = containerNo.trim().toUpperCase();
  void userId;

  const container = await findCargoContainer(normalizedNo);
  if (!container) {
    throw new Error(`柜号 ${normalizedNo} 不存在，请先在 google_sheet 录入订单`);
  }

  await assertContainerNotParsing(normalizedNo);
  await setCargoParsing(normalizedNo);

  let buffer: Buffer | null = null;
  try {
    const detail = await getEmailDetail(messageId, accessToken, refreshToken);
    const attachment = detail.attachments.find(
      (a) => a.attachmentId === attachmentId || a.filename === attachmentName,
    );

    if (!attachment?.isExcel) {
      await recordCargoParseFailure(normalizedNo, container.id, "download_attachment", "未找到 Excel 附件");
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        itemCount: 0,
        summaryCount: 0,
        summaries: [],
        warnings: [],
        errorMessage: "未找到 Excel 附件",
      };
    }

    buffer = await downloadAttachmentBuffer(
      messageId,
      attachment.attachmentId,
      accessToken,
      refreshToken,
    );
    const parsed = await parseDeliveryExcelBuffer(buffer);

    if (parsed.items.length === 0) {
      await recordCargoParseFailure(normalizedNo, container.id, "parse_excel", "附件中无有效明细行");
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        itemCount: 0,
        summaryCount: 0,
        summaries: [],
        warnings: parsed.warnings,
        errorMessage: "附件中无有效明细行",
      };
    }

    const parseStatus: parse_status =
      parsed.warnings.length > 0 ? "partial_success" : "success";

    await saveParsedDeliveryDataInTransaction(
      container.id,
      normalizedNo,
      parsed,
      {
        messageId: detail.id,
        subject: detail.subject,
        from: detail.from,
        date: detail.date,
        attachmentName: attachment.filename,
      },
      parseStatus,
      `手动选择邮件：${detail.subject || detail.id}，附件 ${attachment.filename}`,
    );

    return {
      containerNo: normalizedNo,
      parseStatus,
      itemCount: parsed.items.length,
      summaryCount: parsed.summaries.length,
      summaries: parsed.summaries,
      warnings: parsed.warnings,
    };
  } catch (err) {
    return handleParsePipelineFailure(normalizedNo, container.id, err, {
      messageId,
      attachmentName,
    });
  } finally {
    buffer = null;
  }
}

/** 本地上传派送表 Excel：解析 → 入库 → 汇总（无需 Gmail） */
export async function parseContainerUploadBuffer(
  containerNo: string,
  buffer: Buffer,
  fileName: string,
  userId: bigint,
): Promise<ParseEmailResult> {
  const normalizedNo = containerNo.trim().toUpperCase();
  void userId;

  const container = await findCargoContainer(normalizedNo);
  if (!container) {
    throw new Error(`柜号 ${normalizedNo} 不存在，请先在 google_sheet 录入订单`);
  }

  await assertContainerNotParsing(normalizedNo);
  await setCargoParsing(normalizedNo);

  try {
    const parsed = await parseDeliveryExcelBuffer(buffer);

    if (parsed.items.length === 0) {
      await recordCargoParseFailure(normalizedNo, container.id, "parse_excel", "附件中无有效明细行");
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        itemCount: 0,
        summaryCount: 0,
        summaries: [],
        warnings: parsed.warnings,
        errorMessage: "附件中无有效明细行",
      };
    }

    const parseStatus: parse_status =
      parsed.warnings.length > 0 ? "partial_success" : "success";

    await saveParsedDeliveryDataInTransaction(
      container.id,
      normalizedNo,
      parsed,
      {
        messageId: `upload:${Date.now()}`,
        subject: `本地上传：${fileName}`,
        from: "local-upload",
        date: new Date().toISOString(),
        attachmentName: fileName,
      },
      parseStatus,
      undefined,
      [{ step: "upload_attachment", status: "success", message: `本地上传文件：${fileName}` }],
    );

    return {
      containerNo: normalizedNo,
      parseStatus,
      itemCount: parsed.items.length,
      summaryCount: parsed.summaries.length,
      summaries: parsed.summaries,
      warnings: parsed.warnings,
    };
  } catch (err) {
    return handleParsePipelineFailure(normalizedNo, container.id, err, {
      subject: `本地上传：${fileName}`,
      attachmentName: fileName,
    });
  }
}

export async function getContainerParseResult(containerNo: string) {
  const normalizedNo = containerNo.trim().toUpperCase();
  const container = await prisma.containers.findFirst({
    where: { container_no: normalizedNo },
    orderBy: { id: "desc" },
  });
  if (!container) return null;

  const warehouse_summaries = await prisma.warehouse_summaries.findMany({
    where: { container_no: normalizedNo, is_history: false },
    orderBy: { warehouse_code: "asc" },
  });

  return { ...container, warehouse_summaries };
}

async function rebuildWarehouseSummaries(
  tx: Prisma.TransactionClient,
  containerNos: string[],
  batchNo?: string,
) {
  const where = containerNos.length > 0
    ? { container_no: { in: containerNos }, is_history: false }
    : { container_no: "", is_history: false };

  const grouped = await tx.delivery_items.groupBy({
    by: ["container_no", "warehouse_code"],
    where,
    _count: { id: true },
    _sum: { carton_count: true, weight: true, cbm: true },
  });

  if (grouped.length > 0) {
    await tx.warehouse_summaries.createMany({
      data: grouped.map((row) => ({
        container_no: row.container_no ?? "",
        warehouse_code: row.warehouse_code ?? "",
        total_cartons: row._sum.carton_count ?? 0,
        item_count: row._count.id,
        batch_no: batchNo ?? null,
        is_history: false,
      })),
    });
  }
}
