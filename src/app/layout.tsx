import "./globals.css";
import Providers from "@/components/Providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "FlixVerse",
    description: "FlixVerse - Your Ultimate Streaming Platform",
    authors: [{ name: "FlixVerse" }],
    icons: {
        icon: "/favicon.svg",
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

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
