import { Metadata } from "next";
import PersonDetails from "@/views/PersonDetails";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import { getProfileUrl } from "@/utils/tmdbApi";
import { PersonJsonLd } from "@/components/seo/JsonLd";

interface PersonPageProps {
  params: Promise<{ id: string }>;
}

// Fetch person details server-side for metadata
async function fetchPersonMetadata(personId: number) {
  try {
    const res = await fetch(`${SITE_URL}/api/tmdb/person/${personId}?append_to_response=movie_credits,tv_credits`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const { id } = await params;
  const personId = Number(id);
  const person = await fetchPersonMetadata(personId);

  if (!person) {
    return buildPageMetadata({
      title: `Person #${id} — FlixVerse`,
      description: "View filmography and details for this person on FlixVerse.",
      path: `/person/${id}`,
    });
  }

  const title = `${person.name} — Filmography, Movies & TV Shows | FlixVerse`;
  const description = person.biography?.slice(0, 155) || `Explore ${person.name}'s filmography, movies, TV shows, and biography on FlixVerse.`;

  // Get known for titles
  const knownForMovies = [
    ...(person.movie_credits?.cast?.slice(0, 3).map((m: any) => m.title) || []),
    ...(person.tv_credits?.cast?.slice(0, 3).map((m: any) => m.name) || []),
  ].slice(0, 5);

  const knownFor = knownForMovies.join(", ");

  // Build OG params for dynamic image
  const ogParams = {
    type: "person" as const,
    personName: person.name,
    knownFor,
  };

  return buildPageMetadata({
    title,
    description,
    path: `/person/${id}`,
    image: person.profile_path ? getProfileUrl(person.profile_path, "large") : undefined,
    keywords: [
      person.name,
      `${person.name} movies`,
      `${person.name} TV shows`,
      `${person.name} filmography`,
      `${person.name} biography`,
      "actor",
      "actress",
      "director",
      "celebrity",
      "FlixVerse",
    ],
    ogParams,
  });
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { id } = await params;
  const personId = Number(id);
  const person = await fetchPersonMetadata(personId);

  return (
    <>
      {person && (
        <PersonJsonLd
          name={person.name}
          description={person.biography || `Filmography and details for ${person.name}`}
          image={person.profile_path ? getProfileUrl(person.profile_path, "large") : undefined}
          url={`${SITE_URL}/person/${id}`}
          birthDate={person.birthday}
          deathDate={person.deathday}
          jobTitle={person.known_for_department}
          knownFor={[
            ...(person.movie_credits?.cast?.slice(0, 5).map((m: any) => ({
              name: m.title,
              url: `${SITE_URL}/movie/${m.id}`,
            })) || []),
            ...(person.tv_credits?.cast?.slice(0, 5).map((m: any) => ({
              name: m.name,
              url: `${SITE_URL}/movie/${m.id}?type=tv`,
            })) || []),
          ].slice(0, 10)}
        />
      )}
      <PersonDetails personId={personId} />
    </>
  );
}
