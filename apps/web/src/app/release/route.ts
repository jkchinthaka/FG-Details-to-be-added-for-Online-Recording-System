import { NextResponse } from "next/server";
import { loadWebReleaseManifest } from "@/lib/release/load-release-manifest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * FG-DEP-001 — Worker/frontend release manifest.
 * Same shape as API `/health/release`. Authoritative id is the Git commit SHA.
 */
export async function GET() {
  const manifest = loadWebReleaseManifest();
  if (!manifest) {
    return NextResponse.json(
      {
        code: "MISSING_SHA",
        message: "Release commit SHA is not configured for this frontend build",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(manifest, {
    status: 200,
    headers: { "cache-control": "public, max-age=60" },
  });
}
