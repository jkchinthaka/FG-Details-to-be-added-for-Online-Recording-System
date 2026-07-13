import { NextResponse, type NextRequest } from "next/server";
import { decideMiddlewareAction } from "@/lib/auth/middleware-logic";

export function middleware(request: NextRequest) {
  const decision = decideMiddlewareAction(request.nextUrl.pathname, (name) =>
    request.cookies.has(name),
  );

  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.url, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)",
  ],
};
