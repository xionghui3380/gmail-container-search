import { NextRequest } from "next/server";
import { canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { parseOrderFromGmail } from "@/lib/order-parse-service";
import {
  getErrorMessage,
  isGmailAuthError,
  resolveGmailTokens,
  setGmailTokenCookies,
} from "@/lib/gmail-tokens";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

type Params = { params: { id: string } };

export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  const orderId = Number(params.id);
  if (Number.isNaN(orderId)) return error("无效 ID", 400);

  let tokens;
  try {
    tokens = await resolveGmailTokens(request);
  } catch {
    return error("Gmail 授权已过期", 401, { meta: { needReconnect: true } });
  }
  if (!tokens) {
    return error("尚未连接 Gmail，请先授权", 401, { meta: { needReconnect: true } });
  }

  try {
    const result = await parseOrderFromGmail(
      orderId,
      tokens.accessToken,
      tokens.refreshToken,
    );
    const response = success(serialize(result));
    if (tokens.refreshed) {
      setGmailTokenCookies(response, tokens.accessToken, tokens.refreshToken);
    }
    return response;
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    if (isGmailAuthError(msg)) {
      return error("Gmail 授权已过期", 401, { meta: { needReconnect: true } });
    }
    console.error("[orders search]", err);
    return error(msg, 500);
  }
}
