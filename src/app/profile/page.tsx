import { Suspense } from "react";
import { LazyProfile } from "@/lib/lazy-views";
import { buildPrivatePageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivatePageMetadata({
  title: "Your Profile",
  description: "Manage your FlixVerse profile, watch history, and preferences.",
  path: "/profile",
});

export default function ProfilePage() {
  return (
    <div className="page-enter">
      <Suspense
        fallback={
          <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        }
      >
        <LazyProfile />
      </Suspense>
    </div>
  );
}
