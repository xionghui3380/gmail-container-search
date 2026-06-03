import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

type Params = { params: { containerNo: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const containerNo = params.containerNo.trim().toUpperCase();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const search = searchParams.get("search")?.trim();
  const skip = (page - 1) * pageSize;

  const where = {
    container_no: containerNo,
    ...(search
      ? {
          OR: [
            { warehouse_code: { contains: search, mode: "insensitive" as const } },
            { fba_id: { contains: search, mode: "insensitive" as const } },
            { reference_id: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.delivery_items.count({ where }),
    prisma.delivery_items.findMany({
      where,
      orderBy: [{ warehouse_code: "asc" }, { id: "asc" }],
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
