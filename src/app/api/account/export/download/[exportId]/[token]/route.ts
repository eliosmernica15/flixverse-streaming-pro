import { NextRequest, NextResponse } from "next/server";
import { proxyToPython } from "@/app/api/_lib/pythonOrigin";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

export const runtime = "nodejs";

const EXPORT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
// URL tokens are base64url-ish; may contain dots (JWT-style) but never slashes or traversal
const TOKEN_RE = /^(?!\.{1,2}$)[A-Za-z0-9._~-]{1,512}$/;

/**
 * GET /api/account/export/download/[exportId]/[token] — Download GDPR export.
 *
 * Proxies the request to the Python API's `/account/export/download/{exportId}/{token}`
 * endpoint. The token is single-use and verified against a hash. After successful
 * download, the export record is deleted.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string; token: string }> }
) {
  const limit = await rateLimitByIp(request, "account-export-download", 10, "1 h");
  if (!limit.success) return rateLimitResponse(limit);

  const { exportId, token } = await params;
  if (!EXPORT_ID_RE.test(exportId) || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Invalid export link" }, { status: 400 });
  }

  // Proxy to Python API's download endpoint
  const res = await proxyToPython(
    request,
    `/account/export/download/${encodeURIComponent(exportId)}/${encodeURIComponent(token)}`,
    {
      method: "GET",
      passQuery: false,
    }
  );

  // Suggest a filename for the archive download
  res.headers.set("content-disposition", 'attachment; filename="flixverse-export.json"');
  return res;
}
