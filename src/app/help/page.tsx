import { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { HelpExplorer, type Faq } from "@/components/HelpExplorer";

export const metadata: Metadata = {
  title: "Help & FAQ — FlixVerse",
  description: "Get help with FlixVerse. Find answers to common questions.",
};

const FAQS: Faq[] = [
  {
    category: "Watching",
    q: "How do I watch content?",
    a: "Click on any movie or TV show, then press Play. If the first server doesn't work, try switching servers using the server selector (S key).",
  },
  {
    category: "Playback",
    q: "Why is the video not loading?",
    a: "Video playback runs through third-party embeds. If one server fails, try the next one. Check your internet connection and disable ad blockers if needed.",
  },
  {
    category: "Account",
    q: "How do I create a watchlist?",
    a: "Click the heart icon on any movie or show to add it to My List. You need to be signed in.",
  },
  {
    category: "Features",
    q: "What is FlixParty?",
    a: "FlixParty lets you watch with friends in real-time. Create a party, share the code, and everyone syncs to the same playback.",
  },
  {
    category: "Features",
    q: "How do spoilers work?",
    a: "FlixVerse automatically hides episodes you haven't reached yet based on your watch history. You can reveal them with a click.",
  },
  {
    category: "Playback",
    q: "Can I use FlixVerse offline?",
    a: "FlixVerse supports offline caching for your watchlist and continue watching data. Actual video playback requires an internet connection.",
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8 page-enter">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors focus-ring rounded">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Help</span>
        </nav>

        <SectionHeader eyebrow="Support" title="Help & FAQ" />
        <p className="text-gray-400 text-sm mb-8 max-w-2xl text-balance">
          Find answers to the most common questions, or search our knowledge base below.
        </p>

        <HelpExplorer faqs={FAQS} />

        <Reveal>
          <div className="mt-12 text-center glass-panel rounded-2xl p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <p className="text-gray-300 text-sm mb-4">Still need help?</p>
            <Button asChild variant="gradient" className="min-h-[44px]">
              <Link href="/contact">Contact Support</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
