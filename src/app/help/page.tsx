import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help & FAQ — FlixVerse",
  description: "Get help with FlixVerse. Find answers to common questions.",
};

const FAQS = [
  {
    q: "How do I watch content?",
    a: "Click on any movie or TV show, then press Play. If the first server doesn't work, try switching servers using the server selector (S key).",
  },
  {
    q: "Why is the video not loading?",
    a: "Video playback runs through third-party embeds. If one server fails, try the next one. Check your internet connection and disable ad blockers if needed.",
  },
  {
    q: "How do I create a watchlist?",
    a: "Click the heart icon on any movie or show to add it to My List. You need to be signed in.",
  },
  {
    q: "What is FlixParty?",
    a: "FlixParty lets you watch with friends in real-time. Create a party, share the code, and everyone syncs to the same playback.",
  },
  {
    q: "How do spoilers work?",
    a: "FlixVerse automatically hides episodes you haven't reached yet based on your watch history. You can reveal them with a click.",
  },
  {
    q: "Can I use FlixVerse offline?",
    a: "FlixVerse supports offline caching for your watchlist and continue watching data. Actual video playback requires an internet connection.",
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Help</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-black text-white mb-8">Help & FAQ</h1>

        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden"
            >
              <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-white hover:bg-white/5 transition-colors list-none flex items-center justify-between">
                {faq.q}
                <span className="text-gray-500 group-open:rotate-45 transition-transform text-lg">+</span>
              </summary>
              <div className="px-5 pb-4">
                <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm mb-3">Still need help?</p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
