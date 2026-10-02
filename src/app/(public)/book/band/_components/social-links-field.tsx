"use client";

import { useState } from "react";
import { Check, ExternalLink, Link2, X } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import { FieldError } from "@/app/(public)/book/_components/field-error";
import {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  cleanSocialHandle,
  detectSocialLink,
  portableHandle,
  socialPrefix,
  socialUrl,
  type SocialPlatform,
} from "@/lib/social-links";

export type SocialLinks = Partial<Record<SocialPlatform, string>>;

const PLATFORM_STYLE: Record<SocialPlatform, { Icon: typeof SiInstagram; color: string; placeholder: string }> = {
  instagram: { Icon: SiInstagram, color: "text-[#E1306C]", placeholder: "yourhandle" },
  facebook: { Icon: SiFacebook, color: "text-[#1877F2]", placeholder: "yourpage" },
  youtube: { Icon: SiYoutube, color: "text-[#FF0000]", placeholder: "yourchannel" },
  tiktok: { Icon: SiTiktok, color: "text-[#25F4EE]", placeholder: "yourhandle" },
};

function focusField(platform: SocialPlatform) {
  requestAnimationFrame(() => document.getElementById(`social-${platform}`)?.focus());
}

/* The band's social profiles. Paste any profile link and it lands in the right
   platform; or tap a platform's icon to type a handle. Pasted links, @handles
   and tracking codes are all reduced to the bare handle, and the first plain
   handle can be reused on the platforms not filled in yet. A platform is
   "added" while it has a key in `links`, so key order is display order. */
export function SocialLinksField({
  links,
  onChange,
  labelClassName,
}: {
  links: SocialLinks;
  onChange: (links: SocialLinks) => void;
  labelClassName: string;
}) {
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const added = Object.keys(links) as SocialPlatform[];
  const missing = SOCIAL_PLATFORMS.filter((p) => !added.includes(p));
  const reusable = added.map((p) => portableHandle(links[p] ?? "")).find((h): h is string => !!h);

  function setLink(platform: SocialPlatform, handle: string) {
    onChange({ ...links, [platform]: handle });
  }

  function remove(platform: SocialPlatform) {
    onChange(Object.fromEntries(Object.entries(links).filter(([key]) => key !== platform)));
    setNotice(null);
  }

  function handleTyped(platform: SocialPlatform, value: string) {
    const detected = detectSocialLink(value);
    if (detected && detected.platform !== platform) {
      setLink(detected.platform, detected.handle);
      setNotice(`${SOCIAL_LABELS[detected.platform]} added as ${detected.handle}`);
      return;
    }
    setNotice(null);
    setLink(platform, cleanSocialHandle(platform, value));
  }

  function handlePaste(value: string) {
    setPaste(value);
    setPasteError(null);
    const detected = detectSocialLink(value);
    if (!detected) return;
    setLink(detected.platform, detected.handle);
    setNotice(`${SOCIAL_LABELS[detected.platform]} added as ${detected.handle}`);
    setPaste("");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className={labelClassName}>Socials</p>
        <div role="group" aria-label="Add a social profile" className="flex items-center gap-2">
          {SOCIAL_PLATFORMS.map((platform) => {
            const { Icon, color } = PLATFORM_STYLE[platform];
            const isAdded = added.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                aria-pressed={isAdded}
                aria-label={`${isAdded ? "Edit" : "Add"} ${SOCIAL_LABELS[platform]}`}
                onClick={() => {
                  if (!isAdded) setLink(platform, "");
                  focusField(platform);
                }}
                className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  isAdded
                    ? "border-gold/50 bg-white/10"
                    : "border-white/10 bg-black/40 hover:border-white/25 hover:bg-white/5"
                }`}
              >
                <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
                {isAdded && (
                  <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-gold text-[#26300D]">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-all focus-within:border-[#FDCC4B]/40 focus-within:ring-1 focus-within:ring-[#FDCC4B]/20">
          <Link2 className="ml-3.5 h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <input
            type="url"
            inputMode="url"
            value={paste}
            onChange={(e) => handlePaste(e.target.value)}
            onBlur={() => {
              if (paste.trim() && !detectSocialLink(paste)) {
                setPasteError("We couldn't find an Instagram, Facebook, YouTube or TikTok profile in that link.");
              }
            }}
            placeholder="Paste a profile link or tap an icon"
            aria-label="Paste a social profile link"
            aria-invalid={!!pasteError}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-stone-500 focus:outline-none"
          />
        </div>
        <FieldError message={pasteError ?? undefined} />
        <p aria-live="polite" className="mt-1.5 ml-1 flex items-center gap-1.5 text-xs text-ink-2 empty:hidden">
          {notice && (
            <>
              <Check className="h-3.5 w-3.5 text-[#7BD88F]" aria-hidden="true" />
              {notice}
            </>
          )}
        </p>
      </div>

      {added.map((platform) => {
        const { Icon, color, placeholder } = PLATFORM_STYLE[platform];
        const handle = links[platform] ?? "";
        const label = SOCIAL_LABELS[platform];
        return (
          <div
            key={platform}
            className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-all focus-within:border-[#FDCC4B]/40 focus-within:ring-1 focus-within:ring-[#FDCC4B]/20"
          >
            <Icon className={`ml-3.5 h-4 w-4 shrink-0 ${color}`} aria-hidden="true" />
            <span className="pr-0.5 pl-2 text-sm whitespace-nowrap text-stone-400 select-none">
              {socialPrefix(platform, handle)}
            </span>
            <input
              id={`social-${platform}`}
              type="text"
              value={handle}
              onChange={(e) => handleTyped(platform, e.target.value)}
              placeholder={placeholder}
              aria-label={`${label} handle`}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-sm text-white placeholder:text-stone-500 focus:outline-none"
            />
            {handle && (
              <a
                href={socialUrl(platform, handle)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Check your ${label} profile in a new tab`}
                className="flex w-11 shrink-0 items-center justify-center self-stretch border-l border-white/10 text-ink-2 transition-colors hover:text-[#FDCC4B]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              aria-label={`Remove ${label}`}
              onClick={() => remove(platform)}
              className="flex w-11 shrink-0 items-center justify-center self-stretch border-l border-white/10 text-ink-2 transition-colors hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}

      {reusable && missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-2">Same handle on</span>
          {missing.map((platform) => {
            const { Icon, color } = PLATFORM_STYLE[platform];
            return (
              <button
                key={platform}
                type="button"
                onClick={() => {
                  setLink(platform, reusable);
                  setNotice(`${SOCIAL_LABELS[platform]} added as ${reusable}`);
                }}
                aria-label={`Use ${reusable} on ${SOCIAL_LABELS[platform]}`}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-xs font-semibold text-ink transition-colors hover:border-gold/50 hover:bg-gold/10"
              >
                <Icon className={`h-3.5 w-3.5 ${color}`} aria-hidden="true" />
                {SOCIAL_LABELS[platform]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
