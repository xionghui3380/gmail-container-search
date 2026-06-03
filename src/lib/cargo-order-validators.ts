import { z } from "zod";
import { containerNoRegex } from "@/lib/validators";

export const cargoOrderCreateSchema = z.object({
  order_id: z.coerce.number().int().positive("请填写有效的订单 ID"),
  container_no: z
    .string()
    .min(1, "请填写柜号")
    .max(20)
    .regex(containerNoRegex, "柜号格式：4 位大写字母 + 7 位数字"),
  operation_type: z.string().max(50).optional().nullable(),
  email_message_id: z.string().optional().nullable(),
  email_subject: z.string().optional().nullable(),
  email_from: z.string().max(200).optional().nullable(),
  email_date: z.string().optional().nullable(),
  parse_status: z.string().max(30).optional().nullable(),
  error_message: z.string().optional().nullable(),
});

export const cargoOrderUpdateSchema = cargoOrderCreateSchema.partial();

export const cargoOrderBatchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "请选择至少一条记录"),
});
