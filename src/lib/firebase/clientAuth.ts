import type { User } from "firebase/auth";

export async function getAuthHeaders(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
