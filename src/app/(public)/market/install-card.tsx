"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Compass, Download, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  type BeforeInstallPromptEvent,
  detectInstallPlatform,
  isAndroid,
  isIpad,
} from "@/lib/pwa-install";

/* Public-surface cousin of the admin InstallPrompt, opened when a guest picks
   push alerts on a phone that doesn't have Market Night installed. iPhone
   Safari only allows Web Push once the site is on the Home Screen and Apple
   gives pages no way to trigger that, so the best we can do is spell out the
   taps. Android exposes a real Install prompt, so there we offer the button
   when Chrome hands us one and the menu taps when it doesn't, and stay quiet
   once the app is already installed. Desktop never needs it: push already
   works from the tab. */

type Platform = "ios-safari" | "ios-other" | "android" | null;

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<unknown[]>;
};

export type InstallTarget = {
  platform: Platform;
  needsInstall: boolean;
  installEvent: BeforeInstallPromptEvent | null;
  install: () => Promise<boolean>;
};

const subscribeNoop = () => () => {};
const getServerSnapshot = (): Platform => null;

function readPlatform(): Platform {
  const platform = detectInstallPlatform();
  if (platform === "ios-safari" || platform === "ios-other") return platform;
  if (platform === "other" && isAndroid()) return "android";
  return null;
}

async function androidAppInstalled(): Promise<boolean> {
  const nav = navigator as NavigatorWithRelatedApps;
  if (!nav.getInstalledRelatedApps) return false;
  try {
    return (await nav.getInstalledRelatedApps()).length > 0;
  } catch {
    return false;
  }
}

export function useInstallTarget(): InstallTarget {
  const platform = useSyncExternalStore(subscribeNoop, readPlatform, getServerSnapshot);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [androidInstalled, setAndroidInstalled] = useState(false);

  useEffect(() => {
    if (platform !== "android") return;
    let cancelled = false;
    androidAppInstalled().then((installed) => {
      if (!cancelled && installed) setAndroidInstalled(true);
    });
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setAndroidInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [platform]);

  const install = async () => {
    if (!installEvent) return false;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setAndroidInstalled(true);
    return outcome === "accepted";
  };

  const needsInstall = platform === "android" ? !androidInstalled : platform !== null;
  return { platform, needsInstall, installEvent, install };
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#FDCC4B]/15 font-black text-[11px] text-[#FDCC4B]">
      {n}
    </span>
  );
}

function OpenAndNotify({ n }: { n: number }) {
  return (
    <li className="flex items-start gap-2">
      <StepNumber n={n} />
      <span>
        Open <span className="font-bold text-white">Market Night</span> from the new icon and tap{" "}
        <span className="font-bold text-white">Notify me</span>.
      </span>
    </li>
  );
}

export function InstallCard({ target, onClose }: { target: InstallTarget; onClose: () => void }) {
  const { platform, installEvent, install } = target;
  if (platform === null) return null;

  const ios = platform !== "android";
  const shareLocation = isIpad() ? "at the top, next to the address bar" : "at the bottom, next to the address bar";

  const onInstall = async () => {
    const accepted = await install();
    if (accepted) onClose();
  };

  return (
    <div className="flex items-start gap-3 p-4">
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
            : installEvent
              ? "Install Market Night and price drops reach your lock screen even with the browser closed."
              : "Add Market Night to your Home Screen and price drops reach your lock screen even with the browser closed."}
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
            <OpenAndNotify n={3} />
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
            <OpenAndNotify n={3} />
          </ol>
        )}

        {platform === "android" && !installEvent && (
          <ol className="mt-3 space-y-2 text-[13px] leading-snug text-stone-200">
            <li className="flex items-start gap-2">
              <StepNumber n={1} />
              <span>
                Tap the browser menu{" "}
                <EllipsisVertical className="inline h-4 w-4 align-text-bottom text-[#FDCC4B]" aria-hidden="true" />{" "}
                at the top right.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <StepNumber n={2} />
              <span>
                Tap <span className="font-bold text-white">Add to Home screen</span> or{" "}
                <span className="font-bold text-white">Install app</span>, then{" "}
                <span className="font-bold text-white">Install</span>.
              </span>
            </li>
            <OpenAndNotify n={3} />
          </ol>
        )}

        <div className="mt-3 flex items-center gap-2">
          {installEvent && (
            <button
              type="button"
              onClick={onInstall}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-[#FDCC4B]/40 bg-[#FDCC4B]/10 px-4 font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase transition-colors hover:bg-[#FDCC4B]/20"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Install
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center rounded-xl px-3 font-black text-[10px] tracking-widest text-stone-400 uppercase transition-colors hover:bg-white/5 hover:text-white"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-white/5 hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function InstallDialog({
  target,
  open,
  onOpenChange,
}: {
  target: InstallTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="rounded-3xl border-[#FDCC4B]/20 bg-canvas-2 p-0 text-ink"
      >
        <DialogTitle className="sr-only">Get alerts on your lock screen</DialogTitle>
        <DialogDescription className="sr-only">
          How to add Market Night to your phone so price drops reach your lock screen.
        </DialogDescription>
        <InstallCard target={target} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
