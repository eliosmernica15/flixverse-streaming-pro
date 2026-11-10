import { Suspense } from "react";
import PartyJoinClient from "./PartyJoinClient";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Join Watch Party — FlixVerse",
  description: "Join a FlixVerse watch party with friends. Enter the party code to start watching together in sync.",
  path: "/party/join",
  keywords: [
    "watch party",
    "join party",
    "FlixParty",
    "sync watch",
    "watch together",
  ],
});

export default function PartyJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-gray-400 text-sm">
          Loading party…
        </div>
      }
    >
      <PartyJoinClient />
    </Suspense>
  );
}
