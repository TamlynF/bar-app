"use client";

import { useState } from "react";
import { ExternalLink, Link2, X } from "lucide-react";
import { SiDropbox, SiFacebook, SiGoogledrive, SiInstagram, SiTiktok, SiVimeo, SiYoutube } from "react-icons/si";
import { FieldError } from "@/app/(public)/book/_components/field-error";
import { randomId } from "@/lib/random-id";
import { VIDEO_PLATFORM_LABELS, parseVideoLink, type VideoPlatform } from "@/lib/video-links";

export interface VideoLinkEntry {
  id: string;
  url: string;
  platform: VideoPlatform;
  description: string;
}

const PLATFORM_ICON: Record<VideoPlatform, { Icon: typeof SiYoutube; color: string }> = {
  youtube: { Icon: SiYoutube, color: "text-[#FF0000]" },
  vimeo: { Icon: SiVimeo, color: "text-[#1AB7EA]" },
  instagram: { Icon: SiInstagram, color: "text-[#E1306C]" },
  tiktok: { Icon: SiTiktok, color: "text-[#25F4EE]" },
  facebook: { Icon: SiFacebook, color: "text-[#1877F2]" },
  drive: { Icon: SiGoogledrive, color: "text-[#4285F4]" },
  dropbox: { Icon: SiDropbox, color: "text-[#0061FF]" },
  other: { Icon: Link2, color: "text-gold" },
};

function shortUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/* Performance videos the band already has online. Pasting a link adds it at
   once; typed links are added with Enter or the Add button. Each link keeps
   an optional description, index-aligned with the uploads on submit. */
export function VideoLinksField({
  links,
  onChange,
  canAdd,
  invalid,
}: {
  links: VideoLinkEntry[];
  onChange: (links: VideoLinkEntry[]) => void;
  canAdd: boolean;
  invalid: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(text: string): boolean {
    if (!text.trim()) return false;
    const parsed = parseVideoLink(text);
    if ("error" in parsed) {
      setError(parsed.error);
      return false;
    }
    if (links.some((l) => l.url === parsed.url)) {
      setError("You've already added that video.");
      return false;
    }
    onChange([...links, { id: randomId(), ...parsed, description: "" }]);
    setDraft("");
    setError(null);
    return true;
  }

  function update(id: string, description: string) {
    onChange(links.map((l) => (l.id === id ? { ...l, description } : l)));
  }

  return (
    <div className="space-y-3">
      {canAdd && (
        <div>
          <div
            className={`flex items-center overflow-hidden rounded-xl border bg-black/40 transition-all focus-within:border-[#FDCC4B]/40 focus-within:ring-1 focus-within:ring-[#FDCC4B]/20 ${
              invalid || error ? "border-red-500/50" : "border-white/10"
            }`}
          >
            <Link2 className="ml-3.5 h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <input
              type="url"
              inputMode="url"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (!draft.trim() && add(pasted)) e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(draft);
                }
              }}
              placeholder="Paste a video link"
              aria-label="Paste a performance video link"
              aria-invalid={!!error}
              aria-describedby={error ? "video-link-error" : undefined}
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-stone-500 focus:outline-none"
            />
            {draft.trim() && (
              <button
                type="button"
                onClick={() => add(draft)}
                className="flex h-11 shrink-0 items-center self-stretch border-l border-white/10 px-4 font-bold text-xs tracking-wider text-gold uppercase transition-colors hover:bg-gold/10"
              >
                Add
              </button>
            )}
          </div>
          <FieldError id="video-link-error" message={error ?? undefined} />
        </div>
      )}

      {links.map((link) => {
        const { Icon, color } = PLATFORM_ICON[link.platform];
        const label = VIDEO_PLATFORM_LABELS[link.platform];
        return (
          <div key={link.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center">
              <span className="ml-3 flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/40">
                <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 px-3 py-2">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="truncate text-xs text-ink-2">{shortUrl(link.url)}</p>
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${label} link in a new tab`}
                className="flex w-11 shrink-0 items-center justify-center self-stretch border-l border-white/10 text-ink-2 transition-colors hover:text-[#FDCC4B]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                aria-label={`Remove ${label} link`}
                onClick={() => onChange(links.filter((l) => l.id !== link.id))}
                className="flex w-11 shrink-0 items-center justify-center self-stretch border-l border-white/10 text-ink-2 transition-colors hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="border-t border-white/10 p-2">
              <input
                type="text"
                aria-label={`Description for ${label} link`}
                maxLength={120}
                value={link.description}
                onChange={(e) => update(link.id, e.target.value)}
                placeholder="Add a short description (optional)"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-stone-400 focus:border-[#FDCC4B]/40 focus:ring-1 focus:ring-[#FDCC4B]/20 focus:outline-none"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
