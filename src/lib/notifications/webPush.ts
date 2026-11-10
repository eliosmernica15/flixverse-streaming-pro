/**
 * Web push registration (FCM) end-to-end:
 *  1. ask for Notification permission,
 *  2. register the FCM service worker under its own scope,
 *  3. get an FCM token (requires NEXT_PUBLIC_FIREBASE_VAPID_KEY),
 *  4. POST it to the Python API so dispatch can fan out.
 * No-op (with a warning) when unsupported or the VAPID key is absent.
 */
import { pythonFetch } from "@/lib/pythonApi/client";

const FCM_SCOPE = "/firebase-cloud-messaging-push-scope";

export type PushRegistrationResult =
  | { status: "granted" }
  | { status: "denied" | "default" }
  | { status: "unsupported" }
  | { status: "skipped"; reason: string };

export async function registerWebPush(): Promise<PushRegistrationResult> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return { status: "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { status: permission };

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("[push] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set; in-app alerts stay, FCM is skipped.");
    return { status: "skipped", reason: "missing-vapid-key" };
  }

  try {
    const [{ getMessaging, getToken, isSupported }, firebaseModule] = await Promise.all([
      import("firebase/messaging"),
      import("firebase/app"),
    ]);
    if (!(await isSupported())) return { status: "unsupported" };

    const client = await import("@/integrations/firebase/client");
    const app = client.default();
    if (!app) return { status: "skipped", reason: "firebase-not-configured" };

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: FCM_SCOPE,
    });
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { status: "skipped", reason: "no-token" };

    await pythonFetch("/notifications/register-token", {
      method: "POST",
      body: JSON.stringify({ token, platform: "web" }),
    });
    return { status: "granted" };
  } catch (err) {
    console.error("[push] registration failed:", err);
    return { status: "skipped", reason: "registration-failed" };
  }
}

export async function unregisterWebPush(): Promise<void> {
  try {
    const { getMessaging, deleteToken } = await import("firebase/messaging");
    const client = await import("@/integrations/firebase/client");
    const app = client.default();
    if (!app) return;
    await deleteToken(getMessaging(app));
  } catch (err) {
    console.warn("[push] deleteToken failed (token may not exist):", err);
  }
}
