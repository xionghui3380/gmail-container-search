import { NextRequest } from "next/server";
import { canWrite } from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import {
  getContainerParseResult,
  parseContainerEmail,
} from "@/lib/container-parse-service";
import { resolveGmailTokens, setGmailTokenCookies, getErrorMessage, isGmailAuthError } from "@/lib/gmail-tokens";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

type Params = { params: { containerNo: string } };

export async function GET(_request: NextRequest, { params }: Params) {
  const user = await requireUser(_request);
  if (!user) return error("未登录", 401);

  const container = await getContainerParseResult(params.containerNo);
  if (!container) return error("柜号不存在", 404);

  return success(serialize(container));
}

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
    const result = await parseContainerEmail(
      params.containerNo,
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
    console.error("[parse-email]", err);
    return error(msg, 500);
  }
}
