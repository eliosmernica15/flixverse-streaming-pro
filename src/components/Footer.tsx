"use client";

import Link from "next/link";
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
} from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const navLinks = [
    { path: "/", label: "Home", icon: Sparkles },
    { path: "/movies", label: "Movies", icon: Film },
    { path: "/tv-shows", label: "TV Shows", icon: Tv },
    { path: "/my-list", label: "My List", icon: Heart },
    { path: "/new-and-popular", label: "Trending", icon: TrendingUp },
    { path: "/offline-library", label: "Offline Library", icon: WifiOff },
  ];

  const legalLinks = [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact Us", href: "/contact" },
    { label: "Help Center", href: "/help" },
  ];

  const socialLinks = [
    { icon: Twitter, href: "#twitter", label: "Twitter" },
    { icon: Instagram, href: "#instagram", label: "Instagram" },
    { icon: Youtube, href: "#youtube", label: "YouTube" },
    { icon: Github, href: "#github", label: "GitHub" },
  ];

  return (
    <footer className="relative border-t border-white/5 mt-20 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-red-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-600/6 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-black/80" />
      </div>

      <div className="relative max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        {/* Top CTA */}
        <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-8 lg:p-12 mb-16 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl lg:text-4xl font-black text-white tracking-tight mb-2">
                Ready to start watching?
              </h2>
              <p className="text-gray-400 max-w-lg">
                Join FlixVerse today and unlock thousands of movies and TV shows, personalized recommendations, and offline viewing.
              </p>
            </div>
            <Link
              href="/auth"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold hover:from-red-500 hover:to-red-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-500/20"
            >
              <span>Get Started</span>
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 mb-12">
          <div className="lg:col-span-1">
            <Link href="/" prefetch className="inline-flex items-center space-x-2.5 group mb-5">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/30 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                <Sparkles className="w-7 h-7 text-red-500 group-hover:text-red-400 transition-colors relative" />
              </div>
              <h2 className="text-xl font-black tracking-tight">
                <span className="text-gradient-primary">Flix</span>
                <span className="text-white">Verse</span>
              </h2>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Watch free movies and TV shows online in HD. Stream trending films, build your watchlist, and browse offline with FlixVerse.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">Navigate</h3>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    href={link.path}
                    prefetch
                    className="group flex items-center space-x-3 text-gray-400 hover:text-white transition-colors"
                  >
                    <link.icon className="w-4 h-4 text-gray-500 group-hover:text-red-500 transition-colors" />
                    <span className="text-sm">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">Legal</h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="group inline-flex items-center text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight className="w-3 h-3 ml-1 opacity-0 -translate-y-0.5 translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">Connect</h3>
            <div className="flex items-center gap-3 mb-5">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="group relative w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all duration-200 hover:-translate-y-1 overflow-hidden"
                  title={social.label}
                  aria-label={social.label}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <social.icon className="w-4 h-4 relative" />
                </a>
              ))}
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">
              Stay updated with the latest releases and exclusive content.
            </p>
          </div>
        </div>

        <div className="section-divider mb-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p className="text-gray-500">© {currentYear} FlixVerse. All rights reserved.</p>
          <div className="flex items-center gap-4 text-gray-600 text-xs">
            <span>Powered by TMDB API</span>
            <span className="w-1 h-1 bg-gray-700 rounded-full" />
            <span>Made for movie lovers</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
