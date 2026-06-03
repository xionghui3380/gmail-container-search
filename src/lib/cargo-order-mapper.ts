import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { cargoOrderCreateSchema } from "@/lib/cargo-order-validators";

type CargoOrderInput = z.infer<typeof cargoOrderCreateSchema>;

function parseDateTime(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function assignFields(
  input: Partial<CargoOrderInput>,
): Partial<Omit<Prisma.containersCreateInput, "id" | "orders">> {
  return {
    container_no: input.container_no?.trim().toUpperCase(),
    operation_type: input.operation_type ?? undefined,
    email_message_id: input.email_message_id ?? undefined,
    email_subject: input.email_subject ?? undefined,
    email_from: input.email_from ?? undefined,
    email_date: input.email_date !== undefined ? parseDateTime(input.email_date) : undefined,
    parse_status: input.parse_status ?? undefined,
    error_message: input.error_message ?? undefined,
  };
}

export function buildCargoOrderCreateInput(
  input: CargoOrderInput,
): Prisma.containersCreateInput {
  return {
    ...assignFields(input),
    orders: { connect: { id: input.order_id } },
  } as Prisma.containersCreateInput;
}

export function buildCargoOrderUpdateInput(
  input: Partial<CargoOrderInput>,
): Prisma.containersUpdateInput {
  const data: Prisma.containersUpdateInput = {};
  if (input.order_id !== undefined) {
    data.orders = { connect: { id: input.order_id } };
  }
  if (input.container_no !== undefined) {
    data.container_no = input.container_no.trim().toUpperCase();
  }
  if (input.operation_type !== undefined) data.operation_type = input.operation_type;
  if (input.email_message_id !== undefined) data.email_message_id = input.email_message_id;
  if (input.email_subject !== undefined) data.email_subject = input.email_subject;
  if (input.email_from !== undefined) data.email_from = input.email_from;
  if (input.email_date !== undefined) data.email_date = parseDateTime(input.email_date);
  if (input.parse_status !== undefined) data.parse_status = input.parse_status ?? "pending";
  if (input.error_message !== undefined) data.error_message = input.error_message;
  return data;
}
