import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/lib/seo/metadata";

export function WebsiteJsonLd() {
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
    description: DEFAULT_DESCRIPTION,
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FAQJsonLd() {
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

export function CollectionPageJsonLd({ name, description, url }: CollectionPageJsonLdProps) {
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
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface BreadcrumbJsonLdProps {
  items: { name: string; url: string }[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
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

export function ContentJsonLd({
  title,
  description,
  image,
  url,
  type,
  datePublished,
  rating,
}: ContentJsonLdProps) {
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

export function ItemListJsonLd({ name, description, url, items }: ItemListJsonLdProps) {
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
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebPageJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
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
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
