/**
 * Gmail OAuth 回调接口
 * GET /api/v1/gmail/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/gmail";
import { setGmailTokenCookies, getErrorMessage } from "@/lib/gmail-tokens";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/google-sheet?gmail_error=${encodeURIComponent(oauthError)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/google-sheet?gmail_error=missing_code", request.url),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const response = NextResponse.redirect(
      new URL("/google-sheet?gmail_connected=true", request.url),
    );

    setGmailTokenCookies(
      response,
      tokens.access_token,
      tokens.refresh_token,
    );

    return response;
  } catch (err: unknown) {
    console.error("[Gmail Callback] Token 交换失败:", getErrorMessage(err));
    return NextResponse.redirect(
      new URL(
        `/google-sheet?gmail_error=${encodeURIComponent(getErrorMessage(err))}`,
        request.url,
      ),
    );
  }
}
