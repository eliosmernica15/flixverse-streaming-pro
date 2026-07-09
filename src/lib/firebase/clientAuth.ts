import type { User } from "firebase/auth";
import { getAppCheckToken } from "@/integrations/firebase/client";

export async function getAuthHeaders(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
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
