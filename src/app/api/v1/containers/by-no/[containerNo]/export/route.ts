import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { error } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";

type Params = { params: { containerNo: string } };

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

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
    const header = [
      "container_no",
      "customer_code",
      "fba_id",
      "reference_id",
      "cbm",
      "weight",
      "carton_count",
      "warehouse_code",
      "delivery_method",
      "customer_note",
      "actual_carton_count",
      "pallet_count",
      "warehouse_note",
    ];
    const lines = [
      header.join(","),
      ...items.map((row) =>
        header.map((key) => csvEscape(row[key as keyof typeof row])).join(","),
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${containerNo}-items.csv"`,
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
      header.map((key) => csvEscape(row[key as keyof typeof row])).join(","),
    ),
  ];
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${containerNo}-summary.csv"`,
    },
  });
}
