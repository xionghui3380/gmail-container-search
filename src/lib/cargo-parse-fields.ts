import type { parse_status, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CargoParseFields = {
  parse_status?: parse_status;
  error_message?: string | null;
  is_correct?: boolean;
  email_message_id?: string | null;
  email_subject?: string | null;
  email_from?: string | null;
  email_date?: Date | null;
  attachment_name?: string | null;
};

export async function updateCargoParseFields(
  tx: Prisma.TransactionClient | typeof prisma,
  containerNo: string,
  data: CargoParseFields,
) {
  return tx.containers.update({
    where: { container_no: containerNo },
    data: {
      parse_status: data.parse_status,
      error_message: data.error_message,
      is_correct: data.is_correct,
      email_message_id: data.email_message_id,
      email_subject: data.email_subject,
      email_from: data.email_from,
      email_date: data.email_date,
      attachment_name: data.attachment_name,
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
  tx: Prisma.TransactionClient,
  containerNo: string,
  errorMessage: string,
  extra?: CargoParseFields,
) {
  await updateCargoParseFields(tx, containerNo, {
    parse_status: "failed",
    error_message: errorMessage,
    is_correct: false,
    ...extra,
  });
}
