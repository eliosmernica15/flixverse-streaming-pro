import type { User } from "firebase/auth";
import { getAppCheckToken } from "@/integrations/firebase/client";

export async function getAuthHeaders(user: User): Promise<HeadersInit> {
  // `forceRefresh: true` makes the Firebase SDK reach out for a fresh id-token
  // rather than handing back a cached one that may have expired in the last
  // few seconds. Without this, a long-idle tab can fire requests with a stale
  // token and the Python backend (which verifies every token against Firebase)
  // will reject them with 401 even though the user is still signed in.
  const token = await user.getIdToken(true);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }

  return headers;
}
