import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export { getAuth };

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

function parseServiceAccount():
  | { project_id: string; client_email: string; private_key: string }
  | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
    } catch {
      return null;
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

/** Server-side Firestore (bypasses security rules). Returns null if Admin is not configured. */
export function getAdminDb(): Firestore | null {
  if (adminDb) return adminDb;

  const serviceAccount = parseServiceAccount();
  const projectId =
    serviceAccount?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  try {
    if (!getApps().length) {
      if (serviceAccount) {
        adminApp = initializeApp({
          credential: cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key,
          }),
          projectId: serviceAccount.project_id,
        });
      } else {
        adminApp = initializeApp({ projectId });
      }
    }
    adminDb = getFirestore();
    return adminDb;
  } catch (err) {
    console.error("Firebase Admin init failed:", err);
    return null;
  }
}
