import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo/metadata";

export const alt = `${SITE_NAME} — Watch Free Movies & TV Shows Online`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a0505 40%, #0a0a0a 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(220,38,38,0.35) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* SVG mark — no dynamic font download needed */}
            <svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <path fill="#ffffff" d="M16 2 L18 12 L28 14 L18 16 L16 28 L14 16 L4 14 L14 12 Z" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: "white",
              letterSpacing: -2,
            }}
          >
            {SITE_NAME}
          </span>
        </div>
        <p
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: "#f3f4f6",
            lineHeight: 1.25,
            maxWidth: 900,
            margin: 0,
          }}
        >
          Watch Free Movies &amp; TV Shows Online in HD
        </p>
        <p
          style={{
            fontSize: 22,
            color: "#9ca3af",
            marginTop: 20,
            maxWidth: 800,
          }}
        >
          Trending films · Top-rated series · New releases · Personal watchlist
        </p>
      </div>
    ),
    { ...size }
  );
}
