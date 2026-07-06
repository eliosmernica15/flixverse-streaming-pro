/**
 * @deprecated Use `@/lib/player/embedControls` instead.
 * This module re-exports the provider-aware control layer for backwards compatibility.
 */
export {
  sendEmbedAction,
  sendEmbedVolume,
  sendEmbedSeek,
  sendEmbedVolumeStep,
  isPlayerShortcutKey,
} from "./player/embedControls";
export type { EmbedAction } from "./player/embedControls";
