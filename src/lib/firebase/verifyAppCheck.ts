import type { NextRequest } from "next/server";
import { getAppCheck } from "firebase-admin/app-check";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Verify Firebase App Check token from X-Firebase-AppCheck header.
 * Returns true when App Check is not configured (graceful degradation in dev).
 */
export async function verifyAppCheckHeader(request: NextRequest): Promise<boolean> {
  const token = request.headers.get("x-firebase-appcheck");
  if (!token) {
    // Only enforce when ReCaptcha key is configured in production
    const enforce =
      process.env.NODE_ENV === "production" &&
      Boolean(process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_KEY);
    return !enforce;
  }

  if (!getAdminDb()) return true;

  try {
    await getAppCheck().verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

export async function requireAppCheck(request: NextRequest): Promise<boolean> {
  const ok = await verifyAppCheckHeader(request);
  return ok;
}
