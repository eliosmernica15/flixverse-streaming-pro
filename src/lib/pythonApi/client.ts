import { getFirebaseAuth, getAppCheckToken } from "@/integrations/firebase/client";
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

/** Thrown when the Python API is reached without a signed-in user. */
export class PythonAuthRequiredError extends Error {
  status: number = 401;
  constructor() {
    super("Not signed in");
    this.name = "PythonAuthRequiredError";
  }
}

/** True when the failure was only because there's no authenticated user. */
export function isPythonAuthError(err: unknown): boolean {
  if (err instanceof PythonAuthRequiredError) return true;
  if (err instanceof PythonApiError) {
    if (err.status !== 401) return false;
    const m = (err.message || "").toLowerCase();
    return (
      m === "not signed in" ||
      m.includes("unauthorized") ||
      m.includes("missing authorization") ||
      m.includes("invalid token") ||
      m.includes("invalid or revoked token")
    );
  }
  return false;
}

export async function pythonFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getPythonHttpBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const attempt = async (forceRefresh: boolean) => {
    const token = await getToken(forceRefresh);
    if (!token) throw new PythonAuthRequiredError();

    // Best-effort App Check header for monitor-mode verification server-side.
    const appCheckToken = await getAppCheckToken();

    const res = await fetch(url, {
      ...options,
      // Bound hanging Python invocations (cold start / Postgres stall) so
      // callers fail fast into their backoff instead of piling up sockets
      // until the browser reports ERR_INSUFFICIENT_RESOURCES.
      signal: options.signal ?? AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
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
