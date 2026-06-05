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
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";

type Params = { params: { id: string } };

export const maxDuration = 120;

async function safeLog(data: {
  container_no: string;
  step: string;
  status: "success" | "failed" | "warning";
  message: string;
}) {
  try {
    await prisma.parse_logs.create({ data });
  } catch (e) {
    console.error("[parse_logs write failed]", e);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);
  if (!canWrite(user.role)) return error("权限不足", 403);

  const orderId = Number(params.id);
  if (Number.isNaN(orderId)) return error("无效 ID", 400);

  const order = await prisma.orders.findUnique({ where: { id: orderId } });
  if (!order) return error("订单不存在", 404);

  const containerNo = order.container_no.trim().toUpperCase();

  let tokens;
  try {
    tokens = await resolveGmailTokens(request);
  } catch {
    await safeLog({
      container_no: containerNo,
      step: "gmail_auth",
      status: "failed",
      message: "信息同步失败：Gmail 授权已过期",
    });
    return error("检索失败，具体信息请在【解析结果】中查看", 401, {
      meta: { needReconnect: true },
    });
  }
  if (!tokens) {
    await safeLog({
      container_no: containerNo,
      step: "gmail_auth",
      status: "failed",
      message: "信息同步失败：Gmail 未连接",
    });
    return error("检索失败，具体信息请在【解析结果】中查看", 401, {
      meta: { needReconnect: true },
    });
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
    await safeLog({
      container_no: containerNo,
      step: "parse_order",
      status: "failed",
      message: `信息同步失败：${msg}`,
    });
    console.error("[orders search]", err);
    if (isGmailAuthError(msg)) {
      return error("检索失败，具体信息请在【解析结果】中查看", 401, {
        meta: { needReconnect: true },
      });
    }
    return error("检索失败，具体信息请在【解析结果】中查看", 500);
  }
}
