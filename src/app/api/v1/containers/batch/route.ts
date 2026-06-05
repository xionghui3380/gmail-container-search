import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canDelete } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";

const batchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "请选择至少一条记录"),
});

export async function DELETE(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);
  if (!canDelete(user.role)) return error("权限不足", 403);

  try {
    const body = await request.json();
    const parsed = batchDeleteSchema.safeParse(body);
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

    const ids = parsed.data.ids.map(Number).filter((id) => !Number.isNaN(id));
    if (ids.length === 0) return error("无效 ID", 400);

    const result = await prisma.containers.deleteMany({
      where: { id: { in: ids } },
    });

    return success({ deleted: result.count });
  } catch (err) {
    console.error("[containers batch DELETE]", err);
    return error("批量删除失败", 500);
  }
}
