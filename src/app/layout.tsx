import "./globals.css";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/JsonLd";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/seo/metadata";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
        types: {
            "application/rss+xml": `${SITE_URL}/sitemap.xml`,
        },
    },
    applicationName: SITE_NAME,
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
        ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
        : {}),
};

export const viewport: Viewport = {
    themeColor: "#000000",
    colorScheme: "dark",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={inter.variable}>
            <head>
                <link rel="preconnect" href="https://api.themoviedb.org" />
                <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://api.themoviedb.org" />
                <link rel="dns-prefetch" href="https://image.tmdb.org" />
            </head>
            <body className={`${inter.className} antialiased`}>
                <WebsiteJsonLd />
                <OrganizationJsonLd />
                <Providers>
                    <AppShell>{children}</AppShell>
                </Providers>
            </body>
        </html>
    );
}
