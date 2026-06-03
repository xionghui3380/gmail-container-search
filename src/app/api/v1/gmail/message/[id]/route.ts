/**
 * Gmail 邮件详情接口（含 Excel 附件解析）
 * GET /api/v1/gmail/message/{messageId}
 */

import { NextRequest } from "next/server";
import { getEmailDetail } from "@/lib/gmail";
import { requireUser } from "@/lib/require-user";
import { success, error } from "@/lib/api-response";
import {
  getErrorMessage,
  isGmailAuthError,
  resolveGmailTokens,
  setGmailTokenCookies,
} from "@/lib/gmail-tokens";

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const messageId = params.id;
  if (!messageId) {
    return error("缺少邮件 ID", 400);
  }

  let tokens;
  try {
    tokens = await resolveGmailTokens(request);
  } catch (err: unknown) {
    console.error("[Gmail Detail] Token 解析失败:", getErrorMessage(err));
    return error("Gmail 授权已过期，请重新连接 Gmail", 401, {
      meta: { needReconnect: true },
    });
  }

  if (!tokens) {
    return error("尚未连接 Gmail", 401, { meta: { needReconnect: true } });
  }

  try {
    const detail = await getEmailDetail(
      messageId,
      tokens.accessToken,
      tokens.refreshToken,
    );

    const response = success(detail);

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

    console.error("[Gmail Detail] 获取详情失败:", err);
    return error(`获取邮件详情失败: ${errMsg}`, 500);
  }
}
