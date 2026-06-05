import type { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/gmail";

const GMAIL_ACCESS_COOKIE = "gmail_access_token";
const GMAIL_REFRESH_COOKIE = "gmail_refresh_token";

type GmailTokenSet = {
  accessToken: string;
  refreshToken?: string;
  refreshed: boolean;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

export function getGmailTokens(request: NextRequest) {
  return {
    accessToken: request.cookies.get(GMAIL_ACCESS_COOKIE)?.value,
    refreshToken: request.cookies.get(GMAIL_REFRESH_COOKIE)?.value,
  };
}

export function setGmailTokenCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken?: string,
) {
  response.cookies.set(GMAIL_ACCESS_COOKIE, accessToken, cookieOptions(60 * 60));
  if (refreshToken) {
    response.cookies.set(GMAIL_REFRESH_COOKIE, refreshToken, cookieOptions(60 * 60 * 24 * 7));
  }
}

export async function resolveGmailTokens(
  request: NextRequest,
): Promise<GmailTokenSet | null> {
  const { accessToken, refreshToken } = getGmailTokens(request);

  if (accessToken) {
    return { accessToken, refreshToken, refreshed: false };
  }

  if (!refreshToken) {
    return null;
  }

  const credentials = await refreshAccessToken(refreshToken);
  if (!credentials.access_token) {
    return null;
  }

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token || refreshToken,
    refreshed: true,
  };
}

export function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function isGmailAuthError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("invalid_grant") ||
    lower.includes("invalid_credentials") ||
    lower.includes("unauthorized") ||
    lower.includes("401")
  );
}
