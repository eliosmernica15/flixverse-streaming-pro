"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Film, Tv, Home, Search, Heart, Sparkles, TrendingUp, User } from "lucide-react";

export const OPEN_COMMAND_PALETTE_EVENT = "flixverse:open-command";

const pages = [
  { href: "/", label: "Home", icon: Home },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/tv-shows", label: "TV Shows", icon: Tv },
  { href: "/new-and-popular", label: "New & Popular", icon: TrendingUp },
  { href: "/my-list", label: "My List", icon: Heart },
  { href: "/search", label: "Search", icon: Search },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/auth", label: "Sign In", icon: Sparkles },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="bg-zinc-950 border border-white/10 text-white">
      <CommandInput placeholder="Jump to a page or action..." className="text-white" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {pages.map((page) => (
            <CommandItem key={page.href} onSelect={() => navigate(page.href)}>
              <page.icon className="mr-2 h-4 w-4 text-red-400" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Shortcuts">
          <CommandItem onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("flixverse:focus-search")); }}>
            <Search className="mr-2 h-4 w-4" />
            Focus search
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      </div>
    </CommandDialog>
  );
}
