import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const { searchParams } = new URL(request.url);
  const containerNo = searchParams.get("containerNo")?.trim().toUpperCase();
  const batchNo = searchParams.get("batchNo")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const skip = (page - 1) * pageSize;

  const where: Prisma.warehouse_summariesWhereInput = {};
  if (containerNo) where.container_no = containerNo;
  if (batchNo) where.batch_no = batchNo;

  const [total, rows] = await Promise.all([
    prisma.warehouse_summaries.count({ where }),
    prisma.warehouse_summaries.findMany({
      where,
      orderBy: [{ container_no: "asc" }, { warehouse_code: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return success(serialize(rows), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}
