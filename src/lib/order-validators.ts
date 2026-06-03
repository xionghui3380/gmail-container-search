import { z } from "zod";
import { containerNoRegex } from "@/lib/validators";

export const orderCreateSchema = z.object({
  container_no: z
    .string()
    .min(1, "请填写柜号")
    .max(20)
    .regex(containerNoRegex, "柜号格式：4 位大写字母 + 7 位数字"),
  operation_type: z.string().max(50).optional().nullable(),
  customer: z.string().max(200).optional().nullable(),
  order_date: z.string().optional().nullable(),
  eta: z.string().optional().nullable(),
  pickup_date: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const orderUpdateSchema = orderCreateSchema.partial();

export const orderBatchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "请选择至少一条记录"),
});
