import type { log_status, Prisma } from "@prisma/client";

export type ParseLogMeta = {
  container_no: string;
  container_id?: number | bigint | null;
  attachment_id?: number | null;
  batch_no?: string | null;
  step: string;
  status: log_status;
  message?: string;
};

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
