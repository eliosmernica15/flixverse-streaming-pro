import Link from 'next/link';
import { Sparkles, Film, Tv, Heart, TrendingUp, Github, Twitter, Instagram, Youtube } from "lucide-react";
import { motion } from "framer-motion";

const Footer = () => {
    const currentYear = new Date().getFullYear();

    const navLinks = [
        { path: '/', label: 'Home', icon: Sparkles },
        { path: '/movies', label: 'Movies', icon: Film },
        { path: '/tv-shows', label: 'TV Shows', icon: Tv },
        { path: '/my-list', label: 'My List', icon: Heart },
        { path: '/new-and-popular', label: 'Trending', icon: TrendingUp },
    ];

    const legalLinks = [
        { label: 'Privacy Policy', href: '#privacy' },
        { label: 'Terms of Service', href: '#terms' },
        { label: 'Contact Us', href: '#contact' },
        { label: 'Help Center', href: '#help' },
    ];

    const socialLinks = [
        { icon: Twitter, href: '#twitter', label: 'Twitter' },
        { icon: Instagram, href: '#instagram', label: 'Instagram' },
        { icon: Youtube, href: '#youtube', label: 'YouTube' },
        { icon: Github, href: '#github', label: 'GitHub' },
    ];

    return (
        <footer className="relative border-t border-white/5 mt-16 overflow-hidden">
            {/* Background gradient effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bottom-0 left-1/4 w-96 h-48 bg-red-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 w-64 h-32 bg-purple-500/5 rounded-full blur-[80px]" />
            </div>

            <div className="relative max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                {/* Top section with logo and navigation */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
                    {/* Brand column */}
                    <div className="lg:col-span-1">
                        <Link href="/" className="inline-flex items-center space-x-2.5 group mb-4">
                            <div className="relative">
                                <Sparkles className="w-7 h-7 text-red-500 group-hover:text-red-400 transition-colors" />
                                <div className="absolute inset-0 blur-lg bg-red-500/30 group-hover:bg-red-400/40 transition-colors" />
                            </div>
                            <h2 className="text-xl font-black tracking-tight">
                                <span className="text-gradient-primary">Flix</span>
                                <span className="text-white">Verse</span>
                            </h2>
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                            Your ultimate destination for movies and TV shows. Stream unlimited entertainment, anytime, anywhere.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Navigate</h3>
                        <ul className="space-y-3">
                            {navLinks.map((link) => (
                                <li key={link.path}>
                                    <Link
                                        href={link.path}
                                        className="group flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <link.icon className="w-4 h-4 text-gray-500 group-hover:text-red-500 transition-colors" />
                                        <span className="text-sm">{link.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Legal</h3>
                        <ul className="space-y-3">
                            {legalLinks.map((link) => (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        className="text-gray-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Social & Newsletter */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Connect</h3>
                        <div className="flex items-center space-x-3 mb-6">
                            {socialLinks.map((social) => (
                                <motion.a
                                    key={social.label}
                                    href={social.href}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-red-500/30 transition-all"
                                    whileHover={{ scale: 1.1, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    title={social.label}
                                >
                                    <social.icon className="w-4 h-4" />
                                </motion.a>
                            ))}
                        </div>
                        <p className="text-gray-500 text-xs">
                            Stay updated with the latest releases and exclusive content.
                        </p>
                    </div>
                </div>

                {/* Divider */}
                <div className="section-divider mb-8" />

                {/* Bottom section */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-sm">
                        © {currentYear} FlixVerse. All rights reserved.
                    </p>
                    <div className="flex items-center space-x-6">
                        <span className="text-gray-600 text-xs">
                            Powered by TMDB API
                        </span>
                        <span className="w-1 h-1 bg-gray-700 rounded-full" />
                        <span className="text-gray-600 text-xs">
                            Made with ❤️ for movie lovers
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
