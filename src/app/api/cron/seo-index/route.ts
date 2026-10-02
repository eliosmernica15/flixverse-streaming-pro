import { NextResponse } from "next/server";
import {
  collectPublicUrls,
  pingSitemapToSearchEngines,
  submitUrlsToIndexNow,
} from "@/lib/seo/indexnow";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const urls = await collectPublicUrls();
    const indexNow = await submitUrlsToIndexNow(urls);
    await pingSitemapToSearchEngines();

    return NextResponse.json({
      ok: true,
      urlsSubmitted: indexNow.submitted,
      indexNow: indexNow.results,
      sitemapPinged: true,
      at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
