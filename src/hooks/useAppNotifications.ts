import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { usePythonNotifications } from "@/hooks/useNotificationsPython";
import { useFirebaseNotifications } from "@/hooks/useNotificationsFirebase";

/** Notifications from Python Postgres API or Firestore fallback. */
export function useAppNotifications() {
  const python = usePythonNotifications();
  const firebase = useFirebaseNotifications();
  return isPythonBackendEnabled() ? python : firebase;
}

export { isPythonBackendEnabled };
