import type { log_status, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ParseLogMeta = {
  container_no: string;
  container_id?: number | bigint | null;
  attachment_id?: number | null;
  batch_no?: string | null;
  step: string;
  status: log_status;
  message?: string;
};

/** 事务内写日志（仅用于与状态更新绑定的短事务，不用于业务入库事务） */
export async function writeParseLog(
  tx: Prisma.TransactionClient,
  meta: ParseLogMeta | string,
  step?: string,
  status?: log_status,
  message?: string,
) {
  if (typeof meta === "string") {
    return tx.parse_logs.create({
      data: {
        container_no: meta,
        step: step!,
        status: status!,
        message: message ?? null,
      },
    });
  }

  return tx.parse_logs.create({
    data: {
      container_no: meta.container_no,
      container_id: meta.container_id != null ? BigInt(meta.container_id) : null,
      attachment_id: meta.attachment_id ?? null,
      batch_no: meta.batch_no ?? null,
      step: meta.step,
      status: meta.status,
      message: meta.message ?? null,
    },
  });
}

/**
 * 独立连接写日志（不在业务事务内）。
 * 失败时不 throw，返回 false，由调用方决定是否告警。
 */
export async function safeWriteParseLog(meta: ParseLogMeta): Promise<boolean> {
  try {
    await prisma.parse_logs.create({
      data: {
        container_no: meta.container_no,
        container_id: meta.container_id != null ? BigInt(meta.container_id) : null,
        attachment_id: meta.attachment_id ?? null,
        batch_no: meta.batch_no ?? null,
        step: meta.step,
        status: meta.status,
        message: meta.message ?? null,
      },
    });
    return true;
  } catch (err) {
    console.error("[safeWriteParseLog failed]", { meta, err });
    return false;
  }
}
