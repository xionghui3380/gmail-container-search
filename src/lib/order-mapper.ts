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
  };
}

export function buildOrderCreateInput(input: OrderInput): Prisma.ordersCreateInput {
  return assignFields(input) as Prisma.ordersCreateInput;
}

export function buildOrderUpdateInput(input: Partial<OrderInput>): Prisma.ordersUpdateInput {
  const data: Prisma.ordersUpdateInput = {};
  if (input.container_no !== undefined) {
    data.container_no = input.container_no.trim().toUpperCase();
  }
  if (input.operation_type !== undefined) data.operation_type = input.operation_type;
  if (input.customer !== undefined) data.customer = input.customer;
  if (input.order_date !== undefined) data.order_date = parseDate(input.order_date);
  if (input.eta !== undefined) data.eta = parseDate(input.eta);
  if (input.pickup_date !== undefined) data.pickup_date = parseDate(input.pickup_date);
  return data;
}
