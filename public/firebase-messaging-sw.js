// Firebase Cloud Messaging background handler.
// Registered under scope /push/ so it coexists with the app shell SW at /sw.js.
// Config is fetched from /firebase-messaging-config.js (public NEXT_PUBLIC_* values)
// instead of being hardcoded — nothing secret ever appears here.
importScripts(
  "https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js",
  "/firebase-messaging-config.js"
);

if (self.__FXV_FCM_CONFIG && self.__FXV_FCM_CONFIG.projectId) {
  firebase.initializeApp(self.__FXV_FCM_CONFIG);
  firebase.messaging().onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || payload?.data?.title || "FlixVerse";
    const body = payload?.notification?.body || payload?.data?.body || "New activity on FlixVerse";
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192-maskable.png",
      tag: "flixverse-push",
      data: { url: payload?.data?.url || "/" },
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
