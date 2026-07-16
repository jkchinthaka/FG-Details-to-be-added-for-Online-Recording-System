import { NextResponse, type NextRequest } from "next/server";
import { decideVerifiedMiddlewareAction } from "@/lib/auth/middleware-logic";
import {
  isApiProxyPath,
  isChangePasswordPath,
  isPublicAppPath,
} from "@/lib/auth/route-access";
import { verifySessionFromCookieHeader } from "@/lib/auth/verify-session";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import { buildLoginRedirectUrl } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isApiProxyPath(pathname)) {
    return NextResponse.next();
  }

  // Fully public marketing/auth entry pages (not change-password).
  if (isPublicAppPath(pathname) && !isChangePasswordPath(pathname)) {
    return NextResponse.next();
  }

  const hasAnyAuthCookie =
    request.cookies.has(AUTH_COOKIE_NAMES.accessToken) ||
    request.cookies.has(AUTH_COOKIE_NAMES.refreshToken);

  if (!hasAnyAuthCookie) {
    if (isChangePasswordPath(pathname)) {
      return NextResponse.redirect(new URL(buildLoginRedirectUrl(pathname), request.url));
    }
    return NextResponse.redirect(new URL(buildLoginRedirectUrl(pathname), request.url));
  }

  const cookieHeader = request.headers.get("cookie");
  let verification: Awaited<ReturnType<typeof verifySessionFromCookieHeader>>;
  try {
    verification = await verifySessionFromCookieHeader(cookieHeader);
  } catch {
    return NextResponse.redirect(
      new URL(buildLoginRedirectUrl(pathname, "session-expired"), request.url),
    );
  }

  const decision = decideVerifiedMiddlewareAction(pathname, verification.session);
  if (decision.action === "redirect") {
    const response = NextResponse.redirect(new URL(decision.url, request.url));
    for (const header of verification.setCookieHeaders) {
      response.headers.append("Set-Cookie", header);
    }
    return response;
  }

  const response = NextResponse.next();
  for (const header of verification.setCookieHeaders) {
    response.headers.append("Set-Cookie", header);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|release-manifest.json).*)",
  ],
};
