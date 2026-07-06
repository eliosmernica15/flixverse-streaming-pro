import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — FlixVerse",
  description: "FlixVerse terms of service. Read the rules and guidelines for using our platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Terms of Service</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 6, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              By accessing or using FlixVerse, you agree to be bound by these Terms of Service.
              If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Description of Service</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              FlixVerse is a free streaming discovery platform that aggregates content from third-party
              sources. We do not host or serve any video content directly. All video playback occurs
              through third-party embed providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. User Accounts</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials.
              You agree to provide accurate information and to update it as necessary. One account
              per person; impersonation is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. User Content</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              Reviews, comments, and other content you post remain yours, but you grant FlixVerse a
              non-exclusive license to display and distribute that content on our platform. You must
              have the right to any content you submit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Prohibited Conduct</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              You may not: use the service for illegal purposes, attempt to circumvent security
              measures, upload malicious content, harass other users, or abuse the platform&apos;s
              features (spam, automated access, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Disclaimer</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              FlixVerse is provided &quot;as is&quot; without warranties of any kind. We are not responsible
              for the content of third-party embeds. Use at your own discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Changes to Terms</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              We may update these terms from time to time. Continued use of the service after changes
              constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              For questions about these terms, email us at legal@flixverse.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
