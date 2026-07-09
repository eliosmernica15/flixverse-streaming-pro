import { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/SectionHeader";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Terms of Service — FlixVerse",
  description: "FlixVerse terms of service. Read the rules and guidelines for using our platform.",
};

const SECTIONS = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: "By accessing or using FlixVerse, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.",
  },
  {
    id: "description",
    title: "2. Description of Service",
    body: "FlixVerse is a free streaming discovery platform that aggregates content from third-party sources. We do not host or serve any video content directly. All video playback occurs through third-party embed providers.",
  },
  {
    id: "accounts",
    title: "3. User Accounts",
    body: "You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information and to update it as necessary. One account per person; impersonation is prohibited.",
  },
  {
    id: "content",
    title: "4. User Content",
    body: "Reviews, comments, and other content you post remain yours, but you grant FlixVerse a non-exclusive license to display and distribute that content on our platform. You must have the right to any content you submit.",
  },
  {
    id: "conduct",
    title: "5. Prohibited Conduct",
    body: "You may not: use the service for illegal purposes, attempt to circumvent security measures, upload malicious content, harass other users, or abuse the platform's features (spam, automated access, etc.).",
  },
  {
    id: "disclaimer",
    title: "6. Disclaimer",
    body: 'FlixVerse is provided "as is" without warranties of any kind. We are not responsible for the content of third-party embeds. Use at your own discretion.',
  },
  {
    id: "changes",
    title: "7. Changes to Terms",
    body: "We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.",
  },
  {
    id: "contact",
    title: "8. Contact",
    body: "For questions about these terms, email us at legal@flixverse.app.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8 page-enter">
      <div className="max-w-6xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors focus-ring rounded">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Terms of Service</span>
        </nav>

        <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-10">
          <aside className="lg:sticky lg:top-28 h-max">
            <p className="eyebrow mb-3">On this page</p>
            <nav className="flex lg:flex-col gap-2 overflow-x-auto scrollbar-thin pb-2 lg:pb-0">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="chip whitespace-nowrap hover:bg-white/10 focus-ring"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="max-w-3xl">
            <SectionHeader eyebrow="Legal" title="Terms of Service" />
            <p className="text-sm text-gray-500 mb-8">Last updated: July 6, 2026</p>

            <div className="glass-panel rounded-2xl p-6 sm:p-10">
              {SECTIONS.map((s, i) => (
                <Reveal key={s.id}>
                  <section id={s.id} className="scroll-mt-28 section">
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">{s.title}</h2>
                    <p className="text-balance text-gray-300 leading-relaxed">{s.body}</p>
                    {i < SECTIONS.length - 1 && <hr className="divider-glow mt-8" />}
                  </section>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
