import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Notification } from "@/integrations/firebase/types";
import { pythonFetch } from "@/lib/pythonApi/client";
import { getPythonWsBase, isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { getFirebaseAuth } from "@/integrations/firebase/client";

export function usePythonNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !isPythonBackendEnabled()) return;
    try {
      const data = await pythonFetch<{ notifications: Notification[]; unreadCount: number }>(
        "/notifications"
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error("[notifications/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !isPythonBackendEnabled()) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    void refresh();

    const poll = setInterval(() => void refresh(), 15000);

    void (async () => {
      const auth = getFirebaseAuth();
      const token = await auth?.currentUser?.getIdToken();
      if (!token) return;

      const ws = new WebSocket(`${getPythonWsBase()}/ws/notifications?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type?: string;
            notification?: Notification;
          };
          if (msg.type === "notification" && msg.notification) {
            setNotifications((prev) => [msg.notification!, ...prev.filter((n) => n.id !== msg.notification!.id)].slice(0, 50));
            setUnreadCount((c) => c + 1);
          }
        } catch {
          /* ignore */
        }
      };
    })();

    return () => {
      clearInterval(poll);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user, refresh]);

  const markAsRead = useCallback(async (id: string) => {
    await pythonFetch(`/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await pythonFetch("/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    await pythonFetch(`/notifications/${id}`, { method: "DELETE" });
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      setUnreadCount(next.filter((n) => !n.read).length);
      return next;
    });
  }, []);

  const clearAll = useCallback(async () => {
    await pythonFetch("/notifications", { method: "DELETE" });
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    hasUnread: unreadCount > 0,
    refresh,
  };
}
