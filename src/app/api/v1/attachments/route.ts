import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const { searchParams } = new URL(request.url);
  const containerId = searchParams.get("containerId");
  const containerNo = searchParams.get("containerNo")?.trim().toUpperCase();
  const batchNo = searchParams.get("batchNo")?.trim();

  const where = {
    ...(containerId ? { container_id: Number(containerId) } : {}),
    ...(containerNo ? { container_no: containerNo } : {}),
    ...(batchNo ? { batch_no: batchNo } : {}),
  };

  const attachments = await prisma.attachments.findMany({
    where,
    orderBy: { created_at: "desc" },
  });

  return success(serialize(attachments));
}
