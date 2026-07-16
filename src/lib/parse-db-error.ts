import { prisma } from "@/lib/prisma";
import { safeWriteParseLog, type ParseLogMeta } from "@/lib/parse-log";

/** 程序设计要求：数据库写入失败时的统一说明 */
export const PARSE_DB_WRITE_FAILURE_MESSAGE = "数据库写入失败，事务已回滚";

export type DbErrorClass = "retryable" | "business" | "fatal";

export type ParseDbFailureContext = {
  container_no: string;
  container_id?: number | null;
  batch_no?: string | null;
  attachment_id?: number | null;
  email_message_id?: string | null;
  attachment_name?: string | null;
  user_id?: string | null;
};

export function classifyDbError(err: unknown): DbErrorClass {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code ?? "";
  const combined = `${msg} ${code}`;
  if (/P2034|P1001|P1008|P1017|timeout|timed out|connection|deadlock|ECONNRESET/i.test(combined)) {
    return "retryable";
  }
  if (/P2002|unique constraint|Unique constraint/i.test(combined)) {
    return "business";
  }
  return "fatal";
}

export function getUserFacingDbErrorHint(classification: DbErrorClass): string {
  switch (classification) {
    case "retryable":
      return "数据库暂时不可用，请稍后重试";
    case "business":
      return "数据冲突，请勿重复操作";
    default:
      return PARSE_DB_WRITE_FAILURE_MESSAGE;
  }
}

function formatParseDbError(err: unknown, ctx: ParseDbFailureContext) {
  const classification = classifyDbError(err);
  const detail = err instanceof Error ? err.message : String(err);
  const stack =
    err instanceof Error ? err.stack?.split("\n").slice(0, 5).join(" | ") : "";
  const ctxSummary = JSON.stringify({
    container_no: ctx.container_no,
    container_id: ctx.container_id,
    batch_no: ctx.batch_no,
    attachment_id: ctx.attachment_id,
    email_message_id: ctx.email_message_id,
    attachment_name: ctx.attachment_name,
    user_id: ctx.user_id,
  });
  const hint = getUserFacingDbErrorHint(classification);
  const stackPart = stack ? ` stack=${stack}` : "";
  return `${hint}：${detail} [${classification}] ctx=${ctxSummary}${stackPart}`;
}

/** P2：结构化告警，可选 webhook（环境变量 PARSE_ALERT_WEBHOOK_URL） */
export function alertParseFailure(payload: Record<string, unknown>) {
  const entry = {
    level: "error",
    source: "parse",
    ts: new Date().toISOString(),
    ...payload,
  };
  console.error("[PARSE_ALERT]", JSON.stringify(entry));

  const webhook = process.env.PARSE_ALERT_WEBHOOK_URL;
  if (!webhook) return;

  void fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch((e) => console.error("[PARSE_ALERT webhook failed]", e));
}

async function logParseDbWriteFailure(ctx: ParseDbFailureContext, err: unknown) {
  const classification = classifyDbError(err);
  const message = formatParseDbError(err, ctx);
  const logMeta: ParseLogMeta = {
    container_no: ctx.container_no,
    container_id: ctx.container_id,
    attachment_id: ctx.attachment_id,
    batch_no: ctx.batch_no,
    step: "save_database",
    status: "failed",
    message,
  };

  const ok = await safeWriteParseLog(logMeta);
  if (!ok) {
    alertParseFailure({
      kind: "parse_log_write_failed",
      ctx,
      classification,
      originalError: err instanceof Error ? err.message : String(err),
    });
  }

  return { message, classification };
}

/** 统一处理：独立写失败日志 + 默认更新 containers 状态（事务外） */
export async function handleParseDbWriteFailure(
  ctx: ParseDbFailureContext,
  err: unknown,
  options?: {
    /** 默认 true：失败时更新 containers.parse_status = failed */
    updateContainer?: boolean;
    attachmentId?: number;
  },
) {
  const { message, classification } = await logParseDbWriteFailure(ctx, err);
  const shouldUpdateContainer = options?.updateContainer !== false;

  if (shouldUpdateContainer && ctx.container_id) {
    try {
      await prisma.containers.update({
        where: { id: ctx.container_id },
        data: { parse_status: "failed", error_message: message },
      });
    } catch (updateErr) {
      alertParseFailure({
        kind: "container_status_update_failed",
        ctx,
        classification,
        updateErr: String(updateErr),
      });
    }
  }

  if (options?.attachmentId) {
    try {
      await prisma.attachments.update({
        where: { id: options.attachmentId },
        data: { parse_status: "failed", error_message: message },
      });
    } catch (updateErr) {
      alertParseFailure({
        kind: "attachment_status_update_failed",
        ctx,
        attachmentId: options.attachmentId,
        updateErr: String(updateErr),
      });
    }
  }

  return message;
}
