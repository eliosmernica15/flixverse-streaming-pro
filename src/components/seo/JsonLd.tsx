import { getNonce } from "@/lib/seo/nonce";
import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/lib/seo/metadata";

export async function WebsiteJsonLd() {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "en-US",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export async function OrganizationJsonLd() {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": ["Organization", "EntertainmentBusiness"],
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    description: DEFAULT_DESCRIPTION,
    sameAs: [],
    knowsAbout: ["Movies", "Television", "Streaming media", "Entertainment"],
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export async function FAQJsonLd() {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Can I watch movies for free on FlixVerse?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. FlixVerse lets you browse and stream movies and TV shows online in HD at no cost.",
        },
      },
      {
        "@type": "Question",
        name: "Does FlixVerse work offline?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can browse cached watchlist titles and posters offline. Video streaming requires an internet connection.",
        },
      },
      {
        "@type": "Question",
        name: "How do I search for movies on FlixVerse?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Use the search bar or visit ${SITE_URL}/search to find movies, TV shows, and actors.`,
        },
      },
    ],
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface CollectionPageJsonLdProps {
  name: string;
  description: string;
  url: string;
}

export async function CollectionPageJsonLd({ name, description, url }: CollectionPageJsonLdProps) {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface BreadcrumbJsonLdProps {
  items: { name: string; url: string }[];
}

export async function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface ContentJsonLdProps {
  title: string;
  description: string;
  image?: string;
  url: string;
  type: "movie" | "tv";
  datePublished?: string;
  rating?: number;
}

export async function ContentJsonLd({
  title,
  description,
  image,
  url,
  type,
  datePublished,
  rating,
}: ContentJsonLdProps) {
  const nonce = await getNonce();
  const schemaType = type === "tv" ? "TVSeries" : "Movie";
  const data = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: title,
    description: description.slice(0, 500),
    image,
    url,
    ...(datePublished ? { datePublished } : {}),
    ...(rating && rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.toFixed(1),
            bestRating: "10",
            worstRating: "0",
            ratingCount: Math.max(10, Math.round(rating * 100)),
          },
        }
      : {}),
    potentialAction: {
      "@type": "WatchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: url,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
    },
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface ItemListJsonLdProps {
  name: string;
  description: string;
  url: string;
  items: { name: string; url: string; image?: string }[];
}

export async function ItemListJsonLd({ name, description, url, items }: ItemListJsonLdProps) {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: item.name,
        url: item.url,
        ...(item.image ? { image: item.image } : {}),
      },
    })),
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export async function WebPageJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    inLanguage: "en-US",
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface EpisodeJsonLdProps {
  title: string;
  description: string;
  image?: string;
  url: string;
  episodeNumber: number;
  seasonNumber: number;
  seriesName: string;
  seriesUrl: string;
  datePublished?: string;
  rating?: number;
  duration?: string; // ISO 8601 duration format, e.g., "PT45M"
}

export async function EpisodeJsonLd({
  title,
  description,
  image,
  url,
  episodeNumber,
  seasonNumber,
  seriesName,
  seriesUrl,
  datePublished,
  rating,
  duration,
}: EpisodeJsonLdProps) {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "Episode",
    name: title,
    description: description.slice(0, 500),
    image,
    url,
    episodeNumber,
    seasonNumber,
    partOfSeries: {
      "@type": "TVSeries",
      name: seriesName,
      url: seriesUrl,
    },
    ...(datePublished ? { datePublished } : {}),
    ...(rating && rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.toFixed(1),
            bestRating: "10",
            worstRating: "0",
            ratingCount: Math.max(10, Math.round(rating * 100)),
          },
        }
      : {}),
    ...(duration ? { duration } : {}),
    potentialAction: {
      "@type": "WatchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: url,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
    },
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface TVSeriesJsonLdProps {
  name: string;
  description: string;
  image?: string;
  url: string;
  datePublished?: string;
  rating?: number;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  genres?: string[];
  actors?: { name: string; url?: string }[];
  creator?: { name: string; url?: string }[];
}

export async function TVSeriesJsonLd({
  name,
  description,
  image,
  url,
  datePublished,
  rating,
  numberOfSeasons,
  numberOfEpisodes,
  genres,
  actors,
  creator,
}: TVSeriesJsonLdProps) {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name,
    description: description.slice(0, 500),
    image,
    url,
    ...(datePublished ? { datePublished } : {}),
    ...(rating && rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.toFixed(1),
            bestRating: "10",
            worstRating: "0",
            ratingCount: Math.max(10, Math.round(rating * 100)),
          },
        }
      : {}),
    ...(numberOfSeasons ? { numberOfSeasons } : {}),
    ...(numberOfEpisodes ? { numberOfEpisodes } : {}),
    ...(genres && genres.length > 0 ? { genre: genres } : {}),
    ...(actors && actors.length > 0
      ? {
          actor: actors.map((actor) => ({
            "@type": "Person",
            name: actor.name,
            ...(actor.url ? { url: actor.url } : {}),
          })),
        }
      : {}),
    ...(creator && creator.length > 0
      ? {
          creator: creator.map((c) => ({
            "@type": "Person",
            name: c.name,
            ...(c.url ? { url: c.url } : {}),
          })),
        }
      : {}),
    potentialAction: {
      "@type": "WatchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: url,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
    },
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface PersonJsonLdProps {
  name: string;
  description: string;
  image?: string;
  url: string;
  birthDate?: string;
  deathDate?: string | null;
  jobTitle?: string;
  knownFor?: { name: string; url: string }[];
}

export async function PersonJsonLd({
  name,
  description,
  image,
  url,
  birthDate,
  deathDate,
  jobTitle,
  knownFor,
}: PersonJsonLdProps) {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    description: description.slice(0, 500),
    image,
    url,
    ...(birthDate ? { birthDate } : {}),
    ...(deathDate ? { deathDate } : {}),
    ...(jobTitle ? { jobTitle } : {}),
    ...(knownFor && knownFor.length > 0
      ? {
          knownFor: knownFor.map((item) => ({
            "@type": "CreativeWork",
            name: item.name,
            url: item.url,
          })),
        }
      : {}),
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface CollectionJsonLdProps {
  name: string;
  description: string;
  image?: string;
  url: string;
  numberOfItems?: number;
  hasPart?: { name: string; url: string; type: "Movie" | "TVSeries" }[];
}

export async function CollectionJsonLd({
  name,
  description,
  image,
  url,
  numberOfItems,
  hasPart,
}: CollectionJsonLdProps) {
  const nonce = await getNonce();
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description: description.slice(0, 500),
    image,
    url,
    numberOfItems: numberOfItems || (hasPart?.length || 0),
    itemListElement: hasPart?.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": item.type,
        name: item.name,
        url: item.url,
      },
    })),
  };

  return (
    <script
    nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
