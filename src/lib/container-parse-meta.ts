/**
 * 货柜解析元数据：与 google_sheet 分离存储
 */
import type {
  Prisma,
  container_parse_meta,
  google_sheet,
  parse_status,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SheetWithMeta = google_sheet & {
  container_parse_meta?: container_parse_meta | null;
  warehouse_summaries?: unknown[];
};

export type ParseMetaInput = {
  parse_status?: parse_status;
  error_message?: string | null;
  is_correct?: boolean;
  email_message_id?: string | null;
  email_subject?: string | null;
  email_from?: string | null;
  email_date?: Date | null;
  attachment_name?: string | null;
};

export function mergeParseMeta<T extends SheetWithMeta>(
  row: T,
): Omit<T, "container_parse_meta"> & {
  parse_status: parse_status;
  error_message: string | null;
  is_correct: boolean;
  email_message_id: string | null;
  email_subject: string | null;
  email_from: string | null;
  email_date: Date | null;
  attachment_name: string | null;
} {
  const meta = row.container_parse_meta;
  const { container_parse_meta: _meta, ...rest } = row;
  void _meta;
  return {
    ...rest,
    parse_status: meta?.parse_status ?? "pending",
    error_message: meta?.error_message ?? null,
    is_correct: meta?.is_correct ?? true,
    email_message_id: meta?.email_message_id ?? null,
    email_subject: meta?.email_subject ?? null,
    email_from: meta?.email_from ?? null,
    email_date: meta?.email_date ?? null,
    attachment_name: meta?.attachment_name ?? null,
  };
}

export async function upsertParseMeta(
  tx: Prisma.TransactionClient | typeof prisma,
  containerNo: string,
  data: ParseMetaInput,
) {
  const payload = {
    parse_status: data.parse_status ?? "pending",
    error_message: data.error_message ?? null,
    is_correct: data.is_correct ?? true,
    email_message_id: data.email_message_id ?? null,
    email_subject: data.email_subject ?? null,
    email_from: data.email_from ?? null,
    email_date: data.email_date ?? null,
    attachment_name: data.attachment_name ?? null,
  };

  return tx.container_parse_meta.upsert({
    where: { container_no: containerNo },
    create: { container_no: containerNo, ...payload },
    update: payload,
  });
}

export async function setParseMetaParsing(containerNo: string) {
  await upsertParseMeta(prisma, containerNo, {
    parse_status: "parsing",
    error_message: null,
  });
}

export async function setParseMetaFailed(
  tx: Prisma.TransactionClient,
  containerNo: string,
  errorMessage: string,
  extra?: ParseMetaInput,
) {
  await upsertParseMeta(tx, containerNo, {
    parse_status: "failed",
    error_message: errorMessage,
    is_correct: false,
    ...extra,
  });
}
