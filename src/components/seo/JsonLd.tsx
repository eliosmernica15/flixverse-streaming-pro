import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/lib/seo/metadata";

export function WebsiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
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
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface MovieJsonLdProps {
  title: string;
  description: string;
  image?: string;
  url: string;
  type: "movie" | "tv";
  datePublished?: string;
  rating?: number;
}

export function ContentJsonLd({
  title,
  description,
  image,
  url,
  type,
  datePublished,
  rating,
}: MovieJsonLdProps) {
  const schemaType = type === "tv" ? "TVSeries" : "Movie";
  const data = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: title,
    description: description.slice(0, 500),
    image,
    url,
    ...(datePublished ? { datePublished } : {}),
    ...(rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.toFixed(1),
            bestRating: "10",
            ratingCount: 100,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
