"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Compass, Download, Share, SquarePlus, X } from "lucide-react";
import {
  type BeforeInstallPromptEvent,
  detectInstallPlatform,
  isIpad,
} from "@/lib/pwa-install";

/* Public-surface cousin of the admin InstallPrompt. iPhone Safari only allows
   Web Push once the site is on the Home Screen and Apple gives pages no way
   to trigger that, so the best we can do is spell out the taps. Android and
   desktop Chrome do expose a prompt, so there we offer a real Install button;
   when Chrome never fires the event we render nothing, because push already
   works from the browser tab on those platforms. */

const DISMISS_KEY = "df-market-install-dismissed-until";
const DISMISS_DAYS = 14;

const subscribeNoop = () => () => {};
const getServerSnapshot = () => "ssr" as const;

function readDismissedUntil(): number {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#FDCC4B]/15 font-black text-[11px] text-[#FDCC4B]">
      {n}
    </span>
  );
}

export default function InstallCard() {
  const platform = useSyncExternalStore(subscribeNoop, detectInstallPlatform, getServerSnapshot);
  const [dismissed, setDismissed] = useState(() => readDismissedUntil() > Date.now());
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (platform !== "other") return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDismissed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [platform]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
    } catch {
      /* private mode - hidden for this page load only */
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setDismissed(true);
    else dismiss();
  };

  const ios = platform === "ios-safari" || platform === "ios-other";
  const visible = !dismissed && (ios || (platform === "other" && installEvent !== null));
  if (!visible) return null;

  const shareLocation = isIpad() ? "at the top, next to the address bar" : "at the bottom, next to the address bar";

  return (
    <div
      role="region"
      aria-label="Get alerts on your lock screen"
      className="-mt-4 rounded-2xl border border-[#FDCC4B]/20 bg-[#FDCC4B]/5 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDCC4B]/15 text-[#FDCC4B]">
          <Download className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-xs tracking-widest text-[#FDCC4B] uppercase">
            Alerts with your phone locked
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-stone-400">
            {ios
              ? "On iPhone that needs Market Night on your Home Screen. Three taps:"
              : "Install Market Night and price drops reach you even when the screen is off."}
          </p>

          {platform === "ios-safari" && (
            <ol className="mt-3 space-y-2 text-[13px] leading-snug text-stone-200">
              <li className="flex items-start gap-2">
                <StepNumber n={1} />
                <span>
                  Tap <span className="font-bold text-white">Share</span>{" "}
                  <Share className="inline h-4 w-4 align-text-bottom text-[#FDCC4B]" aria-hidden="true" />{" "}
                  {shareLocation}.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber n={2} />
                <span>
                  Scroll down and tap{" "}
                  <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />{" "}
                  <span className="font-bold text-white">Add to Home Screen</span>, then{" "}
                  <span className="font-bold text-white">Add</span>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber n={3} />
                <span>
                  Open <span className="font-bold text-white">Market Night</span> from the new icon and tap{" "}
                  <span className="font-bold text-white">Notify me</span>.
                </span>
              </li>
            </ol>
          )}

          {platform === "ios-other" && (
            <ol className="mt-3 space-y-2 text-[13px] leading-snug text-stone-200">
              <li className="flex items-start gap-2">
                <StepNumber n={1} />
                <span>
                  Open this page in{" "}
                  <Compass className="inline h-4 w-4 align-text-bottom text-[#FDCC4B]" aria-hidden="true" />{" "}
                  <span className="font-bold text-white">Safari</span> - tap the{" "}
                  <span className="font-bold text-white">…</span> or{" "}
                  <Share className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> menu here and choose{" "}
                  <span className="font-bold text-white">Open in Safari</span>, or copy the link into Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber n={2} />
                <span>
                  In Safari tap <span className="font-bold text-white">Share</span>{" "}
                  <Share className="inline h-4 w-4 align-text-bottom text-[#FDCC4B]" aria-hidden="true" />, then{" "}
                  <span className="font-bold text-white">Add to Home Screen</span>, then{" "}
                  <span className="font-bold text-white">Add</span>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber n={3} />
                <span>
                  Open <span className="font-bold text-white">Market Night</span> from the new icon and tap{" "}
                  <span className="font-bold text-white">Notify me</span>.
                </span>
              </li>
            </ol>
          )}

          <div className="mt-3 flex items-center gap-2">
            {!ios && (
              <button
                type="button"
                onClick={install}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-[#FDCC4B]/40 bg-[#FDCC4B]/10 px-4 font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase transition-colors hover:bg-[#FDCC4B]/20"
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Install
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="flex min-h-11 items-center rounded-xl px-3 font-black text-[10px] tracking-widest text-stone-400 uppercase transition-colors hover:bg-white/5 hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
