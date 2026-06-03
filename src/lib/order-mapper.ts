import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { parseDate } from "@/lib/validators";
import type { orderCreateSchema } from "@/lib/order-validators";

type OrderInput = z.infer<typeof orderCreateSchema>;

function assignFields(
  input: Partial<OrderInput>,
): Partial<Omit<Prisma.ordersCreateInput, "id">> {
  return {
    container_no: input.container_no?.trim().toUpperCase(),
    operation_type: input.operation_type ?? undefined,
    customer: input.customer ?? undefined,
    order_date: input.order_date !== undefined ? parseDate(input.order_date) : undefined,
    eta: input.eta !== undefined ? parseDate(input.eta) : undefined,
    pickup_date: input.pickup_date !== undefined ? parseDate(input.pickup_date) : undefined,
    remarks: input.remarks ?? undefined,
  };
}

export function buildOrderCreateInput(
  input: OrderInput,
  userId?: bigint,
): Prisma.ordersCreateInput {
  return {
    ...(assignFields(input) as Prisma.ordersCreateInput),
    ...(userId ? { creator: { connect: { id: userId } } } : {}),
  };
}

export function buildOrderUpdateInput(
  input: Partial<OrderInput>,
  userId?: bigint,
): Prisma.ordersUpdateInput {
  const data: Prisma.ordersUpdateInput = assignFields(input);
  if (input.remarks !== undefined) data.remarks = input.remarks;
  if (userId) data.updater = { connect: { id: userId } };
  return data;
}
