/** Python API — Vercel serverless in production, local uvicorn in dev. */

export function isPythonBackendEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_PYTHON_API === "true") return true;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith(".vercel.app") || host.includes("flixverse")) return true;
  }
  if (process.env.VERCEL === "1" && process.env.NODE_ENV === "production") return true;
  return false;
}

/** True when WebSockets are unavailable (Vercel serverless). Use HTTP polling instead. */
export function useHttpTransport(): boolean {
  if (process.env.NEXT_PUBLIC_PYTHON_HTTP_TRANSPORT === "true") return true;
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_VERCEL === "1") return true;
    if (window.location.hostname.endsWith(".vercel.app")) return true;
  }
  return process.env.VERCEL === "1";
}

export function getPythonHttpBase(): string {
  const explicit = process.env.NEXT_PUBLIC_PYTHON_HTTP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (typeof window === "undefined") {
    return (process.env.PYTHON_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  }

  if (
    process.env.NEXT_PUBLIC_VERCEL === "1" ||
    process.env.NODE_ENV === "production" ||
    window.location.hostname.endsWith(".vercel.app")
  ) {
    return "/api/flixverse";
  }

  return "http://127.0.0.1:8000";
}

export function getPythonWsBase(): string {
  if (useHttpTransport()) return "";

  const explicit = process.env.NEXT_PUBLIC_PYTHON_WS_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    return "ws://127.0.0.1:8000";
  }
  return "ws://127.0.0.1:8000";
}
