const MAX_SECURITY_AUDIT_ENTRIES = 50;
const STORAGE_KEY = "flixverse-security-audit";

interface AuditEntry {
  event: string;
  detail: string;
  at: number;
}

function loadEntries(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: AuditEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be disabled or full
  }
}

export function recordSecurityAudit(event: string, detail: string): void {
  const entries = loadEntries();
  const entry: AuditEntry = { event, detail, at: Date.now() };
  entries.push(entry);
  while (entries.length > MAX_SECURITY_AUDIT_ENTRIES) entries.shift();
  saveEntries(entries);
  console.warn("[security-audit]", entry);
}

export function getSecurityAuditLog(): AuditEntry[] {
  return loadEntries();
}

export function clearSecurityAuditLog(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
