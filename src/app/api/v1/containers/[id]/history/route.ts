import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { error, success } from "@/lib/api-response";
import { serialize } from "@/lib/serialize";

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  const user = await requireUser(request as import("next/server").NextRequest);
  if (!user) return error("Unauthorized", 401);

  try {
    const containerId = BigInt(params.id);

    const history = await prisma.google_sheet_history.findMany({
      where: { container_id: containerId },
      orderBy: { version: "desc" },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            full_name: true,
          },
        },
      },
    });

    return success(serialize(history));
  } catch (err) {
    console.error("[google_sheet history GET]", err);
    return error("查询历史记录失败", 500);
  }
}
