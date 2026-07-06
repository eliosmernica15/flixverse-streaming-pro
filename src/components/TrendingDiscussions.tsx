"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Star, TrendingUp } from "lucide-react";

interface TrendingItem {
  id: string;
  text: string;
  author: string;
  likes: number;
  timestamp: number;
  type: "comment" | "review" | "timeline";
}

interface TrendingDiscussionsProps {
  tmdbId: number;
}

export function TrendingDiscussions({ tmdbId }: TrendingDiscussionsProps) {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrending = async () => {
      try {
        const { getFirestore, collection, query, where, orderBy, limit, getDocs } = await import("firebase/firestore");
        const db = getFirestore();

        // Fetch recent high-engagement comments
        const commentsQ = query(
          collection(db, "comments"),
          where("content_id", "==", tmdbId),
          orderBy("likes_count", "desc"),
          limit(3)
        );
        const commentsSnap = await getDocs(commentsQ);

        // Fetch recent timeline comments
        const timelineQ = query(
          collection(db, "timeline_comments"),
          where("tmdbId", "==", tmdbId),
          orderBy("likesCount", "desc"),
          limit(3)
        );
        const timelineSnap = await getDocs(timelineQ);

        const allItems: TrendingItem[] = [];

        commentsSnap.forEach((d) => {
          const data = d.data();
          if ((data.likes_count || 0) > 0) {
            allItems.push({
              id: d.id,
              text: data.text,
              author: data.user_display_name || "Anonymous",
              likes: data.likes_count || 0,
              timestamp: data.created_at,
              type: "comment",
            });
          }
        });

        timelineSnap.forEach((d) => {
          const data = d.data();
          if ((data.likesCount || 0) > 0) {
            allItems.push({
              id: d.id,
              text: data.text,
              author: data.userDisplayName || "Anonymous",
              likes: data.likesCount || 0,
              timestamp: data.createdAt,
              type: "timeline",
            });
          }
        });

        allItems.sort((a, b) => b.likes - a.likes);
        setItems(allItems.slice(0, 5));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    void loadTrending();
  }, [tmdbId]);

  if (loading || items.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-red-400" />
        <h3 className="text-sm font-bold text-white">Trending Discussions</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-300 line-clamp-2">{item.text}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-500">{item.author}</span>
                <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                  <Star className="w-2.5 h-2.5" />
                  {item.likes}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
