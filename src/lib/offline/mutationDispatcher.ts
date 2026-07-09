import { MutationAction, saveMutationToOutbox, getOutboxMutations, clearOutboxMutation } from "@/lib/offlineStorage";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  setDoc,
} from "firebase/firestore";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getDb() {
  return getFirestore();
}

export class MutationDispatcher {
  private static isOnline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine;
  }

  static async dispatch(type: MutationAction["type"], payload: Record<string, unknown>): Promise<void> {
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
      await saveMutationToOutbox(action);
    }
  }

  static async syncOutbox(): Promise<void> {
    if (!this.isOnline()) return;

    const mutations = await getOutboxMutations();
    if (mutations.length === 0) return;

    for (const action of mutations) {
      try {
        await this.processAction(action);
        await clearOutboxMutation(action.id);
      } catch (error) {
        console.error(`Failed to sync mutation ${action.id}`, error);
      }
    }
  }

  private static async processAction(action: MutationAction): Promise<void> {
    const db = getDb();
    const p = action.payload as Record<string, unknown>;

    switch (action.type) {
      case "ADD_WATCHLIST": {
        const userId = p.userId as string;
        if (!userId) throw new Error("userId required");
        await addDoc(collection(db, "user_movie_lists"), {
          user_id: userId,
          movie_id: p.movieId,
          movie_title: p.movieTitle,
          movie_poster_path: p.posterPath ?? null,
          media_type: p.mediaType ?? "movie",
          added_at: Date.now(),
        });
        break;
      }
      case "REMOVE_WATCHLIST": {
        const userId = p.userId as string;
        const movieId = p.movieId as number;
        const q = query(
          collection(db, "user_movie_lists"),
          where("user_id", "==", userId),
          where("movie_id", "==", movieId)
        );
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        break;
      }
      case "RATE_CONTENT": {
        const userId = p.userId as string;
        const contentId = p.contentId as number;
        const q = query(
          collection(db, "content_ratings"),
          where("user_id", "==", userId),
          where("content_id", "==", contentId)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(collection(db, "content_ratings"), {
            user_id: userId,
            content_id: contentId,
            content_type: p.contentType ?? "movie",
            rating: p.rating,
            created_at: Date.now(),
          });
        } else {
          await setDoc(snap.docs[0].ref, { rating: p.rating, updated_at: Date.now() }, { merge: true });
        }
        break;
      }
      case "UPDATE_PROGRESS": {
        const userId = p.userId as string;
        const contentId = p.contentId as number;
        const q = query(
          collection(db, "watch_history"),
          where("user_id", "==", userId),
          where("content_id", "==", contentId)
        );
        const snap = await getDocs(q);
        const data = {
          user_id: userId,
          content_id: contentId,
          content_type: p.contentType ?? "movie",
          content_title: p.contentTitle,
          content_poster_path: p.posterPath ?? null,
          progress_seconds: p.progressSeconds ?? 0,
          total_duration_seconds: p.totalDurationSeconds ?? 0,
          completed: p.completed ?? false,
          watched_at: Date.now(),
          season: p.season ?? null,
          episode: p.episode ?? null,
        };
        if (snap.empty) {
          await addDoc(collection(db, "watch_history"), data);
        } else {
          await setDoc(snap.docs[0].ref, data, { merge: true });
        }
        break;
      }
      default:
        console.warn("Unknown mutation type:", action.type);
    }
  }
}
