import { Metadata } from "next";
import PublicProfile from "@/views/PublicProfile";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username} — FlixVerse Profile`,
    description: `View ${username}'s public profile on FlixVerse.`,
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  return <PublicProfile username={username} />;
}
