"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* One-tap share for an event: poster image + ready-written caption + public
   link, handed to whatever the phone has installed (Instagram, WhatsApp,
   Messages...). Uses the Web Share API with files, which on an installed PWA
   opens the native share sheet - so posting to Instagram is: tap, pick
   Instagram, pick Story or Post, done. The caption is already on the clipboard
   because Instagram drops `text` when sharing a file.

   Fallbacks, in order: share without the image if the browser won't take files
   (Firefox), then copy caption + open the poster in a tab if there's no share
   API at all (desktop). Nothing here talks to the Instagram API - see
   src/lib/instagram-publish.ts for that path when the venue is ready. */

export type ShareEventInput = {
  title: string;
  /** ISO date, e.g. 2026-09-11 */
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  price?: number | null;
  /** Category used as the plain search phrase, e.g. "Live music", "Karaoke" */
  searchPhrase?: string | null;
  posterUrl?: string | null;
  publicUrl: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function fmtTime(t?: string | null) {
  return t ? t.slice(0, 5) : null;
}

/* Search-phrase opener first (people find venues by typing "live music
   Hinckley" into Instagram), then the facts, then the link. Short on purpose:
   the poster does the shouting. */
export function buildCaption(e: ShareEventInput): string {
  const lines: string[] = [];
  const phrase = e.searchPhrase?.trim();
  if (phrase) lines.push(`${phrase} in Hinckley 🎶`);
  lines.push(e.title);

  const when = [fmtDate(e.date)];
  const start = fmtTime(e.startTime);
  const end = fmtTime(e.endTime);
  if (start) when.push(end ? `${start}–${end}` : `from ${start}`);
  lines.push(when.join(" · "));

  lines.push(e.price && e.price > 0 ? `£${e.price.toFixed(2)} · book at the link` : "Free entry");
  lines.push("");
  lines.push(e.publicUrl);
  lines.push("");
  lines.push("#DonFenticas #Hinckley #LiveMusicHinckley");
  return lines.join("\n");
}

async function fetchPosterFile(url: string, title: string): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "event";
    return new File([blob], `${safe}.${ext}`, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

export function useShareEvent(event: ShareEventInput) {
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    const caption = buildCaption(event);

    try {
      // Clipboard first, always. Instagram ignores `text` when a file is
      // attached, so the caption has to be a paste away.
      let copied = false;
      try {
        await navigator.clipboard.writeText(caption);
        copied = true;
      } catch {
        /* clipboard blocked - carry on, text is still in the share payload */
      }

      const canShare = typeof navigator.share === "function";
      if (!canShare) {
        if (event.posterUrl) window.open(event.posterUrl, "_blank", "noopener");
        toast.success(copied ? "Caption copied. Poster opened in a new tab." : "Poster opened in a new tab.");
        return;
      }

      const file = event.posterUrl ? await fetchPosterFile(event.posterUrl, event.title) : null;
      const withFile = file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

      if (withFile) {
        await navigator.share({ files: [file], title: event.title, text: caption });
      } else {
        await navigator.share({ title: event.title, text: caption, url: event.publicUrl });
      }
      if (copied) toast.success("Caption copied - paste it in Instagram.");
    } catch (err) {
      // User closed the share sheet: not an error worth a toast.
      if ((err as DOMException)?.name !== "AbortError") {
        console.error("Share failed", err);
        toast.error("Couldn't open the share sheet.");
      }
    } finally {
      setBusy(false);
    }
  };

  return { share, busy };
}

export function ShareEventButton({
  event,
  className,
  showLabel = true,
}: {
  event: ShareEventInput;
  className?: string;
  showLabel?: boolean;
}) {
  const { share, busy } = useShareEvent(event);

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      aria-label="Share this event"
      title="Share this event"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-admin-line bg-admin-card text-admin-primary transition-colors hover:border-admin-primary hover:bg-admin-primary-soft focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none disabled:opacity-60 sm:w-auto sm:px-3",
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Share2 className="h-4 w-4 shrink-0" />}
      {showLabel && <span className="hidden text-[13px] font-semibold sm:inline">Share</span>}
    </button>
  );
}
