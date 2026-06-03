/**
 * Next.js 中间件 - 路由守卫
 *
 * 在每个请求到达页面或 API 之前执行，实现认证拦截。
 * 核心逻辑：
 * 1. 公开路径（/login、登录/登出 API）直接放行
 * 2. API 请求：检查 Cookie 中是否有有效的 Access Token，无则返回 401
 * 3. 页面请求：
 *    - 已登录用户访问 /login → 重定向到 /google-sheet
 *    - 未登录用户访问其他页面 → 重定向到 /login（附带 redirect 参数）
 *
 * 注意：middleware 运行在 Edge Runtime，不能使用 Node.js API（如 Prisma）
 */
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth";

/** 不需要认证的公开路径 */
const publicPaths = [
  "/login",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/gmail/callback",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  const isPublic = publicPaths.some((path) => pathname.startsWith(path));
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (pathname.startsWith("/api/")) {
    if (isPublic) return NextResponse.next();
    if (!token) {
      return NextResponse.json({ code: 401, message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (token) {
      return NextResponse.redirect(new URL("/google-sheet", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/containers" || pathname.startsWith("/containers/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/containers/, "/google-sheet");
    return NextResponse.redirect(url);
  }

  if (
    pathname === "/cargo" ||
    pathname.startsWith("/cargo/") ||
    pathname === "/customers" ||
    pathname.startsWith("/customers/")
  ) {
    return NextResponse.redirect(new URL("/google-sheet", request.url));
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
