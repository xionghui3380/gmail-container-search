import { NextRequest } from "next/server";
import { z } from "zod";
import { canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { parseContainerAttachment } from "@/lib/container-parse-service";
import {
  getErrorMessage,
  isGmailAuthError,
  resolveGmailTokens,
  setGmailTokenCookies,
} from "@/lib/gmail-tokens";
import { requireUser } from "@/lib/require-user";

export const maxDuration = 60;

type Params = { params: { containerNo: string } };

const bodySchema = z.object({
  messageId: z.string().min(1, "缺少 messageId"),
  attachmentId: z.string().min(1, "缺少 attachmentId"),
  attachmentName: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  let tokens;
  try {
    tokens = await resolveGmailTokens(request);
  } catch {
    return error("Gmail 授权已过期", 401, { meta: { needReconnect: true } });
  }
  if (!tokens) {
    return error("尚未连接 Gmail", 401, { meta: { needReconnect: true } });
  }

  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const result = await parseContainerAttachment(
      params.containerNo,
      parsed.data.messageId,
      parsed.data.attachmentId,
      parsed.data.attachmentName ?? "attachment.xlsx",
      BigInt(user.id),
      tokens.accessToken,
      tokens.refreshToken,
    );

    const response = success(result);
    if (tokens.refreshed) {
      setGmailTokenCookies(response, tokens.accessToken, tokens.refreshToken);
    }
    return response;
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    if (isGmailAuthError(msg)) {
      return error("Gmail 授权已过期", 401, { meta: { needReconnect: true } });
    }
    console.error("[parse-attachment]", err);
    return error(msg, 500);
  }
}
