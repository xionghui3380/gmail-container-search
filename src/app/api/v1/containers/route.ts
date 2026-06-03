import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import { buildContainerCreateInput } from "@/lib/container-mapper";
import {
  buildColumnFilters,
  buildOrderBy,
  buildSearchWhere,
  parseFilters,
  parseSortParams,
} from "@/lib/container-list-query";
import { canWrite } from "@/lib/auth";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";
import { containerCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const search = searchParams.get("search")?.trim();
  const containerNo = searchParams.get("containerNo")?.trim();
  const mbl = searchParams.get("mbl")?.trim();
  const customer = searchParams.get("customer")?.trim();
  const filters = parseFilters(searchParams.get("filters"));
  const { sortBy, sortOrder } = parseSortParams(
    searchParams.get("sortBy"),
    searchParams.get("sortOrder"),
  );
  const skip = (page - 1) * pageSize;

  const columnConditions = buildColumnFilters(filters);
  const searchCondition = buildSearchWhere(search, containerNo, mbl, customer);

  const where: Prisma.google_sheetWhereInput = {
    deleted_at: null,
    ...(searchCondition ? searchCondition : {}),
    ...(columnConditions.length > 0 ? { AND: columnConditions } : {}),
  };

  const orderBy = buildOrderBy(sortBy, sortOrder);

  const [total, items] = await Promise.all([
    prisma.google_sheet.count({ where }),
    prisma.google_sheet.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
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
    const parsed = containerCreateSchema.safeParse(body);
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

    const maxSort = await prisma.google_sheet.aggregate({
      where: { deleted_at: null },
      _max: { sort: true },
    });
    const nextSort = (maxSort._max.sort ?? BigInt(0)) + BigInt(1);

    const data = buildContainerCreateInput(parsed.data, BigInt(user.id));
    const created = await prisma.google_sheet.create({
      data: { ...data, sort: nextSort },
    });
    return success(serialize(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return error("柜号已存在", 409);
    }
    console.error("[containers POST]", err);
    return error("创建失败", 500);
  }
}
