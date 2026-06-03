import { prisma } from "@/lib/prisma";
import { canDelete } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { batchDeleteSchema } from "@/lib/validators";

export async function DELETE(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canDelete(user.role)) return error("权限不足", 403);

  try {
    const body = await request.json();
    const parsed = batchDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return error("Validation failed", 400);
    }

    const ids = parsed.data.ids.map((id) => BigInt(id));
    const result = await prisma.containers.updateMany({
      where: { id: { in: ids }, deleted_at: null },
      data: {
        deleted_at: new Date(),
        deleted_by: BigInt(user.id),
        updated_by: BigInt(user.id),
      },
    });

    return success({ deleted: result.count });
  } catch (err) {
    console.error("[containers batch DELETE]", err);
    return error("批量删除失败", 500);
  }
}
