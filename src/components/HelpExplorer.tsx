"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Reveal } from "@/components/Reveal";

export type Faq = { q: string; a: string; category: string };

export function HelpExplorer({ faqs }: { faqs: Faq[] }) {
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
          placeholder="Search help articles…"
          aria-label="Search help articles"
          className="focus-ring min-h-[48px] bg-white/5 border-white/10 pl-11 text-sm"
        />
      </div>

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

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm rounded-2xl glass-panel">
          No results found. Try a different search or category.
        </div>
      ) : (
        <Reveal>
          <Accordion
            type="single"
            collapsible
            className="glass-panel rounded-2xl divide-y divide-white/5 px-2"
          >
            {filtered.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-white/5 px-3">
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

export default HelpExplorer;
