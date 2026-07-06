import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — FlixVerse",
  description: "FlixVerse privacy policy. Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Privacy Policy</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 6, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              FlixVerse collects information you provide directly, including account registration data
              (email, display name), profile information, watch history, ratings, reviews, and
              comments. We also collect certain information automatically, such as device type,
              browser version, and usage patterns.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              We use your information to provide and improve our services, personalize your experience,
              send you notifications you&apos;ve opted into, analyze usage trends, and ensure the security
              of our platform. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Data Sharing</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              We may share your information with service providers who assist in operating our platform
              (hosting, analytics), when required by law, or with your explicit consent. Your public
              profile and activity may be visible to other users based on your privacy settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Data Retention</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              We retain your personal information for as long as your account is active or as needed
              to provide services. You may request deletion of your account and associated data at any
              time through your profile settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Your Rights</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              Depending on your jurisdiction, you may have rights to access, correct, export, or delete
              your personal data. Contact us at privacy@flixverse.app to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Contact</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              For privacy-related inquiries, email us at privacy@flixverse.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
