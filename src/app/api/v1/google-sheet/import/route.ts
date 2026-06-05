import { NextRequest } from "next/server";
import { canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { importOrderSheetBuffer } from "@/lib/container-parse-service";
import { requireUser } from "@/lib/require-user";

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return error("请上传 Excel 文件（字段名 file）", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importOrderSheetBuffer(buffer, BigInt(user.id));

    return success({
      total: result.total,
      parsed: result.imported,
      skipped: result.skipped,
      created: result.created,
      updated: result.updated,
      parseErrors: result.parseErrors,
      persistErrors: result.persistErrors,
    });
  } catch (err) {
    console.error("[google-sheet import]", err);
    return error(err instanceof Error ? err.message : "导入失败", 500);
  }
}
