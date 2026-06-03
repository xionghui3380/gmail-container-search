/**
 * Gmail 邮件搜索接口
 * GET /api/v1/gmail/search?containerNo=EGSU6027772&sender=xxx@xxx.com
 */

import { NextRequest } from "next/server";
import { searchEmailsByContainer } from "@/lib/gmail";
import { requireUser } from "@/lib/require-user";
import { success, error } from "@/lib/api-response";
import {
  getErrorMessage,
  isGmailAuthError,
  resolveGmailTokens,
  setGmailTokenCookies,
} from "@/lib/gmail-tokens";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const { searchParams } = new URL(request.url);
  const containerNo = searchParams.get("containerNo")?.trim();
  const sender = searchParams.get("sender")?.trim();

  if (!containerNo) {
    return error("缺少柜号参数 containerNo", 400);
  }

  let tokens;
  try {
    tokens = await resolveGmailTokens(request);
  } catch (err: unknown) {
    console.error("[Gmail Search] Token 解析失败:", getErrorMessage(err));
    return error("Gmail 授权已过期，请重新连接 Gmail", 401, {
      meta: { needReconnect: true },
    });
  }

  if (!tokens) {
    return error("尚未连接 Gmail，请先点击「连接 Gmail」按钮进行授权", 401, {
      meta: { needReconnect: true },
    });
  }

  const defaultSender = process.env.GMAIL_DEFAULT_SENDER || "wenyang@ggtransport.in";

  try {
    const results = await searchEmailsByContainer(
      containerNo,
      sender || undefined,
      tokens.accessToken,
      tokens.refreshToken,
    );

    const response = success(results, {
      meta: {
        total: results.length,
        query: `from:${sender || defaultSender} ${containerNo}`,
      },
    });

    if (tokens.refreshed) {
      setGmailTokenCookies(response, tokens.accessToken, tokens.refreshToken);
    }

    return response;
  } catch (err: unknown) {
    const errMsg = getErrorMessage(err);
    if (isGmailAuthError(errMsg)) {
      return error("Gmail 授权已过期，请重新连接 Gmail", 401, {
        meta: { needReconnect: true },
      });
    }

    console.error("[Gmail Search] 搜索失败:", err);
    return error(`邮件搜索失败: ${errMsg}`, 500);
  }
}
