"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, BellRing, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatGbp } from "@/lib/price";
import type { MarketEventPayload } from "@/lib/market/tick";
import { detectInstallPlatform } from "@/lib/pwa-install";
import { useMarketState } from "./use-market-state";
import { removeMarketPushSubscription, saveMarketPushSubscription } from "./actions";
import InstallCard from "./install-card";
import { FlipPrice, StockBadge, eventCopy, formatChangePct } from "./market-ui";

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

function ChangePill({
  direction,
  changePct,
}: {
  direction: "up" | "down" | "flat";
  changePct: number;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-ui text-[11px] font-semibold tabular-nums";
  if (direction === "up") {
    return (
      <span className={`${base} bg-[#8CFF6A]/10 text-[#8CFF6A]`}>
        <span aria-label="Rising">▲</span> {formatChangePct(changePct)}
      </span>
    );
  }
  if (direction === "down") {
    return (
      <span className={`${base} bg-[#FF4D6D]/[.12] text-[#FF4D6D]`}>
        <span aria-label="Falling">▼</span> {formatChangePct(changePct)}
      </span>
    );
  }
  return (
    <span className={`${base} bg-white/5 text-stone-400`}>
      <span aria-label="Unchanged">–</span> {formatChangePct(changePct)}
    </span>
  );
}

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/* Remounted by the parent (key = tick number) so the clock restarts from the
   server's figure on every tick instead of drifting on the poll interval. */
function NextTickCountdown({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setRemaining(seconds - (Date.now() - startedAt) / 1000);
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  return (
    <span className="tabular-nums" aria-live="off">
      {remaining <= 0 ? "Updating…" : `Next update ${formatCountdown(remaining)}`}
    </span>
  );
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
  const platform = detectInstallPlatform();
  return platform === "ios-safari" || platform === "ios-other";
}

const readInstalled = () => detectInstallPlatform() === "installed";
const readNotifyUndecided = () =>
  typeof Notification !== "undefined" && Notification.permission === "default";

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
  const { state, fresh } = useMarketState();
  const alreadyGranted = useSyncExternalStore(subscribeNever, readNotifyGranted, () => false);
  const [justGranted, setJustGranted] = useState(false);
  const [muted, setMuted] = useAlertsMuted();
  const notifyEnabled = (alreadyGranted || justGranted) && !muted;
  const announcedRef = useRef(0);
  const [watched, toggleWatched] = useWatchedDrinks();
  const [pushState, setPushState] = useState<PushState>("unknown");
  const installed = useSyncExternalStore(subscribeNever, readInstalled, () => false);
  const notifyUndecided = useSyncExternalStore(subscribeNever, readNotifyUndecided, () => false);
  const freshInstall = installed && notifyUndecided && !justGranted;
  const instruments = state?.instruments ?? [];

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      if (!pushSupported()) {
        if (!cancelled) setPushState(isIosBrowserTab() ? "needs-install" : "page-only");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          if (!cancelled) setPushState(isIosBrowserTab() ? "needs-install" : "page-only");
          return;
        }
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
    const name = instruments.find((instrument) => instrument.id === id)?.name;
    if (name && next.includes(id)) {
      toast(`Watching ${name} - you'll only hear about the drinks you're watching, plus a crash.`);
    }
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

  const alertsAllowed = state?.pushAlertsEnabled !== false;

  useEffect(() => {
    if (fresh.length === 0) return;
    const newest = fresh[fresh.length - 1];
    if (newest.id <= announcedRef.current) return;
    announcedRef.current = newest.id;
    if (!notifyEnabled || !alertsAllowed) return;

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
  }, [fresh, watchedNamesKey, notifyEnabled, alertsAllowed]);

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

  const tradingCount = instruments.filter((instrument) => instrument.stock !== "out").length;
  const alertsOff = !alertsAllowed;

  return (
    <div className="space-y-8">
      <div className="-mt-2 flex items-center justify-between gap-3 font-black text-[10px] tracking-wider text-stone-500 uppercase">
        <span className="min-w-0 truncate">
          <span className="text-[#FDCC4B]">Market open</span>
          {" · "}
          {tradingCount} {tradingCount === 1 ? "drink" : "drinks"}
        </span>
        {state.nextTickInSec != null && (
          <span className="shrink-0 whitespace-nowrap">
            <NextTickCountdown key={state.tickNo ?? 0} seconds={state.nextTickInSec} />
          </span>
        )}
      </div>

      {state.crashActive && (
        <div className="ad-blink rounded-2xl border border-[#FF6B35]/40 bg-[#FF6B35]/10 px-4 py-3 text-center font-black text-sm tracking-widest text-[#FF6B35] uppercase">
          Market crash - buy the dip
        </div>
      )}

      {alertsOff ? null : notifyEnabled ? (
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
            <BellOff className="h-4 w-4" aria-hidden="true" />{" "}
            {freshInstall ? "Turn on lock-screen alerts" : "Notify me on price drops"}
          </button>
          {(freshInstall || watchedCount > 0) && (
            <p className="-mt-5 text-center text-[11px] leading-relaxed text-stone-500">
              {freshInstall
                ? "You're on the Home Screen - one tap and you're set."
                : `Watching ${watchedCount} ${watchedCount === 1 ? "drink" : "drinks"} - turn alerts on to hear about them.`}
            </p>
          )}
        </>
      )}
      {!alertsOff && (pushState === "needs-install" || pushState === "page-only") && <InstallCard />}

      <ul className="space-y-3">
        {instruments.map((instrument) => {
          const isWatched = watched.includes(instrument.id);
          return (
          <li
            key={instrument.id}
            className={`flex items-center gap-3 rounded-2xl border py-3 ${alertsOff ? "px-4" : "px-3"} ${
              isWatched && !alertsOff ? "border-[#FDCC4B]/40 bg-[#FDCC4B]/5" : "border-white/10 bg-white/5"
            }`}
          >
            {!alertsOff && (
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
            )}
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[15px] leading-tight font-bold tracking-wide text-ink uppercase">
                {instrument.name}
              </p>
              {instrument.stock !== "ok" && (
                <p className="mt-1.5 flex items-center">
                  <StockBadge stock={instrument.stock} />
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <FlipPrice
                value={formatGbp(instrument.price)}
                className="block font-display text-2xl leading-none tracking-wide text-ink"
              />
              <ChangePill direction={instrument.direction} changePct={instrument.changePct} />
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

      <p className="text-center text-[10px] text-stone-500">
        Prices move all night. What the board says is what the bar charges.
      </p>
    </div>
  );
}
