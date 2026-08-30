"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbNav({ items, className = "" }: BreadcrumbNavProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs text-gray-500 scrollbar-hide pr-2 ${className}`}
    >
      <Link
        href="/"
        className="flex shrink-0 items-center gap-1 rounded-md transition-colors hover:text-white focus-ring"
      >
        <Home className="h-3 w-3" />
        <span>Home</span>
      </Link>

      {items.map((item, i) => (
        <span key={i} className="flex shrink-0 items-center gap-1.5">
          <span className="chip px-1.5 py-0.5 text-gray-600" aria-hidden>
            <ChevronRight className="h-3 w-3" />
          </span>
          {item.href ? (
            <Link href={item.href} className="rounded-md transition-colors hover:text-white focus-ring">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-gradient">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
