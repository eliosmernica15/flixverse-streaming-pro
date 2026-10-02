"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Send, CheckCircle, MessageSquare, LifeBuoy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // In production, this would send to a Cloud Function or API route
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 900);
  };

  const contactCards = [
    { icon: Mail, title: "Email Us", value: "support@flixverse.app", hint: "We reply within 24 hours" },
    { icon: MessageSquare, title: "Live Chat", value: "Available 24/7", hint: "For Premium members" },
    { icon: Clock, title: "Response Time", value: "Under 1 day", hint: "Average first reply" },
  ];

  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8 page-enter">
      <div className="max-w-5xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors focus-ring rounded">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Contact</span>
        </nav>

        <SectionHeader eyebrow="Support" title="Contact Us" />

        <p className="text-gray-400 text-sm mb-10 max-w-2xl text-balance">
          Have a question or feedback? We&apos;d love to hear from you.
        </p>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
          <Reveal>
            <div className="glass-panel rounded-2xl p-6 sm:p-8">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                    <CheckCircle className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Message Sent</h2>
                  <p className="text-gray-400 text-sm mb-6">
                    Thank you for reaching out. We&apos;ll get back to you soon.
                  </p>
                  <Button asChild variant="outline-glow" className="min-h-[44px]">
                    <Link href="/">Back to Home</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
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
              )}
            </div>
          </Reveal>

          <div className="space-y-4">
            {contactCards.map((c) => {
              const Icon = c.icon;
              return (
                <Reveal key={c.title}>
                  <div className="glass-panel rounded-2xl p-5 flex items-start gap-4 hover-lift-sm">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{c.title}</p>
                      <p className="text-sm text-gray-300">{c.value}</p>
                      <p className="text-xs text-gray-500">{c.hint}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
            <Reveal>
              <div className="glass-panel rounded-2xl p-5 flex items-start gap-4 hover-lift-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Help Center</p>
                  <p className="text-sm text-gray-300">Browse common questions</p>
                  <Link href="/help" className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1 mt-1 focus-ring rounded">
                    Visit help &amp; FAQ
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
