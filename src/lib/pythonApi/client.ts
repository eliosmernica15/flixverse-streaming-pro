import { getFirebaseAuth } from "@/integrations/firebase/client";
import { getPythonHttpBase } from "@/lib/pythonApi/config";

async function getToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
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
  const base = getPythonHttpBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const attempt = async (forceRefresh: boolean) => {
    const token = await getToken(forceRefresh);
    if (!token) throw new PythonApiError("Not signed in", 401);

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
  };

  try {
    return await attempt(false);
  } catch (err) {
    if (err instanceof PythonApiError && err.status === 401) {
      return await attempt(true);
    }
    throw err;
  }
}
