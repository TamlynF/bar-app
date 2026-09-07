"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { addOwnIdeaAction } from "./actions";
import type { TrendEffort } from "../lib/types";

/* "Pin up my own idea" - a note the staff write themselves, landing on the
   board as a card next to the AI ones. Deliberately short: title, what it is,
   what to do, how big a job. The AI cards have a "why now" line; a human idea
   doesn't need one, the human is the why. */

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "advertising" | "event_idea";
};

const EFFORTS: { value: TrendEffort; label: string; hint: string }[] = [
  { value: "Easy", label: "Easy", hint: "Under an hour" },
  { value: "Medium", label: "Medium", hint: "An afternoon" },
  { value: "Big", label: "Big", hint: "A proper project" },
];

const field =
  "w-full rounded-xl border border-[#D8D5C8] bg-white px-3.5 py-2.5 text-[15px] text-[#20231A] placeholder:text-[#5E6654]/60 focus:border-[#34451F] focus:outline-none focus:ring-2 focus:ring-[#34451F]/20";
const label = "mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-[#5E6654]";

export function AddIdeaSheet({ open, onOpenChange, kind }: Props) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [action, setAction] = useState("");
  const [effort, setEffort] = useState<TrendEffort | null>("Easy");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSaving, startSave] = useTransition();

  const reset = () => {
    setTitle("");
    setSummary("");
    setAction("");
    setEffort("Easy");
    setSourceUrl("");
  };

  const submit = () => {
    startSave(async () => {
      const result = await addOwnIdeaAction({
        kind,
        title,
        summary,
        action,
        effort,
        source_url: sourceUrl,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.exists) {
        toast.info("That one's already on the board.");
      } else {
        toast.success("Pinned up.");
      }
      reset();
      onOpenChange(false);
    });
  };

  const isPost = kind === "advertising";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:mx-auto sm:max-w-lg sm:rounded-2xl">
        <SheetTitle className="text-[18px] font-bold text-[#20231A]">
          ✍️ Pin up my own {isPost ? "post idea" : "event idea"}
        </SheetTitle>
        <SheetDescription className="mt-1 text-[13px] text-[#5E6654]">
          Goes on the board like the AI ones. Only the title is required.
        </SheetDescription>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="own-idea-title" className={label}>Title</label>
            <input
              id="own-idea-title"
              className={field}
              maxLength={80}
              placeholder={isPost ? "e.g. Karaoke fails of the month reel" : "e.g. Vinyl swap Sunday afternoon"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="own-idea-summary" className={label}>What it is</label>
            <textarea
              id="own-idea-summary"
              className={cn(field, "min-h-20 resize-y")}
              maxLength={400}
              placeholder="A line or two. Where did the idea come from?"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="own-idea-action" className={label}>What to do this week</label>
            <textarea
              id="own-idea-action"
              className={cn(field, "min-h-20 resize-y")}
              maxLength={400}
              placeholder={isPost ? "The shot, the caption, when to post it" : "Which night, who runs it, what it costs"}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>

          <div>
            <span className={label}>How big a job</span>
            <div className="grid grid-cols-3 gap-2">
              {EFFORTS.map((e) => {
                const active = effort === e.value;
                return (
                  <button
                    key={e.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setEffort(e.value)}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-center transition-colors",
                      active
                        ? "border-[#34451F] bg-[#34451F] text-white"
                        : "border-[#D8D5C8] bg-white text-[#5E6654] hover:bg-[#FFFEFA]",
                    )}
                  >
                    <span className="block text-[13px] font-bold">{e.label}</span>
                    <span className={cn("block text-[11px]", active ? "text-white/80" : "text-[#5E6654]/80")}>
                      {e.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="own-idea-url" className={label}>Link (optional)</label>
            <input
              id="own-idea-url"
              className={field}
              type="url"
              inputMode="url"
              placeholder="https://… the post or venue that sparked it"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="h-12 flex-1 rounded-[14px] border border-[#D8D5C8] bg-white text-[14px] font-semibold text-[#5E6654] transition-colors hover:bg-[#FFFEFA] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSaving || title.trim().length < 3}
            className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-[14px] bg-[#34451F] text-[14px] font-bold text-white transition-colors hover:bg-[#283719] active:scale-[0.98] disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden="true">📌</span>}
            {isSaving ? "Pinning…" : "Pin it up"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
