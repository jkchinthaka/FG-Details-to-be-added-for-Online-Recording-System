import { NextRequest, NextResponse } from "next/server";
import {
  ApiInternalUrlError,
  PRODUCTION_RENDER_API_ORIGIN,
  assertProductionApiInternalUrl,
  normalizeApiInternalUrl,
} from "@/lib/proxy/api-internal-url";

export const dynamic = "force-dynamic";

const PROXY_TIMEOUT_MS = 30_000;

function resolveUpstreamBaseSync(): string {
  const raw =
    process.env.API_INTERNAL_URL?.trim() ||
    (process.env.NODE_ENV === "production" ? PRODUCTION_RENDER_API_ORIGIN : "");

  if (process.env.NODE_ENV === "production") {
    return assertProductionApiInternalUrl(raw || PRODUCTION_RENDER_API_ORIGIN);
  }
  try {
    return normalizeApiInternalUrl(raw || "http://localhost:3001");
  } catch {
    return "http://localhost:3001";
  }
}

function buildUpstreamUrl(req: NextRequest, pathSegments: string[]): string {
  const base = resolveUpstreamBaseSync();
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
  try {
    const { path: pathSegments } = await context.params;
    if (!pathSegments?.length) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    let upstreamUrl: string;
    try {
      upstreamUrl = buildUpstreamUrl(req, pathSegments);
    } catch (error) {
      return NextResponse.json(
        {
          message: "API proxy is misconfigured",
          code: "PROXY_MISCONFIGURED",
          detail: error instanceof ApiInternalUrlError ? error.code : "unknown",
        },
        { status: 503 },
      );
    }

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
        {
          message: aborted ? "Upstream timeout" : "Upstream unavailable",
          code: aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
        },
        { status: aborted ? 504 : 502 },
      );
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json(
      { message: "Proxy handler failure", code: "PROXY_HANDLER_FAILURE" },
      { status: 500 },
    );
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
