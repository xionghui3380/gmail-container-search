import type { google_sheet, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function mapOperationType(value: google_sheet["operation_type"]) {
  return value === "fcl" ? "整柜" : "拆柜";
}

/** 从 google_sheet 同步一条货柜记录（关联 orders，供 Gmail 解析使用） */
export async function upsertCargoFromGoogleSheet(
  sheet: google_sheet,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  let order = await tx.orders.findFirst({
    where: { container_no: sheet.container_no },
  });

  if (!order) {
    order = await tx.orders.create({
      data: {
        container_no: sheet.container_no,
        operation_type: mapOperationType(sheet.operation_type),
        customer: sheet.customer,
        order_date: sheet.order_date,
        eta: sheet.eta_date,
        pickup_date: sheet.pickup_date,
      },
    });
  }

  const existing = await tx.containers.findFirst({
    where: { container_no: sheet.container_no, order_id: order.id },
    orderBy: { id: "desc" },
  });
  if (existing) return existing;

  return tx.containers.create({
    data: {
      order_id: order.id,
      container_no: sheet.container_no,
      operation_type: mapOperationType(sheet.operation_type),
    },
  });
}
