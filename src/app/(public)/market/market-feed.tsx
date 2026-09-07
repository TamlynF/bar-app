"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, BellRing, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatGbp } from "@/lib/price";
import type { MarketEventPayload } from "@/lib/market/tick";
import { useMarketState } from "./use-market-state";
import { removeMarketPushSubscription, saveMarketPushSubscription } from "./actions";
import {
  DirectionArrow,
  Sparkline,
  StockBadge,
  directionClass,
  eventCopy,
  formatChangePct,
} from "./market-ui";

/* iOS (and some Android browsers) refuse `new Notification()` from page
   script and only show notifications raised through the service worker, so
   prefer the registration when one is available. */
async function systemNotify(events: MarketEventPayload[]) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const alerts = events.filter(
    (event) =>
      event.kind === "price_drop" || event.kind === "out_of_stock" || event.kind === "low_stock" || event.kind === "crash"
  );
  if (alerts.length === 0) return;

  let registration: ServiceWorkerRegistration | null = null;
  if ("serviceWorker" in navigator) {
    try {
      registration = await navigator.serviceWorker.ready;
    } catch {
      registration = null;
    }
  }
  for (const event of alerts) {
    try {
      if (registration) {
        await registration.showNotification("Market Night", {
          body: eventCopy(event),
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `market-${event.id}`,
          data: { url: "/market" },
        });
      } else {
        new Notification("Market Night", { body: eventCopy(event) });
      }
    } catch {
      /* notification blocked by the platform - the toast already showed */
    }
  }
}

const subscribeNever = () => () => {};
const readNotifyGranted = () =>
  typeof Notification !== "undefined" && Notification.permission === "granted";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/* "on" = this phone has a live Web Push subscription registered with us, so
   alerts arrive even with the page closed. "page-only" = the browser grants
   notifications but can't do background push (or we have no VAPID key), so
   we fall back to alerting while the page is open. "needs-install" = iOS in
   Safari, which only allows push once the site is on the home screen. */
type PushState = "unknown" | "on" | "page-only" | "needs-install";

function applicationServerKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

function isIosBrowserTab(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function currentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function registerPush(watched: number[]): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(VAPID_PUBLIC_KEY!),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const result = await saveMarketPushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    watchedInstrumentIds: watched,
    userAgent: navigator.userAgent,
  });
  return result.ok;
}

const WATCH_KEY = "df-market-watch";
const WATCH_EVENT = "df-market-watch-change";
const MUTE_KEY = "df-market-alerts-muted";
const MUTE_EVENT = "df-market-alerts-muted-change";

function readMutedRaw(): string {
  try {
    return localStorage.getItem(MUTE_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribeMuted(onChange: () => void): () => void {
  window.addEventListener(MUTE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(MUTE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/* Browser permission can't be handed back from a page, so "Turn off" is a
   local mute on top of it: nothing fires while set, and re-enabling skips the
   permission prompt because the grant is still there. */
function useAlertsMuted(): [boolean, (muted: boolean) => void] {
  const raw = useSyncExternalStore(subscribeMuted, readMutedRaw, () => "");
  const setMuted = (muted: boolean) => {
    try {
      if (muted) localStorage.setItem(MUTE_KEY, "1");
      else localStorage.removeItem(MUTE_KEY);
    } catch {
      /* private mode - the event still updates this page load */
    }
    window.dispatchEvent(new Event(MUTE_EVENT));
  };
  return [raw === "1", setMuted];
}

function readWatchedRaw(): string {
  try {
    return localStorage.getItem(WATCH_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribeWatched(onChange: () => void): () => void {
  window.addEventListener(WATCH_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(WATCH_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function parseWatched(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
}

/* Drinks the guest has tapped the bell on. Lives in localStorage so it
   survives reloads on the same phone; the raw string is the store snapshot
   so useSyncExternalStore sees a stable value between changes. */
function useWatchedDrinks(): [number[], (id: number) => void] {
  const raw = useSyncExternalStore(subscribeWatched, readWatchedRaw, () => "[]");
  const watched = parseWatched(raw);
  const toggle = (id: number) => {
    const next = watched.includes(id) ? watched.filter((w) => w !== id) : [...watched, id];
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(next));
    } catch {
      /* private mode - the toggle still works for this page load via the event */
    }
    window.dispatchEvent(new Event(WATCH_EVENT));
  };
  return [watched, toggle];
}

export default function MarketFeed() {
  const { state, feed, fresh } = useMarketState();
  const alreadyGranted = useSyncExternalStore(subscribeNever, readNotifyGranted, () => false);
  const [justGranted, setJustGranted] = useState(false);
  const [muted, setMuted] = useAlertsMuted();
  const notifyEnabled = (alreadyGranted || justGranted) && !muted;
  const announcedRef = useRef(0);
  const [watched, toggleWatched] = useWatchedDrinks();
  const [pushState, setPushState] = useState<PushState>("unknown");
  const instruments = state?.instruments ?? [];

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      if (!pushSupported()) {
        if (!cancelled) setPushState(isIosBrowserTab() ? "needs-install" : "page-only");
        return;
      }
      try {
        const subscription = await currentPushSubscription();
        if (!cancelled) setPushState(subscription ? "on" : "page-only");
      } catch {
        if (!cancelled) setPushState("page-only");
      }
    }
    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggleWatch = (id: number) => {
    const next = watched.includes(id) ? watched.filter((w) => w !== id) : [...watched, id];
    toggleWatched(id);
    if (pushState === "on") {
      registerPush(next).catch(() => {
        toast.error("Couldn't update your alerts - check your connection.");
      });
    }
  };
  const watchedNamesKey = instruments
    .filter((instrument) => watched.includes(instrument.id))
    .map((instrument) => instrument.name)
    .join("\u0000");

  useEffect(() => {
    if (fresh.length === 0) return;
    const newest = fresh[fresh.length - 1];
    if (newest.id <= announcedRef.current) return;
    announcedRef.current = newest.id;
    if (muted) return;

    const watchedNames = new Set(watchedNamesKey ? watchedNamesKey.split("\u0000") : []);
    const relevant =
      watchedNames.size === 0
        ? fresh
        : fresh.filter((event) => event.kind === "crash" || (event.name != null && watchedNames.has(event.name)));
    if (relevant.length === 0) return;

    for (const event of relevant) {
      if (event.kind === "price_drop" || event.kind === "crash") {
        toast.success(eventCopy(event));
      } else if (event.kind === "out_of_stock" || event.kind === "low_stock") {
        toast.warning(eventCopy(event));
      } else {
        toast(eventCopy(event));
      }
    }
    void systemNotify(relevant);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(150);
    }
  }, [fresh, watchedNamesKey, muted]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      toast.error("This browser doesn't support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setJustGranted(permission === "granted");
    if (permission !== "granted") return;
    setMuted(false);

    if (pushSupported()) {
      try {
        const registered = await registerPush(watched);
        if (registered) {
          setPushState("on");
          toast.success("Alerts on - we'll buzz your phone even when it's locked.");
          return;
        }
      } catch {
        /* fall through to page-open alerts */
      }
    }
    toast.success("You'll be pinged when prices drop while this page is open.");
  }

  async function disableNotifications() {
    setMuted(true);
    if (pushSupported()) {
      try {
        const subscription = await currentPushSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          await removeMarketPushSubscription(endpoint);
        }
        setPushState("page-only");
      } catch {
        /* the local mute already silences this phone; the server row expires on its own */
      }
    }
    toast("Alerts off.");
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-stone-400">
        <TrendingUp className="h-8 w-8 animate-pulse" aria-hidden="true" />
        <p className="font-black text-xs tracking-widest uppercase">Opening the floor…</p>
      </div>
    );
  }

  if (state.status === "closed") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-20 text-center">
        <TrendingUp className="h-10 w-10 text-stone-500" aria-hidden="true" />
        <p className="font-black text-2xl tracking-tighter text-ink uppercase">
          Markets closed
        </p>
        <p className="max-w-xs text-sm text-stone-400">
          The trading floor opens on market nights. Check the schedule and come thirsty.
        </p>
      </div>
    );
  }

  const watchedCount = instruments.filter((instrument) => watched.includes(instrument.id)).length;

  return (
    <div className="space-y-8">
      {state.crashActive && (
        <div className="ad-blink rounded-2xl border border-[#FF6B35]/40 bg-[#FF6B35]/10 px-4 py-3 text-center font-black text-sm tracking-widest text-[#FF6B35] uppercase">
          Market crash - buy the dip
        </div>
      )}

      {notifyEnabled ? (
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#FDCC4B]" aria-hidden="true" />
          <p className="text-[12px] leading-relaxed text-stone-400">
            <span className="font-black text-xs tracking-widest text-ink uppercase">Alerts on</span>
            {pushState === "on" && " - they'll reach your phone even when it's locked."}
            {pushState === "page-only" && " - they arrive while this page is open."}{" "}
            {watchedCount > 0
              ? `Watching ${watchedCount} ${watchedCount === 1 ? "drink" : "drinks"}: you'll only hear about those, plus a market crash.`
              : "Tap the bell on a drink to only hear about that one."}
          </p>
          <button
            type="button"
            onClick={disableNotifications}
            className="-my-1 -mr-2 ml-auto flex min-h-11 shrink-0 items-center self-center rounded-xl px-3 font-black text-[10px] tracking-widest text-stone-400 uppercase transition-colors hover:bg-white/5 hover:text-white"
          >
            Turn off
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={enableNotifications}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#FDCC4B]/40 bg-[#FDCC4B]/10 px-4 py-3 font-black text-xs tracking-widest text-[#FDCC4B] uppercase transition-colors hover:bg-[#FDCC4B]/20"
          >
            <BellOff className="h-4 w-4" aria-hidden="true" /> Notify me on price drops
          </button>
          <p className="-mt-5 text-center text-[11px] leading-relaxed text-stone-500">
            {watchedCount > 0
              ? `Watching ${watchedCount} ${watchedCount === 1 ? "drink" : "drinks"} - turn alerts on to hear about them.`
              : "Tap the bell on a drink to only get alerts for that one."}
          </p>
        </>
      )}
      {pushState === "needs-install" && (
        <p className="-mt-4 rounded-xl border border-[#FDCC4B]/20 bg-[#FDCC4B]/5 px-3 py-2 text-center text-[11px] leading-relaxed text-stone-400">
          On iPhone, alerts with the phone locked need this page on your Home Screen: tap Share, then Add to Home Screen, then open it from there.
        </p>
      )}

      <ul className="space-y-3">
        {instruments.map((instrument) => {
          const isWatched = watched.includes(instrument.id);
          return (
          <li
            key={instrument.id}
            className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
              isWatched ? "border-[#FDCC4B]/40 bg-[#FDCC4B]/5" : "border-white/10 bg-white/5"
            }`}
          >
            <button
              type="button"
              onClick={() => onToggleWatch(instrument.id)}
              aria-pressed={isWatched}
              aria-label={isWatched ? `Stop watching ${instrument.name}` : `Watch ${instrument.name} for price alerts`}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                isWatched ? "text-[#FDCC4B]" : "text-stone-500 hover:text-white"
              }`}
            >
              {isWatched ? (
                <BellRing className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Bell className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-sm tracking-tight text-ink uppercase">
                {instrument.name}
              </p>
              <p className="flex items-center gap-2 text-xs text-stone-400">
                {instrument.serve !== "each" && <span>{instrument.serve}</span>}
                <StockBadge stock={instrument.stock} />
              </p>
            </div>
            <Sparkline
              values={instrument.spark}
              className={`h-8 w-20 shrink-0 ${directionClass(instrument.direction)}`}
            />
            <div className="w-24 shrink-0 text-right">
              <p className="font-black text-lg tracking-tight text-ink tabular-nums">
                {formatGbp(instrument.price)}
              </p>
              <p
                className={`flex items-center justify-end gap-0.5 text-xs font-bold tabular-nums ${directionClass(instrument.direction)}`}
              >
                <DirectionArrow direction={instrument.direction} className="h-3.5 w-3.5" />
                {formatChangePct(instrument.changePct)}
              </p>
            </div>
          </li>
          );
        })}
        {instruments.length === 0 && (
          <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-stone-400">
            No drinks are trading yet.
          </li>
        )}
      </ul>

      {feed.length > 0 && (
        <section>
          <h2 className="mb-3 font-black text-[10px] tracking-[0.3em] text-[#FDCC4B] uppercase">
            Trading floor alerts
          </h2>
          <ul className="space-y-2">
            {[...feed].reverse().map((event) => (
              <li
                key={event.id}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-ink">{eventCopy(event)}</span>
                <span className="shrink-0 text-[10px] text-stone-500 tabular-nums">
                  {new Date(event.at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[10px] text-stone-500">
        Prices move all night. What the board says is what the bar charges.
      </p>
    </div>
  );
}
