/**
 * Gmail OAuth 授权跳转接口
 * GET /api/v1/gmail/auth
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail";
import { requireUser } from "@/lib/require-user";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.redirect(new URL("/login?redirect=/google-sheet", request.url));
  }

  const authUrl = getAuthUrl(user.id);
  return NextResponse.redirect(authUrl);
}
