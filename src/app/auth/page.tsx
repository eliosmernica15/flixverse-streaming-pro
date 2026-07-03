import { LazyAuth } from "@/lib/lazy-views";
import { buildPrivatePageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivatePageMetadata({
  title: "Sign In",
  description: "Sign in or create a FlixVerse account to save your watchlist and track viewing progress.",
  path: "/auth",
});

export default function AuthPage() {
  return <LazyAuth />;
}
