import { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/SectionHeader";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Privacy Policy — FlixVerse",
  description: "FlixVerse privacy policy. Learn how we collect, use, and protect your personal information.",
};

const SECTIONS = [
  {
    id: "collect",
    title: "1. Information We Collect",
    body: "FlixVerse collects information you provide directly, including account registration data (email, display name), profile information, watch history, ratings, reviews, and comments. We also collect certain information automatically, such as device type, browser version, and usage patterns.",
  },
  {
    id: "use",
    title: "2. How We Use Your Information",
    body: "We use your information to provide and improve our services, personalize your experience, send you notifications you've opted into, analyze usage trends, and ensure the security of our platform. We do not sell your personal information to third parties.",
  },
  {
    id: "sharing",
    title: "3. Data Sharing",
    body: "We may share your information with service providers who assist in operating our platform (hosting, analytics), when required by law, or with your explicit consent. Your public profile and activity may be visible to other users based on your privacy settings.",
  },
  {
    id: "retention",
    title: "4. Data Retention",
    body: "We retain your personal information for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time through your profile settings.",
  },
  {
    id: "rights",
    title: "5. Your Rights",
    body: "Depending on your jurisdiction, you may have rights to access, correct, export, or delete your personal data. Contact us at privacy@flixverse.app to exercise these rights.",
  },
  {
    id: "contact",
    title: "6. Contact",
    body: "For privacy-related inquiries, email us at privacy@flixverse.app.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8 page-enter">
      <div className="max-w-6xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors focus-ring rounded">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Privacy Policy</span>
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
            <SectionHeader eyebrow="Legal" title="Privacy Policy" />
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
