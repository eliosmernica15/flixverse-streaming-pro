"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Sparkles,
  Film,
  Tv,
  Heart,
  TrendingUp,
  Github,
  Twitter,
  Instagram,
  Youtube,
  WifiOff,
  ArrowUpRight,
  Send,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const t = useTranslations("footer");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: t("invalidEmail"), variant: "destructive" });
      return;
    }
    setSubscribing(true);
    try {
      localStorage.setItem("flixverse:newsletter", trimmed);
      setNewsletterEmail("");
      toast({ title: t("subscribed"), description: t("subscribedDesc") });
    } catch {
      toast({ title: t("subscribeFailed"), variant: "destructive" });
    } finally {
      setSubscribing(false);
    }
  };

  const navLinks = [
    { path: "/", label: tn("home"), icon: Sparkles },
    { path: "/movies", label: tn("movies"), icon: Film },
    { path: "/tv-shows", label: tn("tvShows"), icon: Tv },
    { path: "/my-list", label: tn("myList"), icon: Heart },
    { path: "/new-and-popular", label: t("trending"), icon: TrendingUp },
    { path: "/offline-library", label: t("offlineLibrary"), icon: WifiOff },
  ];

  const legalLinks = [
    { label: t("privacy"), href: "/privacy" },
    { label: t("terms"), href: "/terms" },
    { label: t("contact"), href: "/contact" },
    { label: t("help"), href: "/help" },
  ];

  const socialLinks = [
    { icon: Twitter, href: "#twitter", label: "Twitter" },
    { icon: Instagram, href: "#instagram", label: "Instagram" },
    { icon: Youtube, href: "#youtube", label: "YouTube" },
    { icon: Github, href: "#github", label: "GitHub" },
  ];

  return (
    <footer className="relative mt-20 overflow-hidden border-t border-white/5">
      <div aria-hidden className="divider-glow" />

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-red-600/8 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-purple-600/6 blur-[100px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-black/80" />
      </div>

      <div className="relative mx-auto max-w-[1800px] px-4 py-14 sm:px-6 lg:py-20 lg:px-8">
        {/* Top CTA */}
        <div className="glass-panel relative mb-16 overflow-hidden rounded-3xl p-8 lg:p-12">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-red-500/10 blur-[80px]" />
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <h2 className="mb-2 text-2xl font-black tracking-tight text-white lg:text-4xl">
                {isAuthenticated ? t("ctaTitleLoggedIn") : t("ctaTitle")}
              </h2>
              <p className="max-w-lg text-gray-400">
                {isAuthenticated ? t("ctaDescriptionLoggedIn") : t("ctaDescription")}
              </p>
            </div>
            <Link
              href={isAuthenticated ? "/movies" : "/auth"}
              className="group inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] hover:from-red-500 hover:to-red-400 active:scale-[0.98] focus-ring"
            >
              <span>{isAuthenticated ? tc("continueWatching") : tc("getStarted")}</span>
              <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="lg:col-span-1">
            <Link
              href="/"
              prefetch
              className="group mb-5 inline-flex items-center space-x-2.5 rounded-lg focus-ring"
            >
              <div className="relative">
                <span className="absolute inset-0 rounded-lg bg-red-500/30 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
                <Sparkles className="relative h-7 w-7 text-red-500 transition-colors group-hover:text-red-400" />
              </div>
              <h2 className="text-xl font-black tracking-tight">
                <span className="text-gradient-primary">Flix</span>
                <span className="text-white">Verse</span>
              </h2>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-gray-400">
              {t("tagline")}
            </p>

            {/* Newsletter */}
            <form
              className="mt-6 flex items-center gap-2"
              onSubmit={handleSubscribe}
            >
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                aria-label={t("emailPlaceholder")}
                className="input-field min-h-[44px] flex-1 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={subscribing}
                aria-label={t("subscribe")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20 transition-all hover:from-red-500 hover:to-red-400 focus-ring glow-hover disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div>
            <h3 className="eyebrow mb-5">{t("navigate")}</h3>
            <ul className="space-y-1">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    href={link.path}
                    prefetch
                    className="group flex min-h-[44px] items-center space-x-3 rounded-lg text-gray-400 transition-colors hover:text-white focus-ring"
                  >
                    <link.icon className="h-4 w-4 text-gray-500 transition-colors group-hover:text-red-500" />
                    <span className="text-sm">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow mb-5">{t("legal")}</h3>
            <ul className="space-y-1">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="group inline-flex min-h-[44px] items-center text-sm text-gray-400 transition-colors hover:text-white focus-ring"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight className="ml-1 h-3 w-3 -translate-y-0.5 translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow mb-5">{t("connect")}</h3>
            <div className="mb-5 flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="group relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-gray-400 transition-all duration-200 hover:-translate-y-1 hover:text-white focus-ring glow-ring"
                  title={social.label}
                  aria-label={social.label}
                >
                  <span className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-purple-500/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  <social.icon className="relative h-4 w-4" />
                </a>
              ))}
            </div>
            <p className="max-w-[14rem] text-xs leading-relaxed text-gray-500">
              {t("stayUpdated")}
            </p>
          </div>
        </div>

        <div className="section-divider mb-6" />

        <div className="flex flex-col items-center justify-between gap-4 text-sm sm:flex-row">
          <p className="text-gray-500">{t("copyright", { year: currentYear })}</p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>{t("poweredBy")}</span>
            <span className="h-1 w-1 rounded-full bg-gray-700" />
            <span>{t("madeFor")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
