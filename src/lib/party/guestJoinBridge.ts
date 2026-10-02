export type GuestJoinBridgePhase =
  | "idle"
  | "accepting"
  | "joining"
  | "resolving"
  | "prefetching"
  | "navigating"
  | "error";

export interface GuestJoinBridgeState {
  phase: GuestJoinBridgePhase;
  movieTitle?: string;
  hostName?: string;
  error?: string;
}

let state: GuestJoinBridgeState = { phase: "idle" };
const listeners = new Set<() => void>();

export function getGuestJoinBridgeState(): GuestJoinBridgeState {
  return state;
}

export function setGuestJoinBridge(partial: Partial<GuestJoinBridgeState>): void {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

export function resetGuestJoinBridge(): void {
  state = { phase: "idle" };
  listeners.forEach((l) => l());
}

export function subscribeGuestJoinBridge(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
