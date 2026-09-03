import { NextRequest, NextResponse } from "next/server";
import { callPythonJson, proxyToPython } from "@/app/api/_lib/pythonOrigin";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

export const runtime = "nodejs";

interface IdentityResponse {
  uid: string;
  email: string | null;
  name: string | null;
}

/**
 * GET /api/account/export — GDPR data export.
 *
 * Proxies the request to the Python API's `/account/export` route and
 * surfaces the response with a `Content-Disposition: attachment` header so
 * browsers download it as a JSON file (matches the old Firestore behavior).
 */
export async function GET(request: NextRequest) {
  const limit = await rateLimitByIp(request, "account-export", 5, "1 h");
  if (!limit.success) return rateLimitResponse(limit);

  // Get the verified uid so we can put it in the download filename
  // (matches the old Firestore behavior: `flixverse-export-<uid>.json`).
  const ident = await callPythonJson<IdentityResponse>(request, "/account/identity");
  const uid = ident.data?.uid ?? "user";

  const res = await proxyToPython(request, "/account/export");
  res.headers.set(
    "content-disposition",
    `attachment; filename="flixverse-export-${uid}.json"`
  );
  return res;
}
