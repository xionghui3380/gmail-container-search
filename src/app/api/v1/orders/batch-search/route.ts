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

export const maxDuration = 300;

export async function POST(request: NextRequest) {
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
    return error("尚未连接 Gmail，请先授权", 401, { meta: { needReconnect: true } });
  }

  const body = await request.json();
  const orderIds: number[] = body.orderIds ?? [];
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return error("请选择至少一条订单", 400);
  }

  const results: Array<{
    orderId: number;
    status: "success" | "failed" | "skipped";
    itemCount?: number;
    errorMessage?: string;
  }> = [];

  for (const orderId of orderIds) {
    const id = Number(orderId);
    if (Number.isNaN(id)) {
      results.push({ orderId: id, status: "failed", errorMessage: "无效 ID" });
      continue;
    }
    try {
      const result = await parseOrderFromGmail(
        id,
        tokens.accessToken,
        tokens.refreshToken,
      );
      results.push({
        orderId: id,
        status: result.parseStatus === "failed" ? "failed" : "success",
        itemCount: result.itemCount,
        errorMessage: result.errorMessage,
      });
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      if (isGmailAuthError(msg)) {
        const response = error(
          "Gmail 授权已过期，已停止批量检索",
          401,
          { meta: { needReconnect: true } },
        );
        if (tokens.refreshed) {
          setGmailTokenCookies(response, tokens.accessToken, tokens.refreshToken);
        }
        return response;
      }
      results.push({ orderId: id, status: "failed", errorMessage: msg });
    }
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;

  const response = success(serialize({ results, succeeded, failed }));

  if (tokens.refreshed) {
    setGmailTokenCookies(response, tokens.accessToken, tokens.refreshToken);
  }
  return response;
}
