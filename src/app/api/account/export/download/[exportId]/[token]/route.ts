import { NextRequest, NextResponse } from "next/server";
import { proxyToPython } from "@/app/api/_lib/pythonOrigin";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

export const runtime = "nodejs";

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

  // Proxy to Python API's download endpoint
  const res = await proxyToPython(
    request,
    `/account/export/download/${exportId}/${token}`,
    {
      method: "GET",
      passQuery: false,
    }
  );

  // Set Content-Disposition header for download
  const ident = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000"}/api/account/identity`, {
    headers: {
      Authorization: request.headers.get("Authorization") || "",
    },
  });
  let filename = `flixverse-export.json`;
  if (ident.ok) {
    const identData = await ident.json();
    const uid = identData.data?.uid ?? "user";
    filename = `flixverse-export-${uid}.json`;
  }

  res.headers.set("content-disposition", `attachment; filename="${filename}"`);
  return res;
}