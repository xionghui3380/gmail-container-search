import { prisma } from "@/lib/prisma";

/** 程序设计要求：数据库写入失败时的统一说明 */
export const PARSE_DB_WRITE_FAILURE_MESSAGE = "数据库写入失败，事务已回滚";

type ParseDbFailureContext = {
  container_no: string;
  container_id?: number | null;
  batch_no?: string | null;
  attachment_id?: number | null;
};

function formatParseDbError(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return `${PARSE_DB_WRITE_FAILURE_MESSAGE}：${detail}`;
}

async function logParseDbWriteFailure(
  ctx: ParseDbFailureContext,
  err: unknown,
) {
  const message = formatParseDbError(err);
  try {
    await prisma.parse_logs.create({
      data: {
        container_no: ctx.container_no,
        container_id: ctx.container_id != null ? BigInt(ctx.container_id) : null,
        attachment_id: ctx.attachment_id ?? null,
        batch_no: ctx.batch_no ?? null,
        step: "save_database",
        status: "failed",
        message,
      },
    });
  } catch (logErr) {
    console.error("[parse_logs save_database failed]", logErr);
  }
  return message;
}

/** 统一处理：记录日志 + 可选更新 containers / attachments 状态 */
export async function handleParseDbWriteFailure(
  ctx: ParseDbFailureContext,
  err: unknown,
  options?: {
    updateContainer?: boolean;
    attachmentId?: number;
  },
) {
  const message = await logParseDbWriteFailure(ctx, err);

  if (options?.updateContainer && ctx.container_id) {
    try {
      await prisma.containers.update({
        where: { id: ctx.container_id },
        data: { parse_status: "failed", error_message: message },
      });
    } catch (updateErr) {
      console.error("[containers update after rollback failed]", updateErr);
    }
  }

  if (options?.attachmentId) {
    try {
      await prisma.attachments.update({
        where: { id: options.attachmentId },
        data: { parse_status: "failed", error_message: message },
      });
    } catch (updateErr) {
      console.error("[attachments update after rollback failed]", updateErr);
    }
  }

  return message;
}
