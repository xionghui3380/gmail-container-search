import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canDelete } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const id = Number(params.id);
  if (Number.isNaN(id)) return error("无效 ID", 400);

  const item = await prisma.containers.findUnique({ where: { id } });
  if (!item) return error("记录不存在", 404);
  return success(serialize(item));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);
  if (!canDelete(user.role)) return error("权限不足", 403);

  const id = Number(params.id);
  if (Number.isNaN(id)) return error("无效 ID", 400);

  const existing = await prisma.containers.findUnique({ where: { id } });
  if (!existing) return error("记录不存在", 404);

  await prisma.containers.delete({ where: { id } });
  return success({ id: params.id });
}
