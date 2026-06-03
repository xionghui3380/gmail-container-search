import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import { buildOrderCreateInput } from "@/lib/order-mapper";
import {
  buildOrderListOrderBy,
  buildOrderSearchWhere,
  parseOrderSortParams,
} from "@/lib/order-list-query";
import { canWrite } from "@/lib/auth";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";
import { orderCreateSchema } from "@/lib/order-validators";

export async function GET(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const containerNo = searchParams.get("containerNo")?.trim();
  const { sortBy, sortOrder } = parseOrderSortParams(
    searchParams.get("sortBy"),
    searchParams.get("sortOrder"),
  );
  const skip = (page - 1) * pageSize;

  const searchCondition = buildOrderSearchWhere(containerNo);
  const where: Prisma.ordersWhereInput = searchCondition ? searchCondition : {};
  const orderBy = buildOrderListOrderBy(sortBy, sortOrder);

  const [total, items] = await Promise.all([
    prisma.orders.count({ where }),
    prisma.orders.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        creator: { select: { full_name: true } },
        updater: { select: { full_name: true } },
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

export async function POST(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  try {
    const body = await request.json();
    const parsed = orderCreateSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        "Validation failed",
        400,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    const created = await prisma.orders.create({
      data: buildOrderCreateInput(parsed.data, BigInt(user.id)),
    });
    return success(serialize(created));
  } catch (err) {
    console.error("[orders POST]", err);
    return error("创建失败", 500);
  }
}
