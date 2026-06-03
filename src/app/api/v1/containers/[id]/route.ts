import { prisma } from "@/lib/prisma";
import { canDelete, canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { buildCargoOrderUpdateInput } from "@/lib/cargo-order-mapper";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";
import { cargoOrderUpdateSchema } from "@/lib/cargo-order-validators";

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  const id = Number(params.id);
  if (Number.isNaN(id)) return error("无效 ID", 400);

  const item = await prisma.containers.findUnique({ where: { id } });
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
    const parsed = cargoOrderUpdateSchema.safeParse(body);
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

    const existing = await prisma.containers.findUnique({ where: { id } });
    if (!existing) return error("记录不存在", 404);

    if (parsed.data.order_id !== undefined) {
      const order = await prisma.orders.findUnique({ where: { id: parsed.data.order_id } });
      if (!order) return error("关联的订单不存在", 400);
    }

    const updated = await prisma.containers.update({
      where: { id },
      data: buildCargoOrderUpdateInput(parsed.data),
    });

    return success(serialize(updated));
  } catch (err) {
    console.error("[containers PUT]", err);
    return error("更新失败", 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canDelete(user.role)) return error("权限不足", 403);

  const id = Number(params.id);
  if (Number.isNaN(id)) return error("无效 ID", 400);

  const existing = await prisma.containers.findUnique({ where: { id } });
  if (!existing) return error("记录不存在", 404);

  await prisma.containers.delete({ where: { id } });
  return success({ id: params.id });
}
