import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateBatchNo } from "@/lib/batch-no";
import {
  deliveryItemToCreateInput,
  parseDeliveryFileBuffer,
} from "@/lib/delivery-excel-parser";
import {
  downloadAttachmentBuffer,
  getEmailDetail,
  pickBestEmailForParse,
  searchEmailsByContainer,
  type EmailSearchResult,
} from "@/lib/gmail";
import { writeParseLog } from "@/lib/parse-log";

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

async function logStep(
  tx: Prisma.TransactionClient,
  ctx: ParseContext,
  step: string,
  status: "success" | "failed" | "warning",
  message?: string,
  attachmentId?: number,
) {
  await writeParseLog(tx, {
    container_no: ctx.containerNo,
    container_id: ctx.containerId,
    attachment_id: attachmentId ?? null,
    batch_no: ctx.batchNo,
    step,
    status,
    message,
  });
}

async function saveWarehouseSummaries(
  tx: Prisma.TransactionClient,
  ctx: ParseContext,
  summaries: Array<{ warehouse_code: string; total_cartons: number; item_count: number }>,
) {
  for (const summary of summaries) {
    await tx.warehouse_summaries.upsert({
      where: {
        container_no_warehouse_code_batch_no: {
          container_no: ctx.containerNo,
          warehouse_code: summary.warehouse_code,
          batch_no: ctx.batchNo,
        },
      },
      create: {
        container_no: ctx.containerNo,
        batch_no: ctx.batchNo,
        warehouse_code: summary.warehouse_code,
        total_cartons: summary.total_cartons,
        item_count: summary.item_count,
      },
      update: {
        total_cartons: summary.total_cartons,
        item_count: summary.item_count,
        updated_at: new Date(),
      },
    });
  }
}

function aggregateSummaries(
  items: Array<{ warehouse_code: string | null; carton_count: number | null }>,
) {
  const map = new Map<string, { warehouse_code: string; total_cartons: number; item_count: number }>();
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

async function parseExcelAttachment(
  tx: Prisma.TransactionClient,
  ctx: ParseContext,
  messageId: string,
  attachment: { filename: string; attachmentId: string },
  accessToken: string,
  refreshToken?: string,
) {
  const attachmentRow = await tx.attachments.create({
    data: {
      container_id: ctx.containerId,
      container_no: ctx.containerNo,
      batch_no: ctx.batchNo,
      attachment_name: attachment.filename,
      parse_status: "parsing",
    },
  });

  try {
    const buffer = await downloadAttachmentBuffer(
      messageId,
      attachment.attachmentId,
      accessToken,
      refreshToken,
    );
    const parsed = await parseDeliveryFileBuffer(buffer, attachment.filename, ctx.containerNo);

    if (parsed.items.length === 0) {
      await tx.attachments.update({
        where: { id: attachmentRow.id },
        data: {
          parse_status: "failed",
          error_message: "附件中无有效明细行",
        },
      });
      await logStep(
        tx,
        ctx,
        "parse_excel",
        "failed",
        `附件 ${attachment.filename} 无有效明细行`,
        attachmentRow.id,
      );
      return { itemCount: 0, warnings: parsed.warnings, failed: true };
    }

    await tx.delivery_items.createMany({
      data: parsed.items.map((item) =>
        deliveryItemToCreateInput(
          { ...item, container_no: ctx.containerNo },
          {
            attachment_id: attachmentRow.id,
            container_id: ctx.containerId,
            batch_no: ctx.batchNo,
          },
        ),
      ),
    });

    const summaries = parsed.summaries.length
      ? parsed.summaries
      : aggregateSummaries(parsed.items);
    await saveWarehouseSummaries(tx, ctx, summaries);

    const warnMsg = parsed.warnings.length > 0 ? parsed.warnings.join("；") : null;
    await tx.attachments.update({
      where: { id: attachmentRow.id },
      data: {
        parse_status: parsed.warnings.length > 0 ? "partial_success" : "success",
        error_message: warnMsg,
      },
    });

    await logStep(
      tx,
      ctx,
      "parse_excel",
      parsed.warnings.length > 0 ? "warning" : "success",
      `附件 ${attachment.filename} 解析 ${parsed.items.length} 条明细`,
      attachmentRow.id,
    );

    return {
      itemCount: parsed.items.length,
      warnings: parsed.warnings,
      summaryCount: summaries.length,
      failed: false,
      attachmentName: attachment.filename,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await tx.attachments.update({
      where: { id: attachmentRow.id },
      data: { parse_status: "failed", error_message: message },
    });
    await logStep(tx, ctx, "parse_excel", "failed", message, attachmentRow.id);
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
  const batchNo = generateBatchNo(containerNo);

  const container = await prisma.containers.create({
    data: {
      order_id: order.id,
      batch_no: batchNo,
      container_no: containerNo,
      operation_type: order.operation_type,
      customer: order.customer,
      order_date: order.order_date,
      eta: order.eta,
      pickup_date: order.pickup_date,
      parse_status: "parsing",
    },
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
      await prisma.$transaction(async (tx) => {
        await logStep(tx, ctx, "search_email", "failed", "未找到相关邮件");
        await tx.containers.update({
          where: { id: container.id },
          data: {
            parse_status: "failed",
            error_message: "未找到相关邮件，请确认柜号与发件人邮箱是否正确",
          },
        });
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

    await prisma.$transaction(async (tx) => {
      await logStep(
        tx,
        ctx,
        "search_email",
        "success",
        `找到 ${emails.length} 封邮件，选用：${detail.subject || detail.id}`,
      );
    });

    const parseableAttachments = detail.attachments.filter((a) => a.isParseable);

    if (parseableAttachments.length === 0) {
      const attachmentNames = detail.attachments.map((a) => a.filename).join(", ");
      await prisma.$transaction(async (tx) => {
        await logStep(
          tx,
          ctx,
          "check_attachment",
          "failed",
          attachmentNames
            ? `邮件附件 ${attachmentNames} 均非 Excel/CSV，无法解析`
            : "邮件中无附件",
        );
        await tx.containers.update({
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
      const result = await prisma.$transaction(async (tx) =>
        parseExcelAttachment(tx, ctx, detail.id, att, accessToken, refreshToken),
      );
      totalItems += result.itemCount;
      allWarnings.push(...result.warnings);
      if (result.failed) failedCount += 1;
      if ("summaryCount" in result && result.summaryCount) {
        totalSummaries += result.summaryCount;
      }
      if ("attachmentName" in result && result.attachmentName) {
        attachmentNames.push(result.attachmentName);
      }
    }

    const parseStatus =
      failedCount === parseableAttachments.length
        ? "failed"
        : failedCount > 0 || allWarnings.length > 0
          ? "partial_success"
          : "success";

    const errorMessage =
      parseStatus === "failed"
        ? "所有附件解析失败"
        : allWarnings.length > 0
          ? allWarnings.slice(0, 3).join("；")
          : null;

    await prisma.$transaction(async (tx) => {
      await tx.containers.update({
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
        tx,
        ctx,
        "save_database",
        parseStatus === "failed" ? "failed" : "success",
        `解析完成：${totalItems} 条明细，${parseableAttachments.length} 个附件`,
      );
    });

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
    const message = err instanceof Error ? err.message : String(err);
    await prisma.$transaction(async (tx) => {
      await logStep(tx, ctx, "parse_pipeline", "failed", message);
      await tx.containers.update({
        where: { id: container.id },
        data: { parse_status: "failed", error_message: message },
      });
    });
    throw err;
  }
}

/** 按已有解析记录重新检索解析 */
export async function reparseContainerFromGmail(
  containerId: number,
  accessToken: string,
  refreshToken?: string,
) {
  const existing = await prisma.containers.findUnique({ where: { id: containerId } });
  if (!existing) throw new Error("解析记录不存在");
  return parseOrderFromGmail(existing.order_id, accessToken, refreshToken);
}
