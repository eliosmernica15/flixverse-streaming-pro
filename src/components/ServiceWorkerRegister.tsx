"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and applies updates safely.
 *
 * Two subtleties that previously caused visible damage:
 *
 *  1. **No reload on first install.** `activate` calls `clients.claim()`, so
 *     the very first registration flips a page from "no controller" to
 *     "controlled" — which fires `controllerchange`. Reloading there means
 *     every first-time visitor loses their first seconds on the site (and
 *     whatever they had already typed) for no benefit: the page is already
 *     running the current build. We only reload when a controller existed
 *     *before* the new worker took over.
 *
 *  2. **Never reload over a live player.** A reload mid-film drops the watch
 *     position and tears down the party WebRTC connections. If the player is
 *     open we defer the update until the player unmounts.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reloaded = false;
    let hadController = Boolean(navigator.serviceWorker.controller);
    let pendingWorker: ServiceWorker | null = null;

    const playerIsOpen = () =>
      typeof document !== "undefined" && document.querySelector(".player-shell") !== null;

    const applyPending = () => {
      if (!pendingWorker) return;
      const worker = pendingWorker;
      pendingWorker = null;
      try {
        worker.postMessage({ type: "SKIP_WAITING" });
      } catch {
        // worker already gone
      }
    };

    const onControllerChange = () => {
      // First-ever claim: adopt the worker silently, no reload.
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloaded) return;
      if (playerIsOpen()) {
        // The update is already applied at the network layer; reloading now
        // would only interrupt playback. Leave the page alone.
        return;
      }
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (reg.waiting) pendingWorker = reg.waiting;
        await reg.update();

        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state !== "installed") return;
            if (!navigator.serviceWorker.controller) return;
            pendingWorker = worker;
            // Apply immediately when nothing is playing; otherwise the next
            // navigation or player close picks it up.
            if (!playerIsOpen()) applyPending();
          });
        });
      } catch {
        // Service worker registration is best-effort.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", () => void register(), { once: true });
    }

    /**
     * Apply a deferred update the moment the player closes.
     *
     * The observer is only attached while an update is actually pending — a
     * subtree observer on <body> that is always listening would wake up on
     * every render of every page for an event that happens once per deploy.
     */
    let observer: MutationObserver | null = null;
    const watchForPlayerClose = () => {
      if (observer || !pendingWorker) return;
      observer = new MutationObserver(() => {
        if (!pendingWorker) {
          observer?.disconnect();
          observer = null;
          return;
        }
        if (!playerIsOpen()) {
          observer?.disconnect();
          observer = null;
          applyPending();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    // A pending update is rare, so a slow poll is a fine wake-up for the
    // observer attach/detach and costs nothing in the common case.
    const watchTimer = window.setInterval(watchForPlayerClose, 2000);
    watchForPlayerClose();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.clearInterval(watchTimer);
      observer?.disconnect();
      observer = null;
    };
  }, []);

  return null;
}
