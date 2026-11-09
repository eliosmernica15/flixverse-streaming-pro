import type { JSX } from "react";
import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo/metadata";

export const runtime = "edge";

/** Only allow images from hosts we control/trust — the edge function fetches this URL server-side. */
const ALLOWED_IMAGE_HOSTS = new Set([
  "image.tmdb.org",
  "lh3.googleusercontent.com",
  "res.cloudinary.com",
  "firebasestorage.googleapis.com",
  "i.ytimg.com",
]);

function sanitizeImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function clip(raw: string | null, max: number): string | null {
  if (!raw) return null;
  return raw.length > max ? raw.slice(0, max) : raw;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Get parameters (clipped — these come straight from the URL)
  const title = clip(searchParams.get("title"), 150) || "Watch Free Movies & TV Shows";
  const description = clip(searchParams.get("description"), 300) || "Stream trending films, top-rated series, new releases on FlixVerse.";
  const type = clip(searchParams.get("type"), 20) || "website"; // movie, tv, person, collection
  const image = sanitizeImageUrl(searchParams.get("image")); // backdrop/poster URL
  const rating = clip(searchParams.get("rating"), 10);
  const year = clip(searchParams.get("year"), 10);
  const genres = clip(searchParams.get("genres"), 120);
  const season = clip(searchParams.get("season"), 4);
  const episode = clip(searchParams.get("episode"), 6);
  const episodeTitle = clip(searchParams.get("episodeTitle"), 150);
  const episodeOverview = clip(searchParams.get("episodeOverview"), 300);
  const personName = clip(searchParams.get("personName"), 100);
  const knownFor = clip(searchParams.get("knownFor"), 120);
  const collectionName = clip(searchParams.get("collectionName"), 100);
  const partCount = clip(searchParams.get("partCount"), 4);

  // Base styles
  const baseStyles: React.CSSProperties = {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: "linear-gradient(135deg, #0f0f0f 0%, #1a0a2e 50%, #0f0f0f 100%)",
    width: "1200",
    height: "630",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px",
    boxSizing: "border-box",
    color: "white",
    position: "relative",
    overflow: "hidden",
  };

  // Background decoration
  const backgroundDecoration = (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.15) 0%, transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, #ef4444, #a855f7, #3b82f6)",
        }}
      />
    </>
  );

  // Generate content based on type
  let content: JSX.Element;
  // (JSX namespace imported from react — React 19 types no longer provide a global JSX namespace)

  if (type === "movie" || type === "tv") {
    // Movie/TV Show OG Image
    content = (
      <div style={{
        display: "flex",
        flexDirection: "row",
        gap: "40px",
        maxWidth: "1080px",
        width: "100%",
        alignItems: "flex-start"
      }}>
        {/* Poster/Backdrop on left */}
        {image && (
          <div style={{
            flexShrink: 0,
            width: "240px",
            height: "360px",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "2px solid rgba(255,255,255,0.1)",
          }}>
            <img
              src={image}
              alt={title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        {/* Info on right */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Type badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(239, 68, 68, 0.2)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            padding: "6px 16px",
            borderRadius: "100px",
            fontSize: "14px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#fca5a5",
            width: "fit-content",
            marginBottom: "16px"
          }}>
            <span style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#ef4444",
              animation: "pulse 2s infinite"
            }} />
            {type === "tv" ? "TV Series" : "Movie"}
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: "52px",
            fontWeight: 800,
            lineHeight: 1.1,
            margin: "0 0 12px 0",
            textShadow: "0 4px 24px rgba(0,0,0,0.5)",
            maxWidth: image ? "600px" : "none",
          }}>
            {title}
          </h1>

          {/* Meta info */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "16px", alignItems: "center" }}>
            {year && (
              <span style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "18px",
                color: "#d1d5db",
                fontWeight: 500,
              }}>
                <span style={{
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                }}>
                  📅
                </span>
                {year}
              </span>
            )}
            {rating && (
              <span style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "18px",
                color: "#fbbf24",
                fontWeight: 600,
              }}>
                <span style={{
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(251, 191, 36, 0.2)",
                  borderRadius: "6px",
                }}>
                  ⭐
                </span>
                {rating}/10
              </span>
            )}
            {season && episode && (
              <span style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "18px",
                color: "#a78bfa",
                fontWeight: 500,
              }}>
                <span style={{
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(167, 139, 250, 0.2)",
                  borderRadius: "6px",
                }}>
                  📺
                </span>
                S{season} • E{episode}
              </span>
            )}
          </div>

          {/* Genres */}
          {genres && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
              maxWidth: image ? "600px" : "none",
            }}>
              {genres.split(",").slice(0, 5).map((genre, i) => (
                <span key={i} style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: "6px 14px",
                  borderRadius: "100px",
                  fontSize: "14px",
                  color: "#e5e7eb",
                }}>
                  {genre.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Episode info */}
          {episodeTitle && episodeOverview && (
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "16px",
              maxWidth: image ? "600px" : "none",
            }}>
              <p style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#fca5a5",
                margin: "0 0 8px 0",
              }}>
                Episode {episode}: {episodeTitle}
              </p>
              <p style={{
                fontSize: "14px",
                color: "#9ca3af",
                margin: 0,
                lineHeight: 1.5,
              }}>
                {episodeOverview.slice(0, 120)}...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  } else if (type === "person") {
    // Person OG Image
    content = (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "20px",
        maxWidth: "800px",
      }}>
        {/* Profile image */}
        {image && (
          <div style={{
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(239, 68, 68, 0.4)",
            border: "4px solid rgba(239, 68, 68, 0.5)",
            marginBottom: "16px",
          }}>
            <img
              src={image}
              alt={personName || title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        {/* Person badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(239, 68, 68, 0.2)",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          padding: "6px 16px",
          borderRadius: "100px",
          fontSize: "14px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#fca5a5",
        }}>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#ef4444",
            animation: "pulse 2s infinite"
          }} />
          Actor / Creator
        </div>

        {/* Name */}
        <h1 style={{
          fontSize: "56px",
          fontWeight: 800,
          lineHeight: 1.1,
          margin: 0,
          textShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}>
          {personName || title}
        </h1>

        {/* Known for */}
        {knownFor && (
          <p style={{
            fontSize: "20px",
            color: "#d1d5db",
            margin: 0,
            maxWidth: "600px",
          }}>
            Known for: {knownFor}
          </p>
        )}

        {/* Stats */}
        {description && (
          <p style={{
            fontSize: "16px",
            color: "#9ca3af",
            margin: 0,
            maxWidth: "600px",
            lineHeight: 1.6,
          }}>
            {description}
          </p>
        )}
      </div>
    );
  } else if (type === "collection") {
    // Collection OG Image
    content = (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "20px",
        maxWidth: "800px",
      }}>
        {/* Collection poster */}
        {image && (
          <div style={{
            width: "200px",
            height: "300px",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(167, 139, 250, 0.4)",
            border: "2px solid rgba(167, 139, 250, 0.5)",
            marginBottom: "16px",
          }}>
            <img
              src={image}
              alt={collectionName || title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        {/* Collection badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(167, 139, 250, 0.2)",
          border: "1px solid rgba(167, 139, 250, 0.4)",
          padding: "6px 16px",
          borderRadius: "100px",
          fontSize: "14px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#c4b5fd",
        }}>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#a855f7",
            animation: "pulse 2s infinite"
          }} />
          Collection
        </div>

        {/* Name */}
        <h1 style={{
          fontSize: "52px",
          fontWeight: 800,
          lineHeight: 1.1,
          margin: 0,
          textShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}>
          {collectionName || title}
        </h1>

        {/* Part count */}
        {partCount && (
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "18px",
            color: "#c4b5fd",
            fontWeight: 500,
          }}>
            <span style={{
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(167, 139, 250, 0.2)",
              borderRadius: "6px",
            }}>
              🎬
            </span>
            {partCount} titles
          </div>
        )}

        {/* Overview */}
        {description && (
          <p style={{
            fontSize: "18px",
            color: "#9ca3af",
            margin: 0,
            maxWidth: "500px",
            lineHeight: 1.6,
          }}>
            {description}
          </p>
        )}
      </div>
    );
  } else {
    // Default website OG Image
    content = (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "20px",
        maxWidth: "800px",
      }}>
        <div style={{
          width: "100px",
          height: "100px",
          borderRadius: "24px",
          background: "linear-gradient(135deg, #ef4444, #a855f7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 25px 50px -12px rgba(239, 68, 68, 0.4)",
          marginBottom: "16px",
        }}>
          <span style={{ fontSize: "48px" }}>▶</span>
        </div>

        <h1 style={{
          fontSize: "48px",
          fontWeight: 800,
          lineHeight: 1.1,
          margin: 0,
          textShadow: "0 4px 24px rgba(0,0,0,0.5)",
          background: "linear-gradient(90deg, #fff, #fca5a5, #c4b5fd)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          {SITE_NAME}
        </h1>

        <p style={{
          fontSize: "20px",
          color: "#d1d5db",
          margin: 0,
          maxWidth: "600px",
          lineHeight: 1.6,
        }}>
          {description}
        </p>

        <div style={{
          display: "flex",
          gap: "12px",
          marginTop: "16px",
        }}>
          <span style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "8px 20px",
            borderRadius: "100px",
            fontSize: "14px",
            color: "#e5e7eb",
          }}>
            Movies
          </span>
          <span style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "8px 20px",
            borderRadius: "100px",
            fontSize: "14px",
            color: "#e5e7eb",
          }}>
            TV Shows
          </span>
          <span style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "8px 20px",
            borderRadius: "100px",
            fontSize: "14px",
            color: "#e5e7eb",
          }}>
            Free HD
          </span>
        </div>
      </div>
    );
  }

  try {
    return new ImageResponse(
      <div style={baseStyles}>
        {backgroundDecoration}
        {content}
      {/* Brand footer */}
      <div style={{
        position: "absolute",
        bottom: "30px",
        left: "60px",
        right: "60px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "20px",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "16px",
          fontWeight: 700,
        }}>
          <span style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #ef4444, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
          }}>▶</span>
          {SITE_NAME}
        </div>
        <div style={{
          fontSize: "13px",
          color: "#6b7280",
          fontWeight: 500,
        }}>
          Watch Free Online in HD
        </div>
      </div>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
      </div>,
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (err) {
    console.error("[og] Image generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate preview image" },
      { status: 500 }
    );
  }
}