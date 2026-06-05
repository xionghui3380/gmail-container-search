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
  const warehouseCode = searchParams.get("warehouseCode")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));

  const whereBase = {
    is_history: false,
    ...(containerNo ? { container_no: { equals: containerNo } } : {}),
    ...(warehouseCode ? { warehouse_code: { contains: warehouseCode, mode: "insensitive" as const } } : {}),
  };

  const grouped = await prisma.delivery_items.groupBy({
    by: ["warehouse_code"],
    where: whereBase,
    _count: { id: true },
    _sum: { carton_count: true, weight: true, cbm: true },
    orderBy: { warehouse_code: "asc" },
  });

  const total = grouped.length;
  const start = (page - 1) * pageSize;
  const paged = grouped.slice(start, start + pageSize);

  const rows = paged.map((row) => ({
    warehouse_code: row.warehouse_code || "(空)",
    item_count: row._count.id,
    total_cartons: row._sum.carton_count ?? 0,
    total_weight: row._sum.weight ?? 0,
    total_cbm: row._sum.cbm ?? 0,
  }));

  return success(serialize(rows), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}
