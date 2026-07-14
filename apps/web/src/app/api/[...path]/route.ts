import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_UPSTREAM = "http://localhost:3001";
const PROXY_TIMEOUT_MS = 30_000;

function resolveUpstreamBase(): string {
  const raw = (process.env.API_INTERNAL_URL ?? DEFAULT_UPSTREAM).trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    return `${url.origin}`;
  } catch {
    return DEFAULT_UPSTREAM;
  }
}

function buildUpstreamUrl(req: NextRequest, pathSegments: string[]): string {
  const base = resolveUpstreamBase();
  const path = pathSegments.map(encodeURIComponent).join("/");
  const search = req.nextUrl.search;
  return `${base}/${path}${search}`;
}

function collectSetCookie(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

async function proxyRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: pathSegments } = await context.params;
  if (!pathSegments?.length) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const upstreamUrl = buildUpstreamUrl(req, pathSegments);
  const method = req.method.toUpperCase();
  const headers = new Headers();

  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    body = await req.arrayBuffer();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const passThrough = [
      "content-type",
      "content-disposition",
      "cache-control",
      "www-authenticate",
      "x-request-id",
    ];
    for (const name of passThrough) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    // Auth and session responses must never be cached at the edge/browser.
    if (pathSegments[0] === "auth" || !responseHeaders.has("cache-control")) {
      responseHeaders.set("cache-control", "private, no-store");
    }

    const setCookies = collectSetCookie(upstream.headers);
    for (const value of setCookies) {
      responseHeaders.append("set-cookie", value);
    }

    if (method === "OPTIONS") {
      return new NextResponse(null, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted/i.test(error.message));
    return NextResponse.json(
      { message: aborted ? "Upstream timeout" : "Upstream unavailable" },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function OPTIONS(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}
