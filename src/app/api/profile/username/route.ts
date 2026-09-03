import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import { proxyToPython } from "@/app/api/_lib/pythonOrigin";

export const runtime = "nodejs";

/**
 * Username routes — proxy to the Python API.
 *
 *   GET ?username=<handle>  → GET /profile/username/<handle>    (availability)
 *   GET ?q=<prefix>         → GET /profile/username/search?q=   (search)
 *   HEAD ?username=<handle> → GET  /profile/username/<handle>   (legacy)
 *   POST { username }       → POST /profile/username            (claim)
 */
export async function GET(request: NextRequest) {
  const usernameCheck = request.nextUrl.searchParams.get("username");
  if (usernameCheck !== null) {
    const limit = await rateLimitByIp(request, "username-check", 120, "1 m");
    if (!limit.success) return rateLimitResponse(limit);

    // The Python API returns 404 for an unknown handle and 200
    // `{ uid, displayName, owned }` for a known one. The front-end expects
    // `{ available: true|false, owned?: true }` with a 409 conflict status
    // for taken handles. Translate here.
    const res = await proxyToPython(
      request,
      `/profile/username/${encodeURIComponent(usernameCheck.toLowerCase())}`
    );
    if (res.status === 404) {
      return NextResponse.json({ available: true });
    }
    if (res.status === 200) {
      const text = await res.text();
      let parsed: { owned?: boolean; uid?: string; displayName?: string } = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      if (parsed.owned) {
        return NextResponse.json({ available: true, owned: true });
      }
      return NextResponse.json({ available: false }, { status: 409 });
    }
    return res;
  }

  const limit = await rateLimitByIp(request, "username-search", 60, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  return proxyToPython(request, "/profile/username/search");
}

export async function HEAD(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("username") ?? "";
  if (!/^[a-z0-9_]{3,30}$/i.test(raw)) {
    return new NextResponse(null, { status: 400 });
  }
  const res = await proxyToPython(
    request,
    `/profile/username/${encodeURIComponent(raw.toLowerCase())}`
  );
  return new NextResponse(null, { status: res.status });
}

export async function POST(request: NextRequest) {
  const limit = await rateLimitByIp(request, "username-claim", 10, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  let body: { username?: string; handle?: string };
  try {
    body = (await request.json()) as { username?: string; handle?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // The front-end sends `{ username }`; the Python API expects `{ handle }`.
  // Translate here so the Python contract stays clean and aligned with the
  // other Python routes.
  const handle = (body.handle ?? body.username ?? "").toString();
  const res = await proxyToPython(
    request,
    "/profile/username",
    {
      method: "POST",
      body: JSON.stringify({ handle }),
      passQuery: false,
    }
  );
  // The Python API returns `{ ok, handle }`; the front-end
  // (`UsernameSettings.tsx`) reads `{ username }`. Translate the field so
  // the existing client contract keeps working unchanged.
  const text = await res.text();
  let parsed: { handle?: string; ok?: boolean } = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  const payload = JSON.stringify({ username: parsed.handle ?? handle, ok: parsed.ok ?? true });
  return new NextResponse(payload, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
