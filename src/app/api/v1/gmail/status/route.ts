/**
 * Gmail 连接状态接口
 * GET /api/v1/gmail/status
 */

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/require-user";
import { success, error } from "@/lib/api-response";
import { getGmailTokens } from "@/lib/gmail-tokens";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const { accessToken, refreshToken } = getGmailTokens(request);

  return success({
    connected: Boolean(accessToken || refreshToken),
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    defaultSender: process.env.GMAIL_DEFAULT_SENDER || "wenyang@ggtransport.in",
  });
}
