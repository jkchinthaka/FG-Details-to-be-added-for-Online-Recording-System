import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  REQUEST_ID_HEADER,
  buildApiErrorEnvelope,
  isValidRequestId,
} from "@nelna/shared";
import {
  PRODUCTION_RENDER_API_ORIGIN,
  assertProductionApiInternalUrl,
  normalizeApiInternalUrl,
} from "@/lib/proxy/api-internal-url";

export const dynamic = "force-dynamic";

const PROXY_TIMEOUT_MS = 30_000;
const UPLOAD_PROXY_TIMEOUT_MS = 120_000;

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

function resolveRequestId(req: NextRequest): string {
  const incoming = req.headers.get(REQUEST_ID_HEADER);
  return isValidRequestId(incoming) ? incoming!.trim() : randomUUID();
}

function proxyError(
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
): NextResponse {
  return NextResponse.json(
    buildApiErrorEnvelope({
      statusCode,
      code,
      message,
      requestId,
      retryable: statusCode === 502 || statusCode === 503 || statusCode === 504,
    }),
    {
      status: statusCode,
      headers: { [REQUEST_ID_HEADER]: requestId },
    },
  );
}

async function proxyRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const requestId = resolveRequestId(req);
  try {
    const { path: pathSegments } = await context.params;
    if (!pathSegments?.length) {
      return proxyError(404, "NOT_FOUND", "Not found", requestId);
    }

    let upstreamUrl: string;
    try {
      upstreamUrl = buildUpstreamUrl(req, pathSegments);
    } catch {
      return proxyError(
        503,
        "PROXY_MISCONFIGURED",
        "API proxy is misconfigured",
        requestId,
      );
    }

    const method = req.method.toUpperCase();
    const headers = new Headers();
    headers.set(REQUEST_ID_HEADER, requestId);
    headers.set("x-nelna-edge-proxy", "1");

    const cookie = req.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);

    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    const accept = req.headers.get("accept");
    if (accept) headers.set("accept", accept);

    const authorization = req.headers.get("authorization");
    if (authorization) headers.set("authorization", authorization);

    // Forward CSRF / mutation metadata from the browser.
    for (const name of ["origin", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"]) {
      const value = req.headers.get(name);
      if (value) headers.set(name, value);
    }

    const hasBody = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    const isMultipart = (contentType ?? "").toLowerCase().startsWith("multipart/");

    let body: BodyInit | undefined;
    let duplex: "half" | undefined;
    if (hasBody) {
      if (isMultipart && req.body) {
        body = req.body as unknown as ReadableStream<Uint8Array>;
        duplex = "half";
      } else {
        body = await req.arrayBuffer();
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      isMultipart ? UPLOAD_PROXY_TIMEOUT_MS : PROXY_TIMEOUT_MS,
    );

    try {
      const upstream = await fetch(upstreamUrl, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        ...(duplex ? { duplex } : {}),
      } as RequestInit & { duplex?: "half" });

      const responseHeaders = new Headers();
      const passThrough = [
        "content-type",
        "content-disposition",
        "cache-control",
        "www-authenticate",
        REQUEST_ID_HEADER,
      ];
      for (const name of passThrough) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      if (!responseHeaders.has(REQUEST_ID_HEADER)) {
        responseHeaders.set(REQUEST_ID_HEADER, requestId);
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
      return proxyError(
        aborted ? 504 : 502,
        aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
        aborted ? "Upstream timeout" : "Upstream unavailable",
        requestId,
      );
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return proxyError(500, "PROXY_HANDLER_FAILURE", "Proxy handler failure", requestId);
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
