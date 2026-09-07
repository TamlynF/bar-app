/* Service worker for Don Fenticas (public + admin share the origin).
   Deliberately minimal:
   - No caching of app pages. Everything is behind auth or changes nightly,
     and a stale cached page of the admin is worse than no page.
   - Exists so Chrome/Edge consider the site installable (fires
     `beforeinstallprompt`) and so Web Push has somewhere to land.
   - The only thing served from cache is /offline.html, shown when a
     page navigation fails with no network. */

const VERSION = "df-sw-v1"
const OFFLINE_URL = "/offline.html"

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(VERSION).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting())
    )
})

self.addEventListener("activate", (event) => {
    // Drop caches from older versions of this worker.
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    )
})

self.addEventListener("fetch", (event) => {
    // Only intercept top-level page loads; let assets, API calls and
    // Server Actions go straight to the network untouched.
    if (event.request.mode !== "navigate") return

    event.respondWith(
        fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    )
})

/* --- Web Push (wired up but unused until VAPID keys + a subscribe flow exist) --- */

self.addEventListener("push", (event) => {
    if (!event.data) return
    let payload = {}
    try { payload = event.data.json() } catch { payload = { title: "Don Fenticas", body: event.data.text() } }

    event.waitUntil(
        self.registration.showNotification(payload.title ?? "Don Fenticas", {
            body: payload.body ?? "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            data: { url: payload.url ?? "/dashboard" },
        })
    )
})

self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    const url = event.notification.data?.url ?? "/dashboard"
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
            const existing = wins.find((w) => "focus" in w)
            if (existing) { existing.navigate(url); return existing.focus() }
            return self.clients.openWindow(url)
        })
    )
})
