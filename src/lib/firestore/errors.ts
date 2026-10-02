export function isFirestoreQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: string }).code) : "";
  const message = err instanceof Error ? err.message : String(err);
  return code === "resource-exhausted" || message.includes("Quota exceeded");
}

export function firestoreErrorMessage(err: unknown): string {
  if (isFirestoreQuotaError(err)) {
    return "Firestore daily quota reached. Party features will work again after the quota resets (usually midnight Pacific). Try again later.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
