import { NextRequest, NextResponse } from "next/server";
import { callPythonJson } from "@/app/api/_lib/pythonOrigin";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import { z } from "zod";

export const runtime = "nodejs";

const prorationPreviewSchema = z.object({
  newPlan: z.enum(["standard", "premium"]),
  newBillingPeriod: z.enum(["monthly", "yearly"]).optional(),
});

interface ProrationPreviewResponse {
  amount: number;
  currency: string;
  description: string;
  isUpgrade: boolean;
  nextPeriodStart: number;
  currentPlan: string;
  newPlan: string;
}

export async function POST(request: NextRequest) {
  const limit = await rateLimitByIp(request, "billing-proration-preview", 20, "1 h");
  if (!limit.success) return rateLimitResponse(limit);

  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = prorationPreviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await callPythonJson<ProrationPreviewResponse>(request, "/account/proration-preview", {
      method: "POST",
      body: JSON.stringify({
        newPlan: parsed.data.newPlan,
        newBillingPeriod: parsed.data.newBillingPeriod ?? "monthly",
      }),
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error || "Failed to get proration preview" },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Proration preview error:", err);
    return NextResponse.json({ error: "Failed to get proration preview" }, { status: 500 });
  }
}