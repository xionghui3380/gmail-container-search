import { prisma } from "@/lib/prisma";
import { canDelete } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { orderBatchDeleteSchema } from "@/lib/order-validators";

export async function DELETE(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canDelete(user.role)) return error("权限不足", 403);

  try {
    const body = await request.json();
    const parsed = orderBatchDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return error("Validation failed", 400);
    }

    const ids = parsed.data.ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
    const result = await prisma.orders.deleteMany({
      where: { id: { in: ids } },
    });

    return success({ deleted: result.count });
  } catch (err) {
    console.error("[orders batch DELETE]", err);
    return error("批量删除失败", 500);
  }
}
