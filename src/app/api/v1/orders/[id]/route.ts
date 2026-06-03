import { prisma } from "@/lib/prisma";
import { canDelete, canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { buildOrderUpdateInput } from "@/lib/order-mapper";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";
import { orderUpdateSchema } from "@/lib/order-validators";

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  const id = Number(params.id);
  if (Number.isNaN(id)) return error("无效 ID", 400);

  const item = await prisma.orders.findUnique({ where: { id } });
  if (!item) return error("记录不存在", 404);
  return success(serialize(item));
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  const id = Number(params.id);
  if (Number.isNaN(id)) return error("无效 ID", 400);

  try {
    const body = await request.json();
    const parsed = orderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        "Validation failed",
        400,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    const existing = await prisma.orders.findUnique({ where: { id } });
    if (!existing) return error("记录不存在", 404);

    const updated = await prisma.orders.update({
      where: { id },
      data: buildOrderUpdateInput(parsed.data),
    });

    return success(serialize(updated));
  } catch (err) {
    console.error("[orders PUT]", err);
    return error("更新失败", 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canDelete(user.role)) return error("权限不足", 403);

  const id = Number(params.id);
  if (Number.isNaN(id)) return error("无效 ID", 400);

  const existing = await prisma.orders.findUnique({ where: { id } });
  if (!existing) return error("记录不存在", 404);

  await prisma.orders.delete({ where: { id } });
  return success({ id: params.id });
}
