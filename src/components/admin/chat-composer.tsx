"use client";

import { useRef, useState } from "react";
import { Bold, Italic, List, Minus, Smile, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CHAT_DIVIDER, CHAT_EMOJIS, styleText, type UnicodeStyle } from "@/lib/unicode-style";

type Tool = { label: string; icon: typeof Bold; apply: (selected: string) => string; block?: boolean };

const TOOLS: Tool[] = [
  { label: "Bold", icon: Bold, apply: (s) => styleText(s, "bold") },
  { label: "Italic", icon: Italic, apply: (s) => styleText(s, "italic") },
  { label: "Underline", icon: Underline, apply: (s) => styleText(s, "underline") },
  { label: "Bullet", icon: List, apply: (s) => (s ? s.split("\n").map((l) => (l.trim() ? `• ${l}` : l)).join("\n") : "• "), block: true },
  { label: "Divider", icon: Minus, apply: () => CHAT_DIVIDER, block: true },
];

const BTN =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-admin-line bg-white text-admin-ink transition-colors hover:bg-admin-surface max-sm:h-11 max-sm:w-11";

/* A plain-text composer for Instagram and Messenger: the toolbar styles the
   selection with Unicode lookalike letters, since DMs carry no rich text,
   and drops in dividers, bullets and emojis. */
export function ChatComposer({
  id,
  label,
  value,
  onChange,
  rows = 12,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  hint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  function edit(transform: (selected: string) => string, block = false) {
    const el = ref.current;
    if (!el) return;
    let start = el.selectionStart;
    let end = el.selectionEnd;
    if (block && start === end) {
      start = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", end);
      end = lineEnd === -1 ? value.length : lineEnd;
    }
    const selected = value.slice(start, end);
    let inserted = transform(selected);
    if (block && !selected && inserted === CHAT_DIVIDER) {
      const before = value.slice(0, start);
      const after = value.slice(end);
      inserted = `${before && !before.endsWith("\n") ? "\n" : ""}${inserted}${after.startsWith("\n") ? "" : "\n"}`;
    }
    const next = value.slice(0, start) + inserted + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + inserted.length;
      el.setSelectionRange(selected ? start : caret, caret);
    });
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-admin-ink">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Message formatting">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={() => edit(t.apply, t.block)}
            className={BTN}
          >
            <t.icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button type="button" title="Emoji" aria-label="Insert emoji" className={BTN}>
              <Smile className="h-4 w-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 rounded-2xl border-admin-line bg-admin-card p-2">
            <div className="grid grid-cols-6 gap-1" role="listbox" aria-label="Emojis">
              {CHAT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-label={`Insert ${e}`}
                  onClick={() => {
                    setEmojiOpen(false);
                    edit(() => e);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors hover:bg-admin-surface"
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={cn(
          "w-full resize-y rounded-xl border border-admin-line bg-white px-3 py-2.5 text-[13px] leading-relaxed text-admin-ink shadow-sm",
          "focus-visible:ring-2 focus-visible:ring-[#D7A928] focus-visible:outline-none"
        )}
      />
      {hint && <p className="text-[12px] leading-snug text-admin-muted">{hint}</p>}
    </div>
  );
}

export type { UnicodeStyle };
