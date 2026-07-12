/** Python SQLite API — no Firestore quota for notifications/parties. */

export function isPythonBackendEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_PYTHON_API === "true";
}

export function getPythonHttpBase(): string {
  if (typeof window === "undefined") {
    return process.env.PYTHON_API_URL || "http://127.0.0.1:8000";
  }
  return "/api/py";
}

export function getPythonWsBase(): string {
  const explicit = process.env.NEXT_PUBLIC_PYTHON_WS_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = process.env.NEXT_PUBLIC_PYTHON_WS_URL || "ws://127.0.0.1:8000";
    return host.replace(/\/$/, "");
  }
  return "ws://127.0.0.1:8000";
}
