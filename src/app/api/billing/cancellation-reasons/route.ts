import { NextRequest, NextResponse } from "next/server";
import { callPythonJson } from "@/app/api/_lib/pythonOrigin";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

export const runtime = "nodejs";

interface CancellationReason {
  id: string;
  userId: string;
  stripeSubscriptionId: string | null;
  reason: string;
  details: string | null;
  createdAt: number;
}

interface CancellationReasonsResponse {
  cancellationReasons: CancellationReason[];
}

export async function GET(request: NextRequest) {
  const limit = await rateLimitByIp(request, "billing-cancellation-reasons", 20, "1 h");
  if (!limit.success) return rateLimitResponse(limit);

  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await callPythonJson<CancellationReasonsResponse>(request, "/subscription/cancellation-reasons");

    if (result.error) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch cancellation reasons" },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Fetch cancellation reasons error:", err);
    return NextResponse.json({ error: "Failed to fetch cancellation reasons" }, { status: 500 });
  }
}