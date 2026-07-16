import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CargoParseFields = {
  parse_status?: string;
  error_message?: string | null;
  email_message_id?: string | null;
  email_subject?: string | null;
  email_from?: string | null;
  email_date?: Date | null;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

async function findLatestContainer(
  tx: DbClient,
  containerNo: string,
) {
  return tx.containers.findFirst({
    where: { container_no: containerNo },
    orderBy: { id: "desc" },
  });
}

export async function updateCargoParseFields(
  tx: DbClient,
  containerNo: string,
  data: CargoParseFields,
) {
  const latest = await findLatestContainer(tx, containerNo);
  if (!latest) return null;

  return tx.containers.update({
    where: { id: latest.id },
    data: {
      parse_status: data.parse_status,
      error_message: data.error_message,
      email_message_id: data.email_message_id,
      email_subject: data.email_subject,
      email_from: data.email_from,
      email_date: data.email_date,
    },
  });
}

export async function setCargoParsing(containerNo: string) {
  await updateCargoParseFields(prisma, containerNo, {
    parse_status: "parsing",
    error_message: null,
  });
}

export async function setCargoParseFailed(
  tx: DbClient,
  containerNo: string,
  errorMessage: string,
  extra?: CargoParseFields,
) {
  await updateCargoParseFields(tx, containerNo, {
    parse_status: "failed",
    error_message: errorMessage,
    ...extra,
  });
}
