import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rulesPath = path.join(root, "firestore.rules");
const rules = fs.readFileSync(rulesPath, "utf8");

const required = [
  "rules_version = '2'",
  "function isAuthenticated()",
  "function isOwner",
  "match /profiles/{userId}",
  "match /reviews/{reviewId}",
  "match /timeline_comments/{commentId}",
  "match /flix_parties/{roomId}",
];

const forbidden = [
  "allow read, write: if true",
  "allow write: if true",
  "match /{document=**}",
];

let failed = false;

for (const snippet of required) {
  if (!rules.includes(snippet)) {
    console.error(`Missing required rule fragment: ${snippet}`);
    failed = true;
  }
}

for (const snippet of forbidden) {
  if (rules.includes(snippet)) {
    console.error(`Forbidden open rule found: ${snippet}`);
    failed = true;
  }
}

if (!rules.includes("allow create: if isAuthenticated()") && !rules.includes("allow create: if isOwner")) {
  console.error("No authenticated create rules found — check hardening");
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log("Firestore rules syntax checks passed.");
