import "./globals.css";
import "./advanced-ui.css";
import "./video-player.css";
import "./ui-polish.css";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/JsonLd";
import type { Metadata, Viewport } from "next";
import { DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/seo/metadata";
import { localeToHtmlLang } from "@/i18n/config";
import { headers } from "next/headers";

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: `${SITE_NAME} — Watch Free Movies & TV Shows Online in HD`,
        template: `%s | ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    keywords: DEFAULT_KEYWORDS,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "entertainment",
    icons: {
        icon: "/favicon.svg",
        apple: "/favicon.svg",
    },
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: SITE_NAME,
    },
    openGraph: {
        title: `${SITE_NAME} — Free Movies & TV Streaming`,
        description: DEFAULT_DESCRIPTION,
        type: "website",
        url: SITE_URL,
        siteName: SITE_NAME,
        locale: "en_US",
        images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
        card: "summary_large_image",
        title: `${SITE_NAME} — Watch Movies Online Free`,
        description: DEFAULT_DESCRIPTION,
        images: ["/opengraph-image"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    alternates: {
        canonical: SITE_URL,
        languages: {
            "en": `${SITE_URL}/en`,
            "es": `${SITE_URL}/es`,
            "sq": `${SITE_URL}/sq`,
        },
        types: {
            "application/rss+xml": `${SITE_URL}/sitemap.xml`,
        },
    },
    applicationName: SITE_NAME,
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
    process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
        ? {
            verification: {
                ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
                    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
                    : {}),
                ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
                    ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
                    : {}),
            },
          }
        : {}),
};

export const viewport: Viewport = {
    themeColor: "#000000",
    colorScheme: "dark",
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const headersList = await headers();
    const acceptLang = headersList.get("accept-language") ?? "";
    const locale = acceptLang.startsWith("sq") ? "sq" : acceptLang.startsWith("es") ? "es" : "en";
    return (
        <html lang={localeToHtmlLang(locale)} suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://api.themoviedb.org" />
                <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://api.themoviedb.org" />
                <link rel="dns-prefetch" href="https://image.tmdb.org" />
            </head>
            <body className="antialiased">
                <WebsiteJsonLd />
                <OrganizationJsonLd />
                <Providers>
                    <AppShell>{children}</AppShell>
                </Providers>
            </body>
        </html>
    );
}
