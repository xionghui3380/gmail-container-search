import { Prisma } from "@prisma/client";
import type { containerCreateSchema } from "@/lib/validators";
import type { z } from "zod";
import { parseDate, toDecimal } from "@/lib/validators";

type ContainerInput = z.infer<typeof containerCreateSchema>;

function assignFields(
  input: Partial<ContainerInput>,
): Omit<
  Prisma.google_sheetCreateInput,
  "created_by" | "updated_by" | "users_google_sheet_created_byTousers" | "users_google_sheet_updated_byTousers"
> {
  return {
    container_type: input.container_type ?? "40",
    weight: input.weight !== undefined ? toDecimal(input.weight) : undefined,
    mbl: input.mbl ?? undefined,
    terminal: input.terminal!,
    customer: input.customer!,
    container_no: input.container_no!,
    do_number: input.do_number ?? undefined,
    order_date: parseDate(input.order_date),
    eta_date: parseDate(input.eta_date),
    operation_type: input.operation_type ?? "fcl",
    delivery_location: input.delivery_location ?? undefined,
    lfd_date: parseDate(input.lfd_date),
    pickup_date: parseDate(input.pickup_date),
    forecast_window: input.forecast_window ?? undefined,
    empty_report_date: parseDate(input.empty_report_date),
    return_date: parseDate(input.return_date),
    appointment_no: input.appointment_no ?? undefined,
    appointment_time: input.appointment_time
      ? new Date(input.appointment_time)
      : undefined,
    warehouse_account: input.warehouse_account ?? undefined,
    pickup_driver: input.pickup_driver ?? undefined,
    return_driver: input.return_driver ?? undefined,
    backend_delivery: input.backend_delivery ?? false,
    appointment_colleague: input.appointment_colleague ?? undefined,
    remarks: input.remarks ?? undefined,
  };
}

export function buildContainerCreateInput(
  input: ContainerInput,
  userId: bigint,
): Prisma.google_sheetCreateInput {
  return {
    ...assignFields(input),
    users_google_sheet_created_byTousers: { connect: { id: userId } },
    users_google_sheet_updated_byTousers: { connect: { id: userId } },
  };
}

export function buildContainerUpdateInput(
  input: Partial<ContainerInput>,
  userId: bigint,
): Prisma.google_sheetUpdateInput {
  const data: Prisma.google_sheetUpdateInput = {
    users_google_sheet_updated_byTousers: { connect: { id: userId } },
  };

  if (input.container_type !== undefined) data.container_type = input.container_type;
  if (input.weight !== undefined) data.weight = toDecimal(input.weight);
  if (input.mbl !== undefined) data.mbl = input.mbl;
  if (input.terminal !== undefined) data.terminal = input.terminal;
  if (input.customer !== undefined) data.customer = input.customer;
  if (input.container_no !== undefined) data.container_no = input.container_no;
  if (input.do_number !== undefined) data.do_number = input.do_number;
  if (input.order_date !== undefined) data.order_date = parseDate(input.order_date);
  if (input.eta_date !== undefined) data.eta_date = parseDate(input.eta_date);
  if (input.operation_type !== undefined) data.operation_type = input.operation_type;
  if (input.delivery_location !== undefined)
    data.delivery_location = input.delivery_location;
  if (input.lfd_date !== undefined) data.lfd_date = parseDate(input.lfd_date);
  if (input.pickup_date !== undefined) data.pickup_date = parseDate(input.pickup_date);
  if (input.forecast_window !== undefined) data.forecast_window = input.forecast_window;
  if (input.empty_report_date !== undefined)
    data.empty_report_date = parseDate(input.empty_report_date);
  if (input.return_date !== undefined) data.return_date = parseDate(input.return_date);
  if (input.appointment_no !== undefined) data.appointment_no = input.appointment_no;
  if (input.appointment_time !== undefined) {
    data.appointment_time = input.appointment_time
      ? new Date(input.appointment_time)
      : null;
  }
  if (input.warehouse_account !== undefined)
    data.warehouse_account = input.warehouse_account;
  if (input.pickup_driver !== undefined) data.pickup_driver = input.pickup_driver;
  if (input.return_driver !== undefined) data.return_driver = input.return_driver;
  if (input.backend_delivery !== undefined)
    data.backend_delivery = input.backend_delivery;
  if (input.appointment_colleague !== undefined)
    data.appointment_colleague = input.appointment_colleague;
  if (input.remarks !== undefined) data.remarks = input.remarks;

  return data;
}
