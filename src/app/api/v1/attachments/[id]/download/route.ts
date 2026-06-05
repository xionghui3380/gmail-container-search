import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachmentDownloadHeaders } from "@/lib/attachment-download";
import { error } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const attachmentId = Number(params.id);
  if (Number.isNaN(attachmentId)) return error("无效 ID", 400);

  const attachment = await prisma.attachments.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      attachment_name: true,
      file_content: true,
    },
  });

  if (!attachment) return error("附件不存在", 404);
  if (!attachment.file_content) {
    return error("附件文件未保存，请重新解析后再下载", 404);
  }

  return new NextResponse(Buffer.from(attachment.file_content), {
    headers: attachmentDownloadHeaders(attachment.attachment_name),
  });
}
