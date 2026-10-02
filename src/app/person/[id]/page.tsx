import { Metadata } from "next";
import PersonDetails from "@/views/PersonDetails";

interface PersonPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Person #${id} — FlixVerse`,
    description: "View filmography and details for this person on FlixVerse.",
  };
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { id } = await params;
  return <PersonDetails personId={Number(id)} />;
}
