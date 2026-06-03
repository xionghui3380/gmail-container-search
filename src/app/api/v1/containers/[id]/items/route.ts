import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const containerId = Number(params.id);
  if (Number.isNaN(containerId)) return error("无效 ID", 400);

  const { searchParams } = new URL(request.url);
  const attachmentId = searchParams.get("attachmentId");

  const container = await prisma.containers.findUnique({ where: { id: containerId } });
  if (!container) return error("记录不存在", 404);

  const attachments = await prisma.attachments.findMany({
    where: {
      container_id: containerId,
      ...(attachmentId ? { id: Number(attachmentId) } : {}),
    },
    orderBy: { id: "asc" },
  });

  const items = await prisma.delivery_items.findMany({
    where: {
      container_id: containerId,
      ...(attachmentId ? { attachment_id: Number(attachmentId) } : {}),
    },
    orderBy: { id: "asc" },
  });

  return success(
    serialize({
      container,
      attachments,
      items,
    }),
  );
}
