import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { error } from "@/lib/api-response";
import {
  encodeContentDisposition,
  exportDeliveryItemsToCsv,
} from "@/lib/delivery-items-export";
import { requireUser } from "@/lib/require-user";

type Params = { params: { containerNo: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const containerNo = params.containerNo.trim().toUpperCase();
  const type = new URL(request.url).searchParams.get("type") ?? "summary";

  if (type === "items") {
    const items = await prisma.delivery_items.findMany({
      where: { container_no: containerNo },
      orderBy: [{ warehouse_code: "asc" }, { id: "asc" }],
    });
    const body = exportDeliveryItemsToCsv(items);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": encodeContentDisposition(`${containerNo}-items.csv`),
      },
    });
  }

  const summaries = await prisma.warehouse_summaries.findMany({
    where: { container_no: containerNo },
    orderBy: { warehouse_code: "asc" },
  });
  const header = ["container_no", "warehouse_code", "total_cartons", "item_count"];
  const lines = [
    header.join(","),
    ...summaries.map((row) =>
      header.map((key) => {
        const text = row[key as keyof typeof row] == null ? "" : String(row[key as keyof typeof row]);
        if (text.includes(",") || text.includes('"')) return `"${text.replace(/"/g, '""')}"`;
        return text;
      }).join(","),
    ),
  ];
  return new NextResponse(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": encodeContentDisposition(`${containerNo}-summary.csv`),
    },
  });
}
