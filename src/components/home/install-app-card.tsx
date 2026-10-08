"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InstallDialog,
  useInstallTarget,
  type InstallCopy,
} from "@/app/(public)/market/install-card";

const DISMISS_KEY = "df-install-card-dismissed";
const DISMISS_FOR_MS = 60 * 24 * 60 * 60 * 1000;
const DISMISS_EVENT = "df-install-card-dismissed";

const HOME_INSTALL_COPY: InstallCopy = {
  heading: "Don Fenticas on your phone",
  iosIntro:
    "On iPhone the site goes on your Home Screen from Safari. Three taps:",
  androidPromptIntro:
    "Install it and Don Fenticas opens full screen from your Home Screen, no browser bars.",
  androidMenuIntro:
    "Add it to your Home Screen and Don Fenticas opens full screen, no browser bars.",
  lastStep: (
    <>
      Open <span className="font-bold text-white">Don Fenticas</span> from the
      new icon - full screen, no browser bars.
    </>
  ),
  dialogTitle: "Add Don Fenticas to your Home Screen",
  dialogDescription:
    "How to put the Don Fenticas site on your phone's Home Screen.",
};

function readDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

/* A one-line nudge on phones that haven't installed the site: opened from the
   Home Screen it runs full screen, without the browser's address bar and
   toolbar. Android gets Chrome's own Install prompt when it offers one; every
   other phone gets the taps in the shared install dialog. Hidden on desktop,
   once installed, and for 60 days after "not now". */
export function InstallAppCard() {
  const target = useInstallTarget();
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    () => true,
  );
  const [open, setOpen] = useState(false);

  if (!target.needsInstall || dismissed) return null;

  async function onAdd() {
    if (target.installEvent) {
      if (await target.install()) dismiss();
      return;
    }
    setOpen(true);
  }

  return (
    <section aria-label="Add to Home Screen" className="sm:hidden">
      <div className="rounded-2xl border border-gold/25 bg-canvas-2 p-3">
        <div className="flex items-center gap-3">
          <Image
            src="/icon-192.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl ring-1 ring-white/10"
          />
          <div className="min-w-0 flex-1">
            <p className="text-btn font-semibold text-ink">Get the app</p>
            <p className="mt-0.5 text-meta text-ink-2">
              Full screen from your Home Screen, no browser bars.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-white/5 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <Button
          type="button"
          variant="gold"
          size="cta"
          onClick={onAdd}
          className="mt-3 w-full"
        >
          <Download aria-hidden="true" />
          {target.installEvent ? "Install" : "Add to Home Screen"}
        </Button>
      </div>
      <InstallDialog
        target={target}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) dismiss();
        }}
        copy={HOME_INSTALL_COPY}
      />
    </section>
  );
}
