/**
 * 数据验证 Schema 与工具函数
 *
 * 使用 Zod 库定义请求参数的验证规则。
 * 在 API Route Handler 中对请求体进行校验，确保数据格式正确。
 *
 * 包含：
 * - loginSchema：登录表单验证
 * - containerCreateSchema：集装箱创建时的完整字段验证
 * - containerUpdateSchema：集装箱更新时的部分字段验证（所有字段可选）
 * - batchDeleteSchema：批量删除验证
 * - parseDate() / toDecimal()：日期和数字的转换工具
 */
import { z } from "zod";

/** 登录表单验证规则 */
export const loginSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
  remember: z.boolean().optional().default(false),
});

/** 柜号正则：4 位大写字母 + 7 位数字（如 ABCD1234567） */
export const containerNoRegex = /^[A-Z]{4}\d{7}$/;

/** 集装箱创建时的字段验证（所有必填字段都有校验规则） */
export const containerCreateSchema = z.object({
  container_type: z.enum(["40", "45"]).default("40"),
  weight: z.number().nonnegative().optional().nullable(),
  mbl: z.string().max(50).optional().nullable(),
  terminal: z.string().min(1).max(50),
  customer: z.string().min(1).max(100),
  container_no: z
    .string()
    .regex(containerNoRegex, "柜号格式：4 位大写字母 + 7 位数字"),
  do_number: z.string().max(50).optional().nullable(),
  order_date: z.string().optional().nullable(),
  eta_date: z.string().optional().nullable(),
  operation_type: z.enum(["fcl", "lcl"]).default("fcl"),
  delivery_location: z.string().max(200).optional().nullable(),
  lfd_date: z.string().optional().nullable(),
  pickup_date: z.string().optional().nullable(),
  forecast_window: z.string().max(50).optional().nullable(),
  empty_report_date: z.string().optional().nullable(),
  return_date: z.string().optional().nullable(),
  appointment_no: z.string().max(50).optional().nullable(),
  appointment_time: z.string().optional().nullable(),
  warehouse_account: z.string().max(50).optional().nullable(),
  pickup_driver: z.string().max(50).optional().nullable(),
  return_driver: z.string().max(50).optional().nullable(),
  backend_delivery: z.boolean().optional().default(false),
  appointment_colleague: z.string().max(50).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/** 集装箱更新验证（使用 .partial() 使所有字段变为可选） */
export const containerUpdateSchema = containerCreateSchema.partial();

/** 批量删除验证（至少选择一条记录） */
export const batchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "请选择至少一条记录"),
});

/**
 * 将字符串日期转换为 Date 对象
 * @param value - ISO 日期字符串，如 "2024-06-19"
 * @returns Date 对象或 null
 */
export function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 透传数字值（用于 Decimal 字段）
 * Prisma 接受 number 类型，这里只做 null/undefined 的处理
 */
export function toDecimal(value?: number | null) {
  if (value === null || value === undefined) return null;
  return value;
}
