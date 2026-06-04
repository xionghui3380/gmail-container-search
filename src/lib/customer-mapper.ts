import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { customerCreateSchema } from "@/lib/customer-validators";

type CustomerInput = z.infer<typeof customerCreateSchema>;

function assignFields(
  input: Partial<CustomerInput>,
): Partial<Omit<Prisma.customersCreateInput, "id">> {
  return {
    name: input.name !== undefined ? input.name.trim() : undefined,
    contact: input.contact !== undefined ? input.contact?.trim() || null : undefined,
    phone: input.phone !== undefined ? input.phone?.trim() || null : undefined,
    email: input.email !== undefined ? input.email?.trim() || null : undefined,
    address: input.address !== undefined ? input.address?.trim() || null : undefined,
    is_active: input.is_active !== undefined ? input.is_active : undefined,
    remarks: input.remarks !== undefined ? input.remarks ?? null : undefined,
  };
}

export function buildCustomerCreateInput(
  input: CustomerInput,
  userId: bigint,
): Prisma.customersCreateInput {
  return {
    ...(assignFields(input) as Prisma.customersCreateInput),
    name: input.name.trim(),
    is_active: input.is_active ?? true,
    creator: { connect: { id: userId } },
  };
}

export function buildCustomerUpdateInput(
  input: Partial<CustomerInput>,
  userId: bigint,
): Prisma.customersUpdateInput {
  const data: Prisma.customersUpdateInput = assignFields(input);
  data.updater = { connect: { id: userId } };
  return data;
}