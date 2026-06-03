/**
 * API 路由鉴权中间件
 *
 * 从请求 Cookie 中提取 JWT Token 并验证，返回当前登录用户信息。
 * 用于 API Route Handler（route.ts）中进行身份验证。
 *
 * 与 auth.ts 中的 getCurrentUser() 的区别：
 * - getCurrentUser() 使用 next/headers 的 cookies()，只能在 Server Component 中使用
 * - requireUser() 直接从 NextRequest 对象读取 Cookie，适合 API Route Handler
 *
 * 使用方式：
 *   const user = await requireUser(request);
 *   if (!user) return error("Unauthorized", 401);
 */
import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

/**
 * 从请求中提取并验证用户身份
 * @param request - Next.js 请求对象
 * @returns 用户信息，未登录或 Token 无效时返回 null
 */
export async function requireUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get("gng_access_token")?.value;
  if (!token) return null;
  try {
    const payload = await verifyToken(token, "access");
    return {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
