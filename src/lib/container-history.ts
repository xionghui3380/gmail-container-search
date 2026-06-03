import { Prisma, type google_sheet } from "@prisma/client";
import { serialize } from "@/lib/serialize";

export async function saveContainerHistory(
  tx: Prisma.TransactionClient,
  record: google_sheet,
  operatorId: bigint,
) {
  const latest = await tx.google_sheet_history.findFirst({
    where: { container_id: record.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = (latest?.version ?? 0) + 1;

  return tx.google_sheet_history.create({
    data: {
      container_id: record.id,
      version,
      snapshot: serialize(record) as unknown as Prisma.InputJsonValue,
      operated_by: operatorId,
    },
  });
}
