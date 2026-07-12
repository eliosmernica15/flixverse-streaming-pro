import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { usePythonNotifications } from "@/hooks/useNotificationsPython";
import { useFirebaseNotifications } from "@/hooks/useNotificationsFirebase";

const USE_PYTHON = process.env.NEXT_PUBLIC_USE_PYTHON_API === "true";

/** Notifications from Python SQLite API or Firestore fallback. */
export function useAppNotifications() {
  if (USE_PYTHON) {
    return usePythonNotifications();
  }
  return useFirebaseNotifications();
}

export { isPythonBackendEnabled };
