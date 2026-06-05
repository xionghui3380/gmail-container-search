import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { error } from "@/lib/api-response";
import {
  buildExportFilename,
  detectExportFormat,
  encodeContentDisposition,
  exportDeliveryItemsToCsv,
  exportDeliveryItemsToXlsxBuffer,
} from "@/lib/delivery-items-export";
import { requireUser } from "@/lib/require-user";

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const containerId = Number(params.id);
  if (Number.isNaN(containerId)) return error("无效 ID", 400);

  const attachmentIdRaw = new URL(request.url).searchParams.get("attachmentId");
  if (!attachmentIdRaw) return error("缺少 attachmentId 参数", 400);

  const attachmentId = Number(attachmentIdRaw);
  if (Number.isNaN(attachmentId)) return error("无效 attachmentId", 400);

  const attachment = await prisma.attachments.findFirst({
    where: { id: attachmentId, container_id: containerId },
  });
  if (!attachment) return error("附件不存在", 404);

  const items = await prisma.delivery_items.findMany({
    where: { attachment_id: attachmentId, container_id: containerId },
    orderBy: { id: "asc" },
  });

  const format = detectExportFormat(attachment.attachment_name);
  const filename = buildExportFilename(attachment.attachment_name, format);

  if (format === "csv") {
    const body = exportDeliveryItemsToCsv(items);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": encodeContentDisposition(filename),
      },
    });
  }

  const buffer = await exportDeliveryItemsToXlsxBuffer(items);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": encodeContentDisposition(filename),
    },
  });
}
