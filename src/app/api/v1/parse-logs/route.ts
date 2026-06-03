import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const { searchParams } = new URL(request.url);
  const containerNo = searchParams.get("containerNo")?.trim().toUpperCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const skip = (page - 1) * pageSize;

  const where = containerNo ? { container_no: containerNo } : {};

  const [total, logs] = await Promise.all([
    prisma.parse_logs.count({ where }),
    prisma.parse_logs.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return success(serialize(logs), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}
