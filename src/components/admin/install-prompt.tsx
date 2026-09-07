"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { Share, SquarePlus, X, Download } from "lucide-react"

/* Install-to-home-screen nudge for the admin.
   - Hidden entirely once the app is running standalone (already installed).
   - Android/Chrome: `beforeinstallprompt` fires, so we can show a real
     Install button that opens the native prompt.
   - iOS: there is no install API and no prompt, so the only option is to
     tell the user the two taps (Share → Add to Home Screen).
   - "Not now" hides it for 14 days so it isn't nagging every visit.

   Platform detection goes through useSyncExternalStore rather than an
   effect + setState: the server snapshot is "ssr" (renders nothing), the
   client snapshot is computed once from window/navigator, and React handles
   the hydration hand-off. This keeps the React Compiler lint
   (react-hooks/set-state-in-effect) happy and avoids a flash on load. */

const DISMISS_KEY = "df-admin-install-dismissed-until"
const DISMISS_DAYS = 14

type Platform = "ssr" | "installed" | "dismissed" | "ios" | "other"

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function detectPlatform(): Platform {
    if (typeof window === "undefined") return "ssr"

    const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // Older iOS exposes this non-standard flag instead.
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return "installed"

    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (until > Date.now()) return "dismissed"

    const ua = navigator.userAgent
    // iPadOS reports as Mac; the touch-points check catches it.
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)
    return ios ? "ios" : "other"
}

// Nothing to subscribe to - the snapshot only changes on reload.
const subscribeNoop = () => () => {}
const getServerSnapshot = (): Platform => "ssr"

export default function InstallPrompt() {
    const platform = useSyncExternalStore(subscribeNoop, detectPlatform, getServerSnapshot)
    const [dismissed, setDismissed] = useState(false)
    const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

    useEffect(() => {
        if (platform !== "other") return

        // Chrome/Edge on Android (and desktop) fire this when the site is
        // installable. Hold the event so the button can trigger the prompt.
        // setState here is inside the event callback, not the effect body.
        const onPrompt = (e: Event) => {
            e.preventDefault()
            setInstallEvent(e as BeforeInstallPromptEvent)
        }
        const onInstalled = () => setDismissed(true)

        window.addEventListener("beforeinstallprompt", onPrompt)
        window.addEventListener("appinstalled", onInstalled)
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt)
            window.removeEventListener("appinstalled", onInstalled)
        }
    }, [platform])

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000))
        setDismissed(true)
    }

    const install = async () => {
        if (!installEvent) return
        await installEvent.prompt()
        const { outcome } = await installEvent.userChoice
        if (outcome === "accepted") setDismissed(true)
        else dismiss()
    }

    // iOS: always show the instructions. Other: only once Chrome has told us
    // the site is installable, otherwise there's no button to offer.
    const visible =
        !dismissed && (platform === "ios" || (platform === "other" && installEvent !== null))

    if (!visible) return null

    const ios = platform === "ios"

    return (
        <div
            role="region"
            aria-label="Install the app"
            className="mx-1 mb-3 rounded-2xl border border-admin-line bg-admin-card p-4 shadow-sm sm:mx-0"
        >
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-admin-primary-soft text-admin-primary">
                    <Download className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-tight font-bold text-admin-ink">
                        Add DF Admin to your home screen
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-admin-muted">
                        Opens full-screen without the browser bar, and you can get notifications for new requests.
                    </p>

                    {ios && (
                        /* iOS can't prompt, so spell out the two taps with the
                           same glyphs iOS uses, so they're recognisable. */
                        <ol className="mt-3 space-y-1.5 text-[13px] text-admin-ink">
                            <li className="flex items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-admin-surface text-[11px] font-semibold">1</span>
                                Tap <Share className="inline h-4 w-4 text-admin-info" aria-hidden="true" /> <span className="font-semibold">Share</span> in the browser bar
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-admin-surface text-[11px] font-semibold">2</span>
                                Choose <SquarePlus className="inline h-4 w-4" aria-hidden="true" /> <span className="font-semibold">Add to Home Screen</span>
                            </li>
                        </ol>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                        {!ios && (
                            <button
                                type="button"
                                onClick={install}
                                className="rounded-xl bg-[#34451F] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#283719]"
                            >
                                Install
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={dismiss}
                            className="rounded-xl border border-[#D8D5C8] px-4 py-2 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE]"
                        >
                            Not now
                        </button>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss"
                    className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}