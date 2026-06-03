/**
 * 客户管理 API - 列表 & 创建
 *
 * GET  /api/v1/customers      → 分页查询客户列表（支持搜索）
 * POST /api/v1/customers      → 创建新客户
 *
 * 这是单表 CRUD 的标准模板，展示了：
 * 1. 分页查询（page / pageSize / search）
 * 2. 软删除过滤（deleted_at: null）
 * 3. 数据验证（Zod Schema）
 * 4. 权限检查（canWrite）
 * 5. BigInt 序列化（serialize）
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import { canWrite } from "@/lib/auth";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";
import { z } from "zod";

/** 客户创建/更新的验证规则 */
const customerSchema = z.object({
  name: z.string().min(1, "客户名称不能为空").max(100),
  contact: z.string().max(50).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().max(100).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/v1/customers
 * 分页查询客户列表，支持按名称模糊搜索
 */
export async function GET(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
  const search = searchParams.get("search")?.trim();

  const where: Prisma.customersWhereInput = {
    deleted_at: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { contact: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.customers.count({ where }),
    prisma.customers.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { id: true, username: true, full_name: true } },
      },
    }),
  ]);

  return success(serialize(items), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}

/**
 * POST /api/v1/customers
 * 创建新客户
 */
export async function POST(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  try {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return error("验证失败", 400, parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })));
    }

    const created = await prisma.customers.create({
      data: {
        ...parsed.data,
        created_by: BigInt(user.id),
        updated_by: BigInt(user.id),
      },
    });

    return success(serialize(created));
  } catch (err) {
    console.error("[customers POST]", err);
    return error("创建失败", 500);
  }
}
