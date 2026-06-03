/**
 * 客户管理 API - 单条操作（详情 / 更新 / 删除）
 *
 * GET    /api/v1/customers/[id]   → 获取客户详情
 * PUT    /api/v1/customers/[id]   → 更新客户信息
 * DELETE /api/v1/customers/[id]   → 软删除客户
 *
 * 展示了：
 * 1. 动态路由参数 [id] 的获取方式
 * 2. 单条记录的查询、更新、软删除操作
 * 3. 记录不存在时的 404 处理
 * 4. BigInt 参数转换
 */
import { prisma } from "@/lib/prisma";
import { canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";
import { z } from "zod";

type Params = { params: { id: string } };

const customerUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contact: z.string().max(50).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().max(100).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  is_active: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/v1/customers/[id]
 * 获取单个客户详情
 */
export async function GET(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  const item = await prisma.customers.findFirst({
    where: { id: BigInt(params.id), deleted_at: null },
    include: {
      creator: { select: { id: true, username: true, full_name: true } },
      updater: { select: { id: true, username: true, full_name: true } },
    },
  });

  if (!item) return error("客户不存在", 404);
  return success(serialize(item));
}

/**
 * PUT /api/v1/customers/[id]
 * 更新客户信息
 */
export async function PUT(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  try {
    const body = await request.json();
    const parsed = customerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return error("验证失败", 400, parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })));
    }

    const existing = await prisma.customers.findFirst({
      where: { id: BigInt(params.id), deleted_at: null },
    });
    if (!existing) return error("客户不存在", 404);

    const updated = await prisma.customers.update({
      where: { id: BigInt(params.id) },
      data: {
        ...parsed.data,
        updated_by: BigInt(user.id),
      },
    });

    return success(serialize(updated));
  } catch (err) {
    console.error("[customers PUT]", err);
    return error("更新失败", 500);
  }
}

/**
 * DELETE /api/v1/customers/[id]
 * 软删除客户（设置 deleted_at 时间戳，不物理删除）
 */
export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  const existing = await prisma.customers.findFirst({
    where: { id: BigInt(params.id), deleted_at: null },
  });
  if (!existing) return error("客户不存在", 404);

  await prisma.customers.update({
    where: { id: BigInt(params.id) },
    data: {
      deleted_at: new Date(),
      updated_by: BigInt(user.id),
    },
  });

  return success({ id: params.id });
}
