import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PYTHON_API = (process.env.PYTHON_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function proxy(request: NextRequest, path: string) {
  const url = `${PYTHON_API}/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const res = await fetch(url, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    console.error("[api/py] proxy error:", err);
    return NextResponse.json(
      { error: "Python API unavailable. Start backend: npm run api" },
      { status: 503 }
    );
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path.join("/"));
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path.join("/"));
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path.join("/"));
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path.join("/"));
}
