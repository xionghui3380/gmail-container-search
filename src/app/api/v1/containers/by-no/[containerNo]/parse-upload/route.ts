import { NextRequest } from "next/server";
import { canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { parseContainerUploadBuffer } from "@/lib/container-parse-service";
import { requireUser } from "@/lib/require-user";

export const maxDuration = 60;

type Params = { params: { containerNo: string } };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return error("请上传派送表 Excel（字段名 file）", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseContainerUploadBuffer(
      params.containerNo,
      buffer,
      file.name,
      BigInt(user.id),
    );

    return success(result);
  } catch (err) {
    console.error("[parse-upload]", err);
    return error(err instanceof Error ? err.message : "解析失败", 500);
  }
}
