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
      <LazyProfile />
    </div>
  );
}
