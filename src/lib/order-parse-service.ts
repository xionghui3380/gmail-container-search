import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { containerBatchNo } from "@/lib/batch-no";
import {
  deliveryItemToCreateInput,
  parseDeliveryFileBuffer,
  type DeliveryParseResult,
} from "@/lib/delivery-excel-parser";
import {
  downloadAttachmentBuffer,
  getEmailDetail,
  pickBestEmailForParse,
  searchEmailsByContainer,
  type EmailSearchResult,
} from "@/lib/gmail";
import { writeParseLog } from "@/lib/parse-log";
import {
  handleParseDbWriteFailure,
  PARSE_DB_WRITE_FAILURE_MESSAGE,
} from "@/lib/parse-db-error";

export type OrderParseResult = {
  containerId: number;
  batchNo: string;
  containerNo: string;
  parseStatus: string;
  email?: EmailSearchResult;
  attachmentCount: number;
  itemCount: number;
  summaryCount: number;
  warnings: string[];
  errorMessage?: string;
};

type ParseContext = {
  containerId: number;
  containerNo: string;
  batchNo: string;
};

type AttachmentParseResult = {
  itemCount: number;
  warnings: string[];
  summaryCount?: number;
  failed: boolean;
  attachmentName?: string;
};

async function logStep(
  tx: Prisma.TransactionClient | typeof prisma,
  ctx: ParseContext,
  step: string,
  status: "success" | "failed" | "warning",
  message?: string,
  attachmentId?: number,
) {
  await writeParseLog(tx as Prisma.TransactionClient, {
    container_no: ctx.containerNo,
    container_id: ctx.containerId,
    attachment_id: attachmentId ?? null,
    batch_no: ctx.batchNo,
    step,
    status,
    message,
  });
}

function aggregateSummaries(
  items: Array<{ warehouse_code: string | null; carton_count: number | null }>,
) {
  const map = new Map<
    string,
    { warehouse_code: string; total_cartons: number; item_count: number }
  >();
  for (const item of items) {
    if (!item.warehouse_code) continue;
    const key = item.warehouse_code;
    const existing = map.get(key) ?? {
      warehouse_code: key,
      total_cartons: 0,
      item_count: 0,
    };
    existing.total_cartons += item.carton_count ?? 0;
    existing.item_count += 1;
    map.set(key, existing);
  }
  return Array.from(map.values());
}

function toDbFailureContext(ctx: ParseContext) {
  return {
    container_no: ctx.containerNo,
    container_id: ctx.containerId,
    batch_no: ctx.batchNo,
  };
}

/** 下载并解析在事务外完成，避免 25P02 */
async function parseAndPersistAttachment(
  ctx: ParseContext,
  messageId: string,
  attachment: { filename: string; attachmentId: string },
  accessToken: string,
  refreshToken?: string,
): Promise<AttachmentParseResult> {
  let buffer: Buffer;
  try {
    buffer = await downloadAttachmentBuffer(
      messageId,
      attachment.attachmentId,
      accessToken,
      refreshToken,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logStep(prisma, ctx, "download_attachment", "failed", message);
    return { itemCount: 0, warnings: [message], failed: true };
  }

  let parsed: DeliveryParseResult;
  try {
    parsed = await parseDeliveryFileBuffer(buffer, attachment.filename);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logStep(prisma, ctx, "parse_excel", "failed", message);
    return { itemCount: 0, warnings: [message], failed: true };
  }

  if (parsed.items.length === 0) {
    const message = "附件中无有效明细行";
    await logStep(
      prisma,
      ctx,
      "parse_excel",
      "failed",
      parsed.warnings.length > 0 ? parsed.warnings.join("；") : message,
    );
    return { itemCount: 0, warnings: parsed.warnings, failed: true };
  }

  const warnMsg = parsed.warnings.length > 0 ? parsed.warnings.join("；") : null;
  const parseStatus = parsed.warnings.length > 0 ? "partial_success" : "success";

  try {
    await prisma.$transaction(
      async (tx) => {
        const attachmentRow = await tx.attachments.create({
        data: {
          container_id: ctx.containerId,
          container_no: ctx.containerNo,
          batch_no: ctx.batchNo,
          attachment_name: attachment.filename,
          file_content: buffer,
          parse_status: "parsing",
        },
      });

      const containerNos = Array.from(
        new Set(parsed.items.map((i) => i.container_no).filter(Boolean)),
      );
      if (containerNos.length > 0) {
        await tx.delivery_items.updateMany({
          where: { container_no: { in: containerNos }, is_history: false },
          data: { is_history: true },
        });
        await tx.warehouse_summaries.updateMany({
          where: { container_no: { in: containerNos }, is_history: false },
          data: { is_history: true },
        });
      }
      await tx.delivery_items.createMany({
        data: parsed.items.map((item) =>
          deliveryItemToCreateInput(item, {
            attachment_id: attachmentRow.id,
            from_file_id: attachmentRow.id,
            container_id: ctx.containerId,
            batch_no: ctx.batchNo,
          }),
        ),
      });
      await rebuildWarehouseSummaries(tx, containerNos, ctx.batchNo);
      await tx.attachments.update({
        where: { id: attachmentRow.id },
        data: { parse_status: parseStatus, error_message: warnMsg },
      });
    },
    { maxWait: 10000, timeout: 60000 },
  );

    await logStep(
      prisma,
      ctx,
      "parse_excel",
      parsed.warnings.length > 0 ? "warning" : "success",
      `附件 ${attachment.filename} 解析 ${parsed.items.length} 条明细`,
    );

    return {
      itemCount: parsed.items.length,
      warnings: parsed.warnings,
      summaryCount: parsed.summaries.length || aggregateSummaries(parsed.items).length,
      failed: false,
      attachmentName: attachment.filename,
    };
  } catch (err) {
    const message = await handleParseDbWriteFailure(toDbFailureContext(ctx), err);
    return { itemCount: 0, warnings: [message], failed: true };
  }
}

export async function parseOrderFromGmail(
  orderId: number,
  accessToken: string,
  refreshToken?: string,
): Promise<OrderParseResult> {
  const order = await prisma.orders.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");

  const containerNo = order.container_no.trim().toUpperCase();

  const container = await prisma.containers.create({
    data: {
      order_id: order.id,
      container_no: containerNo,
      operation_type: order.operation_type,
      customer: order.customer,
      order_date: order.order_date,
      eta: order.eta,
      pickup_date: order.pickup_date,
      parse_status: "parsing",
    },
  });

  const batchNo = containerBatchNo(container.id);
  await prisma.containers.update({
    where: { id: container.id },
    data: { batch_no: batchNo },
  });

  const ctx: ParseContext = {
    containerId: container.id,
    containerNo,
    batchNo,
  };

  try {
    const emails = await searchEmailsByContainer(
      containerNo,
      undefined,
      accessToken,
      refreshToken,
    );

    if (emails.length === 0) {
      await logStep(prisma, ctx, "search_email", "failed", "未找到相关邮件");
      await prisma.containers.update({
        where: { id: container.id },
        data: {
          parse_status: "failed",
          error_message: "未找到相关邮件，请确认柜号是否正确（已尝试默认发件人及仅柜号搜索）",
        },
      });
      return {
        containerId: container.id,
        batchNo,
        containerNo,
        parseStatus: "failed",
        attachmentCount: 0,
        itemCount: 0,
        summaryCount: 0,
        warnings: [],
        errorMessage: "未找到相关邮件",
      };
    }

    const best = await pickBestEmailForParse(emails, accessToken, refreshToken);
    const detail = await getEmailDetail(best.id, accessToken, refreshToken);

    await logStep(
      prisma,
      ctx,
      "search_email",
      "success",
      `找到 ${emails.length} 封邮件，选用：${detail.subject || detail.id}`,
    );

    const parseableAttachments = detail.attachments.filter((a) => a.isParseable);

    if (parseableAttachments.length === 0) {
      const attachmentNames = detail.attachments.map((a) => a.filename).join(", ");
      await logStep(
        prisma,
        ctx,
        "check_attachment",
        "failed",
        attachmentNames
          ? `邮件附件 ${attachmentNames} 均非 Excel/CSV，无法解析`
          : "邮件中无附件",
      );
      await prisma.containers.update({
        where: { id: container.id },
        data: {
          email_message_id: detail.id,
          email_subject: detail.subject,
          email_from: detail.from,
          email_date: detail.date ? new Date(detail.date) : null,
          parse_status: "failed",
          error_message: "邮件中无 Excel/CSV 附件，无法解析派送明细",
        },
      });
      return {
        containerId: container.id,
        batchNo,
        containerNo,
        parseStatus: "failed",
        email: best,
        attachmentCount: 0,
        itemCount: 0,
        summaryCount: 0,
        warnings: [],
        errorMessage: "邮件中无 Excel/CSV 附件",
      };
    }

    let totalItems = 0;
    let totalSummaries = 0;
    const allWarnings: string[] = [];
    let failedCount = 0;
    const attachmentNames: string[] = [];

    for (const att of parseableAttachments) {
      const result = await parseAndPersistAttachment(
        ctx,
        detail.id,
        att,
        accessToken,
        refreshToken,
      );
      totalItems += result.itemCount;
      allWarnings.push(...result.warnings);
      if (result.failed) failedCount += 1;
      if (result.summaryCount) totalSummaries += result.summaryCount;
      if (result.attachmentName) attachmentNames.push(result.attachmentName);
    }

    const parseStatus =
      failedCount === parseableAttachments.length
        ? "failed"
        : failedCount > 0 || allWarnings.length > 0
          ? "partial_success"
          : "success";

    const errorMessage =
      parseStatus === "failed"
        ? allWarnings.find((w) => w.startsWith(PARSE_DB_WRITE_FAILURE_MESSAGE)) ??
          allWarnings[0] ??
          "所有附件解析失败"
        : allWarnings.length > 0
          ? allWarnings.slice(0, 3).join("；")
          : null;

    await prisma.containers.update({
      where: { id: container.id },
      data: {
        email_message_id: detail.id,
        email_subject: detail.subject,
        email_from: detail.from,
        email_date: detail.date ? new Date(detail.date) : null,
        attachment_name: attachmentNames.join(", ") || parseableAttachments[0]?.filename,
        parse_status: parseStatus,
        error_message: errorMessage,
      },
    });

    await logStep(
      prisma,
      ctx,
      "save_database",
      parseStatus === "failed" ? "failed" : "success",
      `解析完成：${totalItems} 条明细，${parseableAttachments.length} 个附件`,
    );

    return {
      containerId: container.id,
      batchNo,
      containerNo,
      parseStatus,
      email: best,
      attachmentCount: parseableAttachments.length,
      itemCount: totalItems,
      summaryCount: totalSummaries,
      warnings: allWarnings,
      errorMessage: errorMessage ?? undefined,
    };
  } catch (err) {
    const message = await handleParseDbWriteFailure(toDbFailureContext(ctx), err, {
      updateContainer: true,
    });
    throw new Error(message);
  }
}

export async function reparseContainerFromGmail(
  containerId: number,
  accessToken: string,
  refreshToken?: string,
) {
  const existing = await prisma.containers.findUnique({ where: { id: containerId } });
  if (!existing) throw new Error("解析记录不存在");
  return parseOrderFromGmail(existing.order_id, accessToken, refreshToken);
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
    _sum: { carton_count: true },
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
