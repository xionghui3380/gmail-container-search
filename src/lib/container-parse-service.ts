import type { parse_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildContainerCreateInput, buildContainerUpdateInput } from "@/lib/container-mapper";
import {
  deliveryItemToCreateInput,
  parseDeliveryExcelBuffer,
} from "@/lib/delivery-excel-parser";
import {
  downloadAttachmentBuffer,
  getEmailDetail,
  pickBestEmailForParse,
  searchEmailsByContainer,
  type EmailSearchResult,
} from "@/lib/gmail";
import { parseOrderSheetBuffer, type OrderSheetRow } from "@/lib/order-sheet-import";
import { writeParseLog } from "@/lib/parse-log";
import { containerCreateSchema } from "@/lib/validators";

export type ParseEmailResult = {
  containerNo: string;
  parseStatus: parse_status;
  email?: EmailSearchResult;
  itemCount: number;
  summaryCount: number;
  warnings: string[];
  errorMessage?: string;
};

export async function importOrderSheetRows(
  rows: OrderSheetRow[],
  userId: bigint,
  upsert = true,
) {
  let created = 0;
  let updated = 0;
  const errors: Array<{ containerNo: string; message: string }> = [];

  const maxSort = await prisma.containers.aggregate({
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
      const existing = await prisma.containers.findFirst({
        where: { container_no: parsed.data.container_no },
      });

      if (existing) {
        if (!upsert) continue;
        const updateData = buildContainerUpdateInput(parsed.data, userId);
        updateData.deleted_at = null;
        updateData.users_containers_deleted_byTousers = { disconnect: true };
        await prisma.containers.update({
          where: { id: existing.id },
          data: updateData,
        });
        updated += 1;
      } else {
        await prisma.containers.create({
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

export async function importOrderSheetBuffer(buffer: Buffer, userId: bigint) {
  const parsed = await parseOrderSheetBuffer(buffer);
  const persist = await importOrderSheetRows(parsed.rows, userId, true);
  return { ...parsed, ...persist };
}

export async function parseContainerEmail(
  containerNo: string,
  userId: bigint,
  accessToken: string,
  refreshToken?: string,
): Promise<ParseEmailResult> {
  const normalizedNo = containerNo.trim().toUpperCase();

  const container = await prisma.containers.findFirst({
    where: { container_no: normalizedNo, deleted_at: null },
  });
  if (!container) {
    throw new Error(`柜号 ${normalizedNo} 不存在，请先导入订单表`);
  }

  await prisma.containers.update({
    where: { id: container.id },
    data: { parse_status: "parsing", error_message: null },
  });

  try {
    const emails = await searchEmailsByContainer(
      normalizedNo,
      undefined,
      accessToken,
      refreshToken,
    );

    if (emails.length === 0) {
      await prisma.$transaction(async (tx) => {
        await writeParseLog(tx, normalizedNo, "search_email", "failed", "未找到相关邮件");
        await tx.containers.update({
          where: { id: container.id },
          data: {
            parse_status: "failed",
            error_message: "未找到相关邮件",
            is_correct: false,
          },
        });
      });
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        itemCount: 0,
        summaryCount: 0,
        warnings: [],
        errorMessage: "未找到相关邮件",
      };
    }

    const best = await pickBestEmailForParse(emails, accessToken, refreshToken);
    const detail = await getEmailDetail(best.id, accessToken, refreshToken);
    const excelAttachment = detail.attachments.find((a) => a.isExcel);

    if (!excelAttachment) {
      await prisma.$transaction(async (tx) => {
        await writeParseLog(tx, normalizedNo, "download_attachment", "failed", "邮件无 Excel 附件");
        await tx.containers.update({
          where: { id: container.id },
          data: {
            parse_status: "failed",
            error_message: "邮件无 Excel 附件",
            email_message_id: detail.id,
            email_subject: detail.subject,
            email_from: detail.from,
            email_date: detail.date ? new Date(detail.date) : null,
            is_correct: false,
          },
        });
      });
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        email: best,
        itemCount: 0,
        summaryCount: 0,
        warnings: [],
        errorMessage: "邮件无 Excel 附件",
      };
    }

    const buffer = await downloadAttachmentBuffer(
      best.id,
      excelAttachment.attachmentId,
      accessToken,
      refreshToken,
    );
    const parsed = await parseDeliveryExcelBuffer(buffer, normalizedNo);

    if (parsed.items.length === 0) {
      await prisma.$transaction(async (tx) => {
        await writeParseLog(tx, normalizedNo, "parse_excel", "failed", "附件中无有效明细行");
        await tx.containers.update({
          where: { id: container.id },
          data: {
            parse_status: "failed",
            error_message: "附件中无有效明细行",
            attachment_name: excelAttachment.filename,
            is_correct: false,
          },
        });
      });
      return {
        containerNo: normalizedNo,
        parseStatus: "failed",
        email: best,
        itemCount: 0,
        summaryCount: 0,
        warnings: parsed.warnings,
        errorMessage: "附件中无有效明细行",
      };
    }

    const parseStatus: parse_status =
      parsed.warnings.length > 0 ? "partial_success" : "success";

    await prisma.$transaction(async (tx) => {
      await writeParseLog(
        tx,
        normalizedNo,
        "search_email",
        "success",
        `找到 ${emails.length} 封邮件，选用 ${best.subject || best.id}`,
      );
      await writeParseLog(
        tx,
        normalizedNo,
        "parse_excel",
        parsed.warnings.length > 0 ? "warning" : "success",
        `解析 ${parsed.items.length} 条明细，表头第 ${parsed.headerRow} 行`,
      );

      await tx.delivery_items.deleteMany({ where: { container_no: normalizedNo } });
      await tx.warehouse_summaries.deleteMany({ where: { container_no: normalizedNo } });

      await tx.delivery_items.createMany({
        data: parsed.items.map(deliveryItemToCreateInput),
      });

      for (const summary of parsed.summaries) {
        await tx.warehouse_summaries.create({
          data: {
            container_no: normalizedNo,
            warehouse_code: summary.warehouse_code,
            total_cartons: summary.total_cartons,
            item_count: summary.item_count,
          },
        });
      }

      await tx.containers.update({
        where: { id: container.id },
        data: {
          parse_status: parseStatus,
          error_message: parsed.warnings.length > 0 ? parsed.warnings.join("；") : null,
          email_message_id: detail.id,
          email_subject: detail.subject,
          email_from: detail.from,
          email_date: detail.date ? new Date(detail.date) : null,
          attachment_name: excelAttachment.filename,
          is_correct: true,
          users_containers_updated_byTousers: { connect: { id: userId } },
        },
      });

      await writeParseLog(tx, normalizedNo, "save_database", "success", "数据入库完成");
    });

    return {
      containerNo: normalizedNo,
      parseStatus,
      email: best,
      itemCount: parsed.items.length,
      summaryCount: parsed.summaries.length,
      warnings: parsed.warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.$transaction(async (tx) => {
      await writeParseLog(tx, normalizedNo, "parse_pipeline", "failed", message);
      await tx.containers.update({
        where: { id: container.id },
        data: { parse_status: "failed", error_message: message, is_correct: false },
      });
    });
    throw err;
  }
}

export async function getContainerParseResult(containerNo: string) {
  const normalizedNo = containerNo.trim().toUpperCase();
  const container = await prisma.containers.findFirst({
    where: { container_no: normalizedNo, deleted_at: null },
    include: {
      warehouse_summaries: { orderBy: { warehouse_code: "asc" } },
    },
  });
  if (!container) return null;
  return container;
}
