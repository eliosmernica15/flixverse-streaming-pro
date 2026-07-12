import { getFirebaseAuth } from "@/integrations/firebase/client";
import { getPythonHttpBase } from "@/lib/pythonApi/config";

async function getToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export class PythonApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function pythonFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  if (!token) throw new PythonApiError("Not signed in", 401);

  const base = getPythonHttpBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    throw new PythonApiError(err.detail || err.error || res.statusText, res.status);
  }

  return res.json() as Promise<T>;
}
