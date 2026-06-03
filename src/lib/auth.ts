/**
 * JWT 认证与授权工具
 *
 * 使用 jose 库实现 JWT Token 的签发、验证和用户信息提取。
 * 支持 Access Token（短期，15 分钟）和 Refresh Token（长期，7 天）双 Token 机制。
 * 同时提供基于角色的权限判断函数（canWrite / canDelete）。
 *
 * 核心流程：
 * 1. 登录 → signAccessToken() + signRefreshToken() → 写入 Cookie
 * 2. 请求 → middleware 检查 Cookie → 放行或拦截
 * 3. API → requireUser() 从 Cookie 解析用户信息
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { user_role } from "@prisma/client";

/** Cookie 名称常量 */
export const ACCESS_COOKIE = "gng_access_token";
export const REFRESH_COOKIE = "gng_refresh_token";

/** 认证用户信息类型（与 JWT payload 对应） */
export type AuthUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: user_role;
};

/** JWT Token 的完整载荷类型 */
type TokenPayload = AuthUser & {
  type: "access" | "refresh";
};

/**
 * 获取 JWT 签名密钥
 * 密钥从环境变量 JWT_SECRET 读取，必须 >= 32 字符
 */
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

/**
 * 解析过期时间配置
 * 支持格式：30s / 15m / 24h / 7d，会转换为秒数
 * @param value - 环境变量值
 * @param fallback - 默认值
 */
function parseExpires(value: string | undefined, fallback: string) {
  const raw = value ?? fallback;
  const match = raw.match(/^(\d+)([smhd])$/);
  if (!match) return raw;
  const amount = Number(match[1]);
  const unit = match[2];
  const map: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return `${amount * map[unit]}s`;
}

/**
 * 签发 Access Token（短期令牌，默认 15 分钟）
 * @param user - 用户信息
 * @returns JWT 字符串
 */
export async function signAccessToken(user: AuthUser) {
  return new SignJWT({ ...user, type: "access" satisfies TokenPayload["type"] })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(parseExpires(process.env.JWT_ACCESS_EXPIRES, "15m"))
    .sign(getSecret());
}

/**
 * 签发 Refresh Token（长期令牌，默认 7 天）
 * @param user - 用户信息
 * @returns JWT 字符串
 */
export async function signRefreshToken(user: AuthUser) {
  return new SignJWT({ ...user, type: "refresh" satisfies TokenPayload["type"] })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(parseExpires(process.env.JWT_REFRESH_EXPIRES, "7d"))
    .sign(getSecret());
}

/**
 * 验证 JWT Token
 * @param token - JWT 字符串
 * @param type - 期望的 Token 类型（access 或 refresh）
 * @returns 解析后的 Token 载荷
 * @throws Token 无效或类型不匹配时抛出异常
 */
export async function verifyToken(token: string, type: TokenPayload["type"]) {
  const { payload } = await jwtVerify<TokenPayload>(token, getSecret());
  if (payload.type !== type) {
    throw new Error("Invalid token type");
  }
  return payload;
}

/**
 * 从 Cookie 中获取当前登录用户信息（Server Component 专用）
 * 通过读取 Access Token Cookie 并验证 JWT 来提取用户信息
 * @returns 用户信息，未登录返回 null
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
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

/**
 * 设置认证 Cookie（登录成功后调用）
 * @param accessToken - Access Token 字符串
 * @param refreshToken - Refresh Token 字符串
 * @param remember - 是否"记住我"（影响 Refresh Token 有效期）
 */
export function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  remember = false,
) {
  const cookieStore = cookies();
  const accessMaxAge = 15 * 60;
  const refreshMaxAge = remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;

  cookieStore.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });

  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });
}

/** 清除认证 Cookie（退出登录时调用） */
export function clearAuthCookies() {
  const cookieStore = cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

/** 判断角色是否有写权限（admin / operator） */
export function canWrite(role: user_role) {
  return role === "admin" || role === "operator";
}

/** 判断角色是否有删除权限（admin / operator） */
export function canDelete(role: user_role) {
  return role === "admin" || role === "operator";
}
