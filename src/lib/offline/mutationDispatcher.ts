import { getEnv } from "@/utils/env";
import { MutationAction, saveMutationToOutbox, getOutboxMutations, clearOutboxMutation } from "@/lib/offlineStorage";
// In a real implementation, we would import Firestore methods here.

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export class MutationDispatcher {
  private static isOnline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine;
  }

  static async dispatch(type: MutationAction["type"], payload: any): Promise<void> {
    const action: MutationAction = {
      id: generateId(),
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    if (this.isOnline()) {
      try {
        await this.processAction(action);
      } catch (error) {
        console.error("Failed to process online mutation, saving to outbox", error);
        await saveMutationToOutbox(action);
      }
    } else {
      console.log("Offline: Saving mutation to outbox", action.type);
      await saveMutationToOutbox(action);
    }
  }

  static async syncOutbox(): Promise<void> {
    if (!this.isOnline()) return;

    const mutations = await getOutboxMutations();
    if (mutations.length === 0) return;

    console.log(`Syncing ${mutations.length} mutations from outbox...`);

    for (const action of mutations) {
      try {
        await this.processAction(action);
        await clearOutboxMutation(action.id);
      } catch (error) {
        console.error(`Failed to sync mutation ${action.id}`, error);
        // Will retry on next sync
      }
    }
  }

  private static async processAction(action: MutationAction): Promise<void> {
    // Here we would use the actual Firestore functions based on action.type
    // For now, we will just log the simulated execution
    console.log(`Processing action to Firebase: ${action.type}`, action.payload);
    
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // TODO: implement actual Firestore mutation calls.
    // e.g. switch(action.type) { case 'ADD_WATCHLIST': await addToFirestoreWatchlist(action.payload); break; }
  }
}
