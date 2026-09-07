"use client"

import { useEffect } from "react"

/* Registers /sw.js once per page load. Renders nothing.
   Mounted in the root layout so both the public site and the admin get it:
   Chrome needs a registered worker before it will offer "Install", and
   iOS/Android both need one before push notifications can be subscribed. */
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") return // avoids stale-worker pain in dev
        if (!("serviceWorker" in navigator)) return

        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
            console.warn("Service worker registration failed", err)
        })
    }, [])

    return null
}
