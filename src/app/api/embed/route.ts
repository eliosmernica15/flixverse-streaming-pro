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

function rewriteRelativeUrls(html: string, baseOrigin: string): string {
  return html
    .replace(/(href|src)=(["'])\/(?!\/)/g, `$1=$2${baseOrigin}/`)
    .replace(/(href|src)=(["'])(?!https?:|\/\/|data:|blob:|#|mailto:)/g, `$1=$2${baseOrigin}/`);
}

export async function GET(request: NextRequest) {
  const limit = await rateLimitByIp(request, "embed", 60, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

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
    });

    const contentType = res.headers.get("content-type") || "";

    // Non-HTML responses (rare) — pass through as redirect
    if (!contentType.includes("text/html")) {
      return NextResponse.redirect(targetUrl);
    }

    let html = await res.text();
    html = rewriteRelativeUrls(html, origin);

    if (html.includes("<head")) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${GUARD_SCRIPT}`);
    } else if (html.includes("<html")) {
      html = html.replace(/<html([^>]*)>/i, `<html$1><head>${GUARD_SCRIPT}</head>`);
    } else {
      html = GUARD_SCRIPT + html;
    }

    // Add <base> so relative assets resolve against provider origin
    const baseTag = `<base href="${origin}/">`;
    html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "no-store",
        "X-Embed-Provider": new URL(targetUrl).hostname,
        "X-Embed-Source": targetUrl,
      },
    });
  } catch (err) {
    console.error("Embed proxy error:", err);
    return NextResponse.json(
      { error: "Failed to load embed. Try another server." },
      { status: 502 }
    );
  }
}

export const runtime = "nodejs";
