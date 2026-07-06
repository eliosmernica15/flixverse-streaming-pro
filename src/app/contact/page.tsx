"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Send, CheckCircle } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send to a Cloud Function or API route
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-300">Contact</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Contact Us</h1>
        <p className="text-gray-400 text-sm mb-8">Have a question or feedback? We&apos;d love to hear from you.</p>

        {submitted ? (
          <div className="text-center py-16">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Message Sent</h2>
            <p className="text-gray-400 text-sm mb-6">Thank you for reaching out. We&apos;ll get back to you soon.</p>
            <Link href="/" className="text-red-400 text-sm hover:underline">
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
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
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="your@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                placeholder="Tell us what's on your mind…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 resize-none"
              />
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
            >
              <Send className="w-4 h-4" />
              Send Message
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
