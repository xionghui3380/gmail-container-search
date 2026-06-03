import { Prisma, type containers } from "@prisma/client";
import { serialize } from "@/lib/serialize";

export async function saveContainerHistory(
  tx: Prisma.TransactionClient,
  record: containers,
  operatorId: bigint,
) {
  const latest = await tx.containers_history.findFirst({
    where: { container_id: record.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = (latest?.version ?? 0) + 1;

  return tx.containers_history.create({
    data: {
      container_id: record.id,
      version,
      snapshot: serialize(record) as unknown as Prisma.InputJsonValue,
      operated_by: operatorId,
    },
  });
}
