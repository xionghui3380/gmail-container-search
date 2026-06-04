import {z} from "zod";

export const customerCreateSchema = z.object({
    name: z.string().min(1, "请填写客户名称").max(100),
    contact: z.string().max(50).optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    email: z.string().email("邮箱格式不正确").max(100).optional().nullable().or(z.literal("")),
    address: z.string().max(200).optional().nullable(),
    is_active: z.boolean().optional().default(true),
    remarks: z.string().optional().nullable(),
})

export const customerUpdateSchema = customerCreateSchema.partial();

export const customerBatchDeleteSchema = z.object({
    ids: z.array(z.string()).min(1, "请选择至少一条记录"),
});