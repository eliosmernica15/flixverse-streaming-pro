import { securityHeaders } from "./security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
    poweredByHeader: false,
    compress: true,
    reactStrictMode: true,
    turbopack: {
        root: process.cwd(),
    },
    experimental: {
        optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "image.tmdb.org",
            },
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
            {
                protocol: "https",
                hostname: "lovable.dev",
            },
            {
                protocol: "https",
                hostname: "firebasestorage.googleapis.com",
            },
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
            },
        ],
        formats: ["image/avif", "image/webp"],
        minimumCacheTTL: 60 * 60 * 24 * 7,
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        imageSizes: [64, 96, 128, 256, 384],
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: securityHeaders,
            },
            {
                source: "/_next/static/(.*)",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            },
            {
                source: "/favicon.svg",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=86400, stale-while-revalidate=604800",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
