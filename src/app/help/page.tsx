"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Mail, User, CreditCard, Settings, LifeBuoy, CheckCircle, Send, MessageSquare, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import Stagger from "@/components/Stagger";

type HelpTab = "faq" | "contact" | "account" | "billing" | "technical";

type Faq = { q: string; a: string; category: string };

const FAQS: Faq[] = [
  {
    category: "Watching",
    q: "How do I watch content?",
    a: "Click on any movie or TV show, then press Play. If the first server doesn't work, try switching servers using the server selector (S key).",
  },
  {
    category: "Playback",
    q: "Why is the video not loading?",
    a: "Video playback runs through third-party embeds. If one server fails, try the next one. Check your internet connection and disable ad blockers if needed.",
  },
  {
    category: "Account",
    q: "How do I create a watchlist?",
    a: "Click the heart icon on any movie or show to add it to My List. You need to be signed in.",
  },
  {
    category: "Features",
    q: "What is FlixParty?",
    a: "FlixParty lets you watch with friends in real-time. Create a party, share the code, and everyone syncs to the same playback.",
  },
  {
    category: "Features",
    q: "How do spoilers work?",
    a: "FlixVerse automatically hides episodes you haven't reached yet based on your watch history. You can reveal them with a click.",
  },
  {
    category: "Playback",
    q: "Can I use FlixVerse offline?",
    a: "FlixVerse supports offline caching for your watchlist and continue watching data. Actual video playback requires an internet connection.",
  },
];

const TABS: { id: HelpTab; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: "faq", label: "FAQ", icon: LifeBuoy, description: "Browse common questions and answers" },
  { id: "contact", label: "Contact Us", icon: Mail, description: "Send us a message" },
  { id: "account", label: "Account", icon: User, description: "Account settings and troubleshooting" },
  { id: "billing", label: "Billing", icon: CreditCard, description: "Subscriptions, payments, and invoices" },
  { id: "technical", label: "Technical", icon: Settings, description: "Playback, quality, and device issues" },
];

const ACCOUNT_FAQS: Faq[] = [
  {
    category: "Account",
    q: "How do I reset my password?",
    a: "Click \"Forgot password\" on the sign-in page. We'll send a reset link to your email address.",
  },
  {
    category: "Account",
    q: "Can I change my email address?",
    a: "Yes, go to Settings → Account → Email to update your email address. You'll need to verify the new address.",
  },
  {
    category: "Account",
    q: "How do I delete my account?",
    a: "Go to Settings → Account → Delete Account. This action is irreversible and will remove all your data.",
  },
  {
    category: "Account",
    q: "Can I have multiple profiles?",
    a: "Currently, FlixVerse supports one profile per account. Multiple profiles are planned for a future update.",
  },
];

const BILLING_FAQS: Faq[] = [
  {
    category: "Billing",
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, PayPal, and regional payment methods via Stripe.",
  },
  {
    category: "Billing",
    q: "How do I update my payment method?",
    a: "Go to Settings → Billing → Payment Methods to add or remove payment methods.",
  },
  {
    category: "Billing",
    q: "Can I get a refund?",
    a: "Refunds are handled on a case-by-case basis. Contact support with your order details for assistance.",
  },
  {
    category: "Billing",
    q: "Where can I find my invoices?",
    a: "Go to Settings → Billing → Invoice History to view and download all your invoices.",
  },
];

const TECHNICAL_FAQS: Faq[] = [
  {
    category: "Technical",
    q: "What are the minimum system requirements?",
    a: "FlixVerse works on any modern browser (Chrome, Firefox, Safari, Edge) with JavaScript enabled. For best quality, use the latest browser version.",
  },
  {
    category: "Technical",
    q: "Why is video quality low?",
    a: "Video quality adapts to your internet connection. You can manually select quality using the gear icon in the player. Minimum 5 Mbps for HD, 25 Mbps for 4K.",
  },
  {
    category: "Technical",
    q: "Does FlixVerse support Chromecast/AirPlay?",
    a: "Yes! Click the cast icon in the player to stream to Chromecast, AirPlay, or other supported devices.",
  },
  {
    category: "Technical",
    q: "Why does playback stutter?",
    a: "Try lowering the video quality, closing other browser tabs, or connecting via Ethernet instead of Wi-Fi.",
  },
];

const ALL_FAQS = [...FAQS, ...ACCOUNT_FAQS, ...BILLING_FAQS, ...TECHNICAL_FAQS];

function TabIcon({ icon: Icon, active, className = "" }: { icon: React.ComponentType<{ className?: string }>; active: boolean; className?: string }) {
  return (
    <Icon
      className={`h-5 w-5 transition-colors ${
        active ? "text-red-400" : "text-gray-400 group-hover:text-gray-200"
      } ${className}`}
    />
  );
}

function FAQSection({ faqs, title, icon: Icon }: { faqs: Faq[]; title: string; icon: React.ComponentType<{ className?: string }> }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(faqs.map((f) => f.category)))],
    [faqs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((f) => {
      const matchCat = category === "All" || f.category === category;
      const matchQ =
        !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [faqs, query, category]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
          aria-label={`Search ${title.toLowerCase()}`}
          className="focus-ring min-h-[48px] bg-white/5 border-white/10 pl-11 text-sm"
        />
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`chip transition-colors press-effect focus-ring min-h-[36px] ${
                category === c
                  ? "bg-gradient-to-r from-red-600 to-orange-500 text-white border-transparent"
                  : "hover:bg-white/10"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm rounded-2xl glass-panel">
          No results found. Try a different search or category.
        </div>
      ) : (
        <Reveal>
          <Accordion type="single" collapsible className="glass-panel rounded-2xl divide-y divide-white/5 px-2">
            {filtered.map((f, i) => (
              <AccordionItem key={i} value={`faq-${f.category}-${i}`} className="border-white/5 px-3">
                <AccordionTrigger className="text-left text-sm font-semibold text-white hover:text-red-400 hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-gray-400 leading-relaxed text-balance">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      )}
    </div>
  );
}

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot field (should remain empty)
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check - if filled, it's likely a bot
    if (website) {
      // Silently succeed but don't actually send
      setSubmitted(true);
      return;
    }

    if (!subject || !email || !message) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, email, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setSuccess(true);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12 glass-panel rounded-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-400">
          <CheckCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Message Sent</h2>
        <p className="text-gray-400 text-sm mb-6">
          Thank you for reaching out. We&apos;ll get back to you soon.
        </p>
        <Button variant="outline-glow" className="min-h-[44px]" onClick={() => setSubmitted(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Send Another Message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot field - hidden from humans */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {error && (
        <div className="glass-panel rounded-xl p-4 bg-red-500/10 border-red-500/20 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      <div>
        <Label
          htmlFor="subject"
          className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block"
        >
          Subject
        </Label>
        <select
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="focus-ring w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white transition-colors min-h-[44px]"
        >
          <option value="">Select a topic</option>
          <option value="bug">Bug Report</option>
          <option value="feature">Feature Request</option>
          <option value="account">Account Issue</option>
          <option value="billing">Billing Question</option>
          <option value="content">Content Report</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <Label
          htmlFor="email"
          className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block"
        >
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="your@email.com"
          className="focus-ring min-h-[44px] bg-white/5 border-white/10"
        />
      </div>

      <div>
        <Label
          htmlFor="message"
          className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block"
        >
          Message
        </Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          placeholder="Tell us what's on your mind…"
          className="focus-ring bg-white/5 border-white/10"
        />
      </div>

      <Button type="submit" variant="gradient" loading={loading} className="min-h-[44px] w-full sm:w-auto">
        <Send className="h-4 w-4" />
        Send Message
      </Button>
    </form>
  );
}

export default function HelpCenterPage({ searchParams }: { searchParams: { tab?: string } }) {
  const initialTab = (searchParams.tab as HelpTab) || "faq";
  const [activeTab, setActiveTab] = useState<HelpTab>(initialTab);

  // Update active tab when searchParams change
  useEffect(() => {
    if (searchParams.tab && TABS.some((t) => t.id === searchParams.tab)) {
      setActiveTab(searchParams.tab as HelpTab);
    }
  }, [searchParams.tab]);

  const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8 page-enter">
      <div className="max-w-7xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <a href="/" className="hover:text-white transition-colors focus-ring rounded">
            Home
          </a>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Help Center</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <Reveal>
              <div className="glass-panel rounded-2xl p-4 sticky top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
                <SectionHeader
                  eyebrow="Support"
                  title="Help Center"
                  className="mb-6 pb-4 border-b border-white/10"
                />

                <nav className="space-y-1" aria-label="Help Center sections">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left group flex items-center gap-3 rounded-xl px-4 py-3 transition-all focus-ring ${
                        activeTab === tab.id
                          ? "bg-gradient-to-r from-red-600/30 to-orange-500/30 text-white border border-white/10"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                      aria-current={activeTab === tab.id ? "page" : undefined}
                    >
                      <TabIcon icon={tab.icon} active={activeTab === tab.id} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{tab.label}</p>
                        <p className="text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors">
                          {tab.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </nav>
              </div>
            </Reveal>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Reveal>
              <SectionHeader eyebrow="Support" title={currentTab.label} />
            </Reveal>

            <Stagger>
              {activeTab === "faq" && (
                <Reveal>
                  <div className="glass-panel rounded-2xl p-6 sm:p-8">
                    <FAQSection faqs={FAQS} title="FAQ" icon={LifeBuoy} />
                  </div>
                </Reveal>
              )}

              {activeTab === "contact" && (
                <Reveal>
                  <div className="glass-panel rounded-2xl p-6 sm:p-8">
                    <p className="text-gray-400 text-sm mb-8 max-w-2xl text-balance">
                      Have a question or feedback? We&apos;d love to hear from you.
                    </p>
                    <ContactForm />
                  </div>
                </Reveal>
              )}

              {activeTab === "account" && (
                <Reveal>
                  <div className="glass-panel rounded-2xl p-6 sm:p-8">
                    <FAQSection faqs={ACCOUNT_FAQS} title="Account" icon={User} />
                  </div>
                </Reveal>
              )}

              {activeTab === "billing" && (
                <Reveal>
                  <div className="glass-panel rounded-2xl p-6 sm:p-8">
                    <FAQSection faqs={BILLING_FAQS} title="Billing" icon={CreditCard} />
                  </div>
                </Reveal>
              )}

              {activeTab === "technical" && (
                <Reveal>
                  <div className="glass-panel rounded-2xl p-6 sm:p-8">
                    <FAQSection faqs={TECHNICAL_FAQS} title="Technical" icon={Settings} />
                  </div>
                </Reveal>
              )}
            </Stagger>
          </main>
        </div>
      </div>
    </div>
  );
}