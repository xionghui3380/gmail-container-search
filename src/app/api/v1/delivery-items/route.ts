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
  const warehouseCode = searchParams.get("warehouseCode")?.trim() ?? "";
  const warehouseCodeExact = searchParams.get("warehouseCodeExact") === "true";
  const fbaId = searchParams.get("fbaId")?.trim();
  const referenceId = searchParams.get("referenceId")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const skip = (page - 1) * pageSize;

  const where: Prisma.delivery_itemsWhereInput = {
    is_history: false,
  };

  if (warehouseCode) {
    if (warehouseCodeExact) {
      where.warehouse_code = warehouseCode;
    } else {
      where.warehouse_code = { contains: warehouseCode, mode: "insensitive" };
    }
  } else if (warehouseCodeExact) {
    where.warehouse_code = null;
  }
  if (fbaId) {
    where.fba_id = { contains: fbaId, mode: "insensitive" };
  }
  if (referenceId) {
    where.reference_id = { contains: referenceId, mode: "insensitive" };
  }

  const [total, rows] = await Promise.all([
    prisma.delivery_items.count({ where }),
    prisma.delivery_items.findMany({
      where,
      orderBy: [{ container_no: "asc" }, { id: "asc" }],
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
