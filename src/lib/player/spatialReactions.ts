/**
 * Floating spatial reactions — emoji particles broadcast through
 * the party real-time layer and rendered as CSS-animated particles.
 */

export type SpatialReactionType = "🔥" | "😂" | "❤️" | "😮" | "💀" | "🎬" | "🍿";

export interface SpatialReactionEvent {
  id: string;
  senderId: string;
  senderName: string;
  emoji: SpatialReactionType;
  xPercent: number; // 0–100, horizontal position over video
  yPercent: number; // 0–100, vertical position over video
  timestamp: number;
}

const REACTION_EMOJIS: SpatialReactionType[] = [
  "🔥",
  "😂",
  "❤️",
  "😮",
  "💀",
  "🎬",
  "🍿",
];

export function availableReactions(): SpatialReactionType[] {
  return [...REACTION_EMOJIS];
}

export function generateReactionId(): string {
  return `reac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
