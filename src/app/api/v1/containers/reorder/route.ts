import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";

const reorderSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(200),
  ids: z.array(z.string()).min(1),
});

export async function PUT(request: Request) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return error("Validation failed", 400);
    }

    const { page, pageSize, ids } = parsed.data;
    const base = BigInt((page - 1) * pageSize + 1);

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.containers.update({
          where: { id: BigInt(id), deleted_at: null },
          data: {
            sort: base + BigInt(index),
            users_containers_updated_byTousers: { connect: { id: BigInt(user.id) } },
          },
        }),
      ),
    );

    return success({ updated: ids.length });
  } catch (err) {
    console.error("[containers reorder]", err);
    return error("排序保存失败", 500);
  }
}
