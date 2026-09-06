#!/usr/bin/env node
/**
 * Smoke test the live Python API at the production origin.
 *
 * Usage:
 *   node scripts/smoke-test-python.mjs
 *   BASE=https://flixverse-streaming-pro.vercel.app node scripts/smoke-test-python.mjs
 *   BEARER=eyJ... node scripts/smoke-test-python.mjs  # exercises the auth-required routes
 *
 * Hits a few public routes to confirm the serverless function is reachable,
 * then a few auth-required routes to confirm the FastAPI app is wired up and
 * Firebase id-token verification is the only thing gating them.
 *
 * Exits non-zero on any failure so you can chain it in CI.
 */

const BASE = (process.env.BASE || "https://flixverse-streaming-pro.vercel.app").replace(/\/$/, "");
const BEARER = process.env.BEARER || "";

const checks = [
  { name: "health (no auth)", path: "/api/flixverse/health", method: "GET", auth: false, expect: (_s, b) => b && (b.status === "ok" || b.status === "degraded") },
  { name: "profile/me (no token -> 401)", path: "/api/flixverse/profile/me", method: "GET", auth: false, expect: (s, b) => s === 401 || (b && b.detail) },
  { name: "account/identity (no token -> 401)", path: "/api/flixverse/account/identity", method: "GET", auth: false, expect: (s, b) => s === 401 || (b && b.detail) },
  { name: "account/identity (with token -> 200)", path: "/api/flixverse/account/identity", method: "GET", auth: true, expect: (s, b) => s === 200 && b && b.uid },
];

let pass = 0;
let fail = 0;

for (const check of checks) {
  const url = `${BASE}${check.path}`;
  const headers = { accept: "application/json" };
  if (check.auth) {
    if (!BEARER) {
      console.log(`SKIP  ${check.name}  — set BEARER=<firebase id-token> to run this check`);
      continue;
    }
    headers.authorization = `Bearer ${BEARER}`;
  }

  let status;
  let body;
  try {
    const res = await fetch(url, { method: check.method, headers });
    status = res.status;
    const text = await res.text();
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  } catch (err) {
    console.log(`FAIL  ${check.name}  — ${err.message || err}`);
    fail++;
    continue;
  }

  let ok = false;
  try { ok = check.expect(status, body); } catch { ok = false; }

  const tag = ok ? "PASS" : "FAIL";
  const bodyPreview = typeof body === "string"
    ? body.slice(0, 80)
    : JSON.stringify(body).slice(0, 80);
  console.log(`${tag}  ${check.name}  ${status}  ${bodyPreview}`);
  if (ok) pass++;
  else fail++;
}

console.log(`\n${pass} passed, ${fail} failed (BASE=${BASE})`);
process.exit(fail === 0 ? 0 : 1);
