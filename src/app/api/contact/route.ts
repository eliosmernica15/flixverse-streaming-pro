import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

const HONEYPOT_FIELD = "website"; // Hidden field that should remain empty

const MAX_SUBJECT = 200;
const MAX_EMAIL = 320;
const MAX_MESSAGE = 5000;

/**
 * Optional reCAPTCHA v3 verification. Only enforced when the secret is set on
 * the server; otherwise this is a no-op so local/dev environments keep working.
 */
async function verifyRecaptcha(token: unknown): Promise<boolean> {
  const secret = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;
  if (!secret) return true; // not configured — skip verification
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; score?: number };
    return data.success === true && (data.score === undefined || data.score >= 0.5);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // 5 messages per hour per IP (Upstash in prod, in-memory fallback otherwise)
  const limit = await rateLimitByIp(request, "contact", 5, "1 h");
  if (!limit.success) return rateLimitResponse(limit);

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { subject, email, message, recaptchaToken, [HONEYPOT_FIELD]: website } = body as Record<string, unknown>;

    // Honeypot check - if filled, it's likely a bot
    if (typeof website === "string" && website.trim() !== "") {
      // Silently succeed but don't actually process
      return NextResponse.json({ success: true });
    }

    // reCAPTCHA v3 (enforced only when GOOGLE_RECAPTCHA_SECRET_KEY is set)
    const recaptchaOk = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaOk) {
      return NextResponse.json({ error: "reCAPTCHA verification failed" }, { status: 403 });
    }

    // Validate required fields
    if (
      typeof subject !== "string" || typeof email !== "string" || typeof message !== "string" ||
      !subject.trim() || !email.trim() || !message.trim()
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const cleanSubject = subject.trim().slice(0, MAX_SUBJECT);
    const cleanEmail = email.trim().slice(0, MAX_EMAIL);
    const cleanMessage = message.trim().slice(0, MAX_MESSAGE);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // In production, send email via SendGrid, Resend, or similar
    console.log("[Contact Form] New submission:", {
      subject: cleanSubject,
      email: cleanEmail,
      message: cleanMessage.substring(0, 100) + (cleanMessage.length > 100 ? "..." : ""),
      timestamp: new Date().toISOString(),
    });

    // For now, forward server-side only; swap this for a Resend/SendGrid call when configured.
    await new Promise((resolve) => setTimeout(resolve, 500));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Contact Form] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}