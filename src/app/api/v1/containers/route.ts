import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import {
  buildParseResultListOrderBy,
  buildParseResultSearchWhere,
  parseParseResultSortParams,
} from "@/lib/parse-result-list-query";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

export async function GET(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const containerNo = searchParams.get("containerNo")?.trim();
  const batchNo = searchParams.get("batchNo")?.trim();
  const { sortBy, sortOrder } = parseParseResultSortParams(
    searchParams.get("sortBy"),
    searchParams.get("sortOrder"),
  );
  const skip = (page - 1) * pageSize;

  const searchCondition = buildParseResultSearchWhere(containerNo, batchNo);
  const where: Prisma.containersWhereInput = searchCondition ? searchCondition : {};
  const orderBy = buildParseResultListOrderBy(sortBy, sortOrder);

  const [total, items] = await Promise.all([
    prisma.containers.count({ where }),
    prisma.containers.findMany({ where, orderBy, skip, take: pageSize }),
  ]);

  return success(serialize(items), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}
