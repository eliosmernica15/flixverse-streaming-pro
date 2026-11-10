import { NextRequest, NextResponse } from "next/server";
import { callPythonJson } from "@/app/api/_lib/pythonOrigin";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import { z } from "zod";

export const runtime = "nodejs";

const cancelSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500),
  details: z.string().max(2000).optional(),
});

interface CancelResponse {
  success: boolean;
  message: string;
  cancelsAt: number | null;
}

export async function POST(request: NextRequest) {
  const limit = await rateLimitByIp(request, "billing-cancel", 10, "1 h");
  if (!limit.success) return rateLimitResponse(limit);

  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await callPythonJson<CancelResponse>(request, "/subscription/cancel", {
      method: "POST",
      body: JSON.stringify({
        reason: parsed.data.reason,
        details: parsed.data.details,
      }),
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error || "Failed to cancel subscription" },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}