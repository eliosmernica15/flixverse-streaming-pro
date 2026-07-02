import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

import { getEnv } from "@/utils/env";

function getFirebaseConfig() {
  const apiKey = getEnv("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!apiKey) return null;

  return {
    apiKey,
    authDomain: getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;

  const config = getFirebaseConfig();
  if (!config) return null;

  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  }

  return app;
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
  }

  return authInstance;
}

export function getFirebaseDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!dbInstance) {
    dbInstance = getFirestore(firebaseApp);
  }

  return dbInstance;
}

export function requireFirebaseDb(): Firestore {
  const firestore = getFirebaseDb();
  if (!firestore) {
    throw new Error("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* environment variables.");
  }
  return firestore;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!storageInstance) {
    storageInstance = getStorage(firebaseApp);
  }

  return storageInstance;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(getEnv("NEXT_PUBLIC_FIREBASE_API_KEY"));
}

export default getFirebaseApp;
