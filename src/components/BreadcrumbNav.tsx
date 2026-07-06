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
      className={`flex items-center gap-1.5 text-xs text-gray-500 overflow-x-auto scrollbar-hide ${className}`}
    >
      <Link
        href="/"
        className="flex items-center gap-1 hover:text-white transition-colors shrink-0"
      >
        <Home className="w-3 h-3" />
        <span>Home</span>
      </Link>

      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 shrink-0">
          <ChevronRight className="w-3 h-3 text-gray-600" />
          {item.href ? (
            <Link href={item.href} className="hover:text-white transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-300 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
