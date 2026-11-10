import EmailLinkAuth from "@/views/EmailLinkAuth";

export const metadata = {
  title: "Sign in with email — FlixVerse",
  robots: { index: false, follow: false },
};

export default function EmailLinkPage() {
  return <EmailLinkAuth />;
}
