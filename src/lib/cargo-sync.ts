import type { google_sheet, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 从 google_sheet 同步一条货柜主数据（集装箱录入后可供货柜管理使用） */
export async function upsertCargoFromGoogleSheet(
  sheet: google_sheet,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const payload = {
    container_type: sheet.container_type,
    weight: sheet.weight,
    mbl: sheet.mbl,
    terminal: sheet.terminal,
    customer: sheet.customer,
    do_number: sheet.do_number,
    order_date: sheet.order_date,
    eta_date: sheet.eta_date,
    operation_type: sheet.operation_type,
    delivery_location: sheet.delivery_location,
    lfd_date: sheet.lfd_date,
    pickup_date: sheet.pickup_date,
    forecast_window: sheet.forecast_window,
    empty_report_date: sheet.empty_report_date,
    return_date: sheet.return_date,
    appointment_no: sheet.appointment_no,
    appointment_time: sheet.appointment_time,
    warehouse_account: sheet.warehouse_account,
    pickup_driver: sheet.pickup_driver,
    return_driver: sheet.return_driver,
    backend_delivery: sheet.backend_delivery,
    appointment_colleague: sheet.appointment_colleague,
    remarks: sheet.remarks,
    created_by: sheet.created_by,
    updated_by: sheet.updated_by,
    deleted_at: sheet.deleted_at,
    deleted_by: sheet.deleted_by,
    sort: sheet.sort,
  };

  return tx.containers.upsert({
    where: { container_no: sheet.container_no },
    create: {
      container_no: sheet.container_no,
      ...payload,
    },
    update: payload,
  });
}
