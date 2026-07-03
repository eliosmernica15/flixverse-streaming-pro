import { buildPrivatePageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivatePageMetadata({
  title: "Offline",
  description: "You are currently offline. Reconnect to stream on FlixVerse.",
  path: "/offline",
});

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
