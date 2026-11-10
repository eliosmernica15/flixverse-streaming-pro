import { readFile } from "node:fs/promises";

const configFiles = [".env.example", ".github/workflows/ci.yml"];
const allowedPublicKeyNames = new Set([
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_RECAPTCHA_KEY",
  "NEXT_PUBLIC_FIREBASE_RECAPTCHA_V3_KEY",
]);
const sensitiveValuePatterns = [
  /\bsk_(?:live|test)_[A-Za-z0-9]+\b/,
  /\brk_(?:live|test)_[A-Za-z0-9]+\b/,
  /\bwhsec_[A-Za-z0-9]+\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const violations = [];

for (const file of configFiles) {
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:-\s*)?(NEXT_PUBLIC_[A-Z0-9_]+)\s*[:=]\s*(.*?)\s*$/);
    if (!match) continue;

    const [, name, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "");
    const unsafeName =
      !allowedPublicKeyNames.has(name) &&
      /(?:SECRET|PRIVATE|TOKEN|API_KEY|STRIPE|ABLY|UPSTASH|DATABASE|POSTGRES|TMDB)/i.test(name);
    const unsafeValue = sensitiveValuePatterns.some((pattern) => pattern.test(value));

    if (unsafeName || unsafeValue) {
      violations.push(`${file}:${index + 1}: ${name}`);
    }
  }
}

if (violations.length) {
  console.error("Sensitive values or credentials must not use NEXT_PUBLIC_ variables:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Public environment variable check passed.");
}
