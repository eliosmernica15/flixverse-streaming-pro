import { Metadata } from "next";
import PublicProfile from "@/views/PublicProfile";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import { PersonJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { getProfileUrl } from "@/utils/tmdbApi";

interface PageProps {
  params: Promise<{ username: string }>;
}

async function fetchProfileData(username: string) {
  try {
    const res = await fetch(`${SITE_URL}/api/public-profile/${username}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchProfileData(username);

  if (!profile) {
    return buildPageMetadata({
      title: `${username} — FlixVerse Profile`,
      description: `View ${username}'s public profile on FlixVerse.`,
      path: `/u/${username}`,
    });
  }

  const title = `${profile.displayName} — FlixVerse Profile`;
  const description = profile.bio?.slice(0, 155) || `View ${profile.displayName}'s public profile, watchlist, and activity on FlixVerse.`;

  // Build OG params for dynamic image
  const ogParams = {
    type: "person" as const,
    personName: profile.displayName,
    knownFor: profile.followerCount > 0 ? `${profile.followerCount} followers` : undefined,
  };

  return buildPageMetadata({
    title,
    description,
    path: `/u/${username}`,
    image: profile.avatarUrl ? getProfileUrl(profile.avatarUrl, "large") : undefined,
    keywords: [
      profile.displayName,
      `${profile.displayName} profile`,
      `${profile.displayName} watchlist`,
      "FlixVerse profile",
      "movie watchlist",
      "TV watchlist",
    ],
    ogParams,
  });
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const profile = await fetchProfileData(username);

  return (
    <>
      {profile && (
        <>
          <BreadcrumbJsonLd
            items={[
              { name: "Home", url: SITE_URL },
              { name: "Search", url: `${SITE_URL}/search` },
              { name: profile.displayName, url: `${SITE_URL}/u/${username}` },
            ]}
          />
          <PersonJsonLd
            name={profile.displayName}
            description={profile.bio || `Public profile of ${profile.displayName}`}
            image={profile.avatarUrl ? getProfileUrl(profile.avatarUrl, "large") : undefined}
            url={`${SITE_URL}/u/${username}`}
            knownFor={[
              ...(profile.watchlist?.slice(0, 5).map((item: any) => ({
                name: item.movie_title,
                url: `${SITE_URL}/movie/${item.movie_id}?type=${item.media_type || "movie"}`,
              })) || []),
            ].slice(0, 10)}
          />
        </>
      )}
      <PublicProfile username={username} />
    </>
  );
}
