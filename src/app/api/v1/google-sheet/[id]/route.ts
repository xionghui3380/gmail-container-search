import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canDelete, canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { buildContainerUpdateInput } from "@/lib/container-mapper";
import { saveContainerHistory } from "@/lib/container-history";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";
import { containerUpdateSchema } from "@/lib/validators";

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  const item = await prisma.google_sheet.findFirst({
    where: { id: BigInt(params.id), deleted_at: null },
  });

  if (!item) return error("记录不存在", 404);
  return success(serialize(item));
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  try {
    const body = await request.json();
    const parsed = containerUpdateSchema.safeParse(body);
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

    const existing = await prisma.google_sheet.findFirst({
      where: { id: BigInt(params.id), deleted_at: null },
    });
    if (!existing) return error("记录不存在", 404);

    const data = buildContainerUpdateInput(parsed.data, BigInt(user.id));
    const updated = await prisma.$transaction(async (tx) => {
      await saveContainerHistory(tx, existing, BigInt(user.id));
      return tx.google_sheet.update({
        where: { id: BigInt(params.id) },
        data,
      });
    });

    return success(serialize(updated));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return error("柜号已存在", 409);
    }
    console.error("[google-sheet PUT]", err);
    return error("更新失败", 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);
  if (!canDelete(user.role)) return error("权限不足", 403);

  const existing = await prisma.google_sheet.findFirst({
    where: { id: BigInt(params.id), deleted_at: null },
  });
  if (!existing) return error("记录不存在", 404);

  await prisma.google_sheet.update({
    where: { id: BigInt(params.id) },
    data: {
      deleted_at: new Date(),
      users_google_sheet_deleted_byTousers: { connect: { id: BigInt(user.id) } },
      users_google_sheet_updated_byTousers: { connect: { id: BigInt(user.id) } },
    },
  });

  return success({ id: params.id });
}
