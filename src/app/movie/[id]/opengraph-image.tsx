import { ImageResponse } from "next/og";
import { getCachedTmdbSeoContent, tmdbBackdropUrl } from "@/lib/seo/tmdb-server";
import { SITE_NAME } from "@/lib/seo/metadata";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

export default async function MovieOpenGraphImage({ params, searchParams }: Props) {
  const { id } = await params;
  const { type } = await searchParams;
  const mediaType = type === "tv" ? "tv" : "movie";
  let content = await getCachedTmdbSeoContent(Number(id), mediaType);
  if (!content && !type) {
    content = await getCachedTmdbSeoContent(Number(id), mediaType === "movie" ? "tv" : "movie");
  }

  const title = content?.title ?? "Watch Online";
  const backdrop = tmdbBackdropUrl(content?.backdrop_path ?? content?.poster_path ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          background: "#0a0a0a",
        }}
      >
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdrop}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.55,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.7) 100%)",
          }}
        />
        <div style={{ position: "relative", padding: 56, display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontSize: 22, color: "#ef4444", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
            {SITE_NAME}
          </span>
          <span style={{ fontSize: 52, fontWeight: 900, color: "white", lineHeight: 1.1, maxWidth: 1000 }}>
            {title}
          </span>
          <span style={{ fontSize: 24, color: "#d1d5db" }}>Stream free in HD</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
