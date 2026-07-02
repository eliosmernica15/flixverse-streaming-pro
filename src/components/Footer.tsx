import Link from "next/link";
import { Sparkles, Film, Tv, Heart, TrendingUp, Github, Twitter, Instagram, Youtube } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const navLinks = [
    { path: "/", label: "Home", icon: Sparkles },
    { path: "/movies", label: "Movies", icon: Film },
    { path: "/tv-shows", label: "TV Shows", icon: Tv },
    { path: "/my-list", label: "My List", icon: Heart },
    { path: "/new-and-popular", label: "Trending", icon: TrendingUp },
  ];

  const legalLinks = [
    { label: "Privacy Policy", href: "#privacy" },
    { label: "Terms of Service", href: "#terms" },
    { label: "Contact Us", href: "#contact" },
    { label: "Help Center", href: "#help" },
  ];

  const socialLinks = [
    { icon: Twitter, href: "#twitter", label: "Twitter" },
    { icon: Instagram, href: "#instagram", label: "Instagram" },
    { icon: Youtube, href: "#youtube", label: "YouTube" },
    { icon: Github, href: "#github", label: "GitHub" },
  ];

  return (
    <footer className="relative border-t border-white/5 mt-16 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-red-950/10 via-transparent to-transparent" />

      <div className="relative max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-10">
          <div className="lg:col-span-1">
            <Link href="/" prefetch className="inline-flex items-center space-x-2.5 group mb-4">
              <Sparkles className="w-7 h-7 text-red-500 group-hover:text-red-400 transition-colors" />
              <h2 className="text-xl font-black tracking-tight">
                <span className="text-gradient-primary">Flix</span>
                <span className="text-white">Verse</span>
              </h2>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Your ultimate destination for movies and TV shows. Stream unlimited entertainment, anytime, anywhere.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Navigate</h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    href={link.path}
                    prefetch
                    className="group flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <link.icon className="w-4 h-4 text-gray-500 group-hover:text-red-500 transition-colors" />
                    <span className="text-sm">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Connect</h3>
            <div className="flex items-center gap-2.5 mb-5">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-red-500/30 transition-all duration-200 hover:-translate-y-0.5"
                  title={social.label}
                >
                  <social.icon className="w-4 h-4" />
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
