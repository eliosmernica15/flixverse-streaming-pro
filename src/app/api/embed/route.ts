import { NextRequest, NextResponse } from "next/server";
import { isAllowedEmbedUrl } from "@/lib/streamingSources";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

/**
 * Injected at the top of proxied embed HTML to block popups, tab hijacks,
 * and top-window redirects from third-party ad scripts.
 */
const GUARD_SCRIPT = `<script>(function(){
  var noop=function(){return{closed:false,focus:function(){},blur:function(){},close:function(){},postMessage:function(){}}};
  try{window.open=noop}catch(e){}
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a'):null;
    if(a&&a.target==='_blank'){e.preventDefault();e.stopPropagation()}
  },true);
  document.addEventListener('submit',function(e){e.preventDefault()},true);
  try{
    var loc=window.location;
    if(loc.assign){var oa=loc.assign.bind(loc);loc.assign=function(u){if(String(u).indexOf(location.origin)===0)oa(u)}}
    if(loc.replace){var or=loc.replace.bind(loc);loc.replace=function(u){if(String(u).indexOf(location.origin)===0)or(u)}}
  }catch(e){}
})();</script>`;

/**
 * Provider-side sandbox-detection scripts we strip from the proxied HTML
 * (defence in depth). These scripts redirect the inner page to a
 * "This content is blocked" body when they detect the embed parent
 * has a `sandbox` attribute or an opaque origin. When the page is
 * served through our same-origin proxy those conditions should not
 * apply, but stripping the script entirely removes any chance of a
 * false positive and also defeats a future regression.
 */
const ANTI_EMBED_PATTERNS: RegExp[] = [
  // vidsrcme.ru's sbx.js (self-executing IIFE, contains the literal
  // "sandbox.php" / "Sandbox-embed blocker" text).
  /<script[^>]*src=["'][^"']*sbx\.js[^"']*["'][^>]*>\s*<\/script>/gi,
  /<script[^>]*>\s*\/\*\*[\s\S]*?Sandbox-embed blocker[\s\S]*?<\/script>/gi,
  // Any inline or external script that explicitly redirects to /sandbox.php.
  /<script[^>]*>[^<]*location\.(?:replace|href)\s*=\s*['"]\/sandbox\.php[^<]*<\/script>/gi,
  // The "/sandbox.php" reference in a <link rel="preload"> or similar
  // (rare but cheap to strip too).
  /<link[^>]*href=["']\/sandbox\.php[^"']*["'][^>]*>/gi,
];

function stripAntiEmbedScripts(html: string): string {
  let out = html;
  for (const pattern of ANTI_EMBED_PATTERNS) {
    out = out.replace(pattern, "");
  }
  return out;
}

function rewriteRelativeUrls(html: string, baseOrigin: string): string {
  let out = html
    .replace(/(href|src)=(["'])\/(?!\/)/g, `$1=$2${baseOrigin}/`)
    .replace(/(href|src)=(["'])(?!https?:|\/\/|data:|blob:|#|mailto:)/g, `$1=$2${baseOrigin}/`);
  // Media attributes the base regex misses: video poster, lazy-load
  // data-src, and srcset. Without this they resolve against OUR origin
  // (/api/embed) and 404 as e.g. `/hTNA....jpg` on flixverse instead of the
  // provider. Only rewrite the first srcset candidate to keep it simple.
  out = out
    .replace(/(poster|data-src)=(["'])\/(?!\/)/g, `$1=$2${baseOrigin}/`)
    .replace(/(poster|data-src)=(["'])(?!https?:|\/\/|data:|blob:|#)/g, `$1=$2${baseOrigin}/`)
    .replace(/srcset=(["'])\/(?!\/)/g, `srcset=$1${baseOrigin}/`)
    .replace(/url\(\s*\/(?!\/)/g, `url(${baseOrigin}/`);
  return out;
}

/** Hard cap on proxied HTML. Provider player pages are ~100–500 KB. */
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 12_000;

export async function GET(request: NextRequest) {
  const limit = await rateLimitByIp(request, "embed", 60, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  // This route renders third-party HTML on our origin. Only allow it to be
  // framed by us, and only from a same-site navigation context — without
  // these a hostile page could embed our proxy in an invisible frame and
  // drive the provider (session/CSRF amortization for ad fraud).
  if (request.headers.get("sec-fetch-dest") === "document") {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "same-site") {
      return NextResponse.json({ error: "Cross-site embed denied" }, { status: 403 });
    }
  }

  const src = request.nextUrl.searchParams.get("src");
  if (!src) {
    return NextResponse.json({ error: "Missing src parameter" }, { status: 400 });
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(src);
  } catch {
    return NextResponse.json({ error: "Invalid src encoding" }, { status: 400 });
  }

  if (!isAllowedEmbedUrl(targetUrl)) {
    return NextResponse.json({ error: "Provider not allowed" }, { status: 403 });
  }

  // Reject non-http(s) schemes outright (file:, data:, gopher: …).
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "Unsupported scheme" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Malformed URL" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const origin = new URL(targetUrl).origin;
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        Referer: origin,
      },
      redirect: "follow",
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";

    // Non-HTML responses (rare) — pass through as redirect
    if (!contentType.includes("text/html")) {
      return NextResponse.redirect(targetUrl);
    }

    // Bound the body: an unresponsive or hostile provider streaming an
    // infinite chunked response would otherwise hold the function open
    // until maxDuration and OOM the instance.
    const declaredLength = Number.parseInt(res.headers.get("content-length") || "", 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "Provider response too large" }, { status: 502 });
    }

    let html = await res.text();
    if (html.length > MAX_HTML_BYTES) html = html.slice(0, MAX_HTML_BYTES);
    html = stripAntiEmbedScripts(html);
    html = rewriteRelativeUrls(html, origin);

    if (html.includes("<head")) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${GUARD_SCRIPT}`);
    } else if (html.includes("<html")) {
      html = html.replace(/<html([^>]*)>/i, `<html$1><head>${GUARD_SCRIPT}</head>`);
    } else {
      html = GUARD_SCRIPT + html;
    }

    // NOTE: no <base> tag on purpose. A `<base href="https://provider/">`
    // violates our site-wide CSP (`base-uri 'self'`, applied by
    // next.config `headers()` to every route including /api/embed), so the
    // browser blocks it and relative sub-assets then resolve against OUR
    // origin and 404 (e.g. `/hTNA....jpg`). Absolute-rewriting above
    // already covers href/src/poster/srcset, so <base> is redundant.

    // CSP-driven framing instead of X-Frame-Options.
    //
    // `X-Frame-Options: SAMEORIGIN` was actively wrong here: this route's
    // whole purpose is to serve provider HTML *into an iframe*, and while
    // /api/embed is same-origin with us today, the header also blocks the
    // legitimate case where the proxy is served from an alternate origin
    // (preview deploys, custom domains) — the player would silently render
    // an empty frame. `frame-ancestors 'self'` expresses the actual intent
    // (only we may frame this) without breaking those deployments.
    //
    // `no-store` remains: the payload is live provider HTML with ad scripts
    // amended in, and caching it would pin a stale player across deploys.
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "frame-ancestors 'self'",
        "Cache-Control": "no-store",
        "X-Embed-Provider": new URL(targetUrl).hostname,
        "X-Embed-Source": targetUrl,
      },
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    console.error(aborted ? "Embed proxy timed out:" : "Embed proxy error:", err);
    return NextResponse.json(
      { error: aborted ? "Provider timed out. Try another server." : "Failed to load embed. Try another server." },
      { status: aborted ? 504 : 502, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const runtime = "nodejs";
