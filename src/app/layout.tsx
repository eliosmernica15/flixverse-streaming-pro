import "./globals.css";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://flixverse-streaming-pro.vercel.app"
    ),
    title: {
        default: "FlixVerse — Stream Movies & TV",
        template: "%s | FlixVerse",
    },
    description: "FlixVerse — Your ultimate streaming platform. Watch movies, TV shows, and build your watchlist. Fast, secure, and works offline.",
    authors: [{ name: "FlixVerse" }],
    icons: {
        icon: "/favicon.svg",
        apple: "/favicon.svg",
    },
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "FlixVerse",
    },
    openGraph: {
        title: "FlixVerse",
        description: "FlixVerse - Your Ultimate Streaming Platform",
        type: "website",
        images: ["https://lovable.dev/opengraph-image-p98pqg.png"],
    },
    twitter: {
        card: "summary_large_image",
        site: "@flixverse",
        images: ["https://lovable.dev/opengraph-image-p98pqg.png"],
    },
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
                <Providers>
                    <AppShell>{children}</AppShell>
                </Providers>
            </body>
        </html>
    );
}
