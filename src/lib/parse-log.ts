import type { log_status, Prisma } from "@prisma/client";

export async function writeParseLog(
  tx: Prisma.TransactionClient,
  containerNo: string,
  step: string,
  status: log_status,
  message?: string,
) {
  return tx.parse_logs.create({
    data: {
      container_no: containerNo,
      step,
      status,
      message: message ?? null,
    },
  });
}
