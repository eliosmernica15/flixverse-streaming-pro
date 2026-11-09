import { NextRequest, NextResponse } from "next/server";

// In-memory rate limit store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per hour per IP
const HONEYPOT_FIELD = "website"; // Hidden field that should remain empty

const MAX_SUBJECT = 200;
const MAX_EMAIL = 320;
const MAX_MESSAGE = 5000;

export async function POST(request: NextRequest) {
  try {
    cleanupRateLimitStore();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { subject, email, message, [HONEYPOT_FIELD]: website } = body as Record<string, unknown>;

    // Honeypot check - if filled, it's likely a bot
    if (typeof website === "string" && website.trim() !== "") {
      // Silently succeed but don't actually process
      return NextResponse.json({ success: true });
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

    // Rate limiting by IP
    const ip = request.headers.get("x-forwarded-for") ||
               request.headers.get("x-real-ip") ||
               "unknown";
    const key = `contact:${ip}`;

    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (record) {
      if (now < record.resetTime) {
        if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
          const retryAfter = Math.ceil((record.resetTime - now) / 1000);
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429, headers: { "Retry-After": retryAfter.toString() } }
          );
        }
        record.count++;
      } else {
        // Window expired, reset
        rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      }
    } else {
      rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    }

    // In production, send email via SendGrid, Resend, or similar
    // For now, we'll just log and simulate success
    console.log("[Contact Form] New submission:", {
      subject: cleanSubject,
      email: cleanEmail,
      message: cleanMessage.substring(0, 100) + (cleanMessage.length > 100 ? "..." : ""),
      ip,
      timestamp: new Date().toISOString(),
    });

    // Simulate processing delay
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

// Clean up old rate limit entries (called at the top of each request)
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}