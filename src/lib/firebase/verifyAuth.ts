import type { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { ensureAdminApp } from "@/lib/firebase/admin";

export interface VerifiedUser {
  uid: string;
  email?: string;
}

/** Verify Firebase ID token from Authorization: Bearer header. */
export async function verifyAuthHeader(
  request: NextRequest
): Promise<VerifiedUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!ensureAdminApp()) return null;

  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
