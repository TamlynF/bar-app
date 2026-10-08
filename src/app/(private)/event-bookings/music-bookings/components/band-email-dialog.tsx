"use client";

import { useCallback, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmailComposer } from "@/components/admin/email-composer";
import { EmailHtmlFrame } from "@/components/admin/correspondence-panel";
import { bandEmailHtml } from "@/lib/band-email-html";
import { cleanReplyFragment } from "@/lib/email/correspondence";
import type { BandEmail, BandEmailKind } from "@/lib/band-emails";
import type { TemplateSlots } from "@/lib/email/render";

export type BandEmailDialogConfig = {
  actionsUrl?: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  label: string;
  placeholder: string;
  to: string;
  kind: BandEmailKind;
  slots: TemplateSlots;
  groupName: string | null;
  build: (noteText: string) => BandEmail;
};

export type BandEmailDialogResult = { ok: boolean; text: string; html: string; files: File[] };

type Draft = { html: string; text: string; files: File[] };
const EMPTY_DRAFT: Draft = { html: "", text: "", files: [] };

function BandEmailDialogBody({
  config,
  onResolve,
}: {
  config: BandEmailDialogConfig;
  onResolve: (result: BandEmailDialogResult) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const handleChange = useCallback((d: Draft) => setDraft(d), []);

  const email = config.build(draft.text);
  const html = bandEmailHtml({
    kind: config.kind,
    slots: config.slots,
    email,
    groupName: config.groupName,
    noteHtml: draft.text.trim() ? cleanReplyFragment(draft.html) : "",
    actionsUrl: config.actionsUrl,
  });

  return (
    <>
      <div className="flex items-start gap-3 border-b border-admin-line bg-white/80 px-5 py-4">
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[17px] font-bold text-admin-ink">{config.title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-admin-muted">{config.description}</DialogDescription>
        </div>
        <button
          type="button"
          onClick={() => onResolve({ ok: false, ...EMPTY_DRAFT })}
          aria-label="Close"
          title="Close"
          className="-mt-1 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:overflow-hidden">
        <div className="space-y-3 p-5 lg:overflow-y-auto">
          <EmailComposer
            id={`band-email-${config.kind}`}
            label={<span className="font-semibold text-admin-ink">{config.label}</span>}
            placeholder={config.placeholder}
            minHeightClass="min-h-40"
            onChange={handleChange}
          />
          <p className="text-[12px] leading-snug text-admin-muted">
            Your message appears in the email as the &ldquo;Note from our team&rdquo; block. Attachments go with the
            email and are saved in the correspondence thread.
          </p>
        </div>

        <div className="border-t border-admin-line bg-admin-surface/60 p-5 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <p className="mb-2 text-[12px] font-semibold text-admin-muted">Preview - exactly what the band receives</p>
          <div className="overflow-hidden rounded-2xl border border-admin-line bg-white shadow-sm">
            <dl className="space-y-1 border-b border-admin-line px-4 py-3 text-[12px]">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-admin-muted">To</dt>
                <dd className="min-w-0 truncate font-semibold text-admin-ink">{config.to}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-admin-muted">Subject</dt>
                <dd className="min-w-0 font-semibold text-admin-ink">{email.subject}</dd>
              </div>
              {draft.files.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-admin-muted">Attached</dt>
                  <dd className="flex min-w-0 flex-wrap gap-1.5">
                    {draft.files.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-admin-surface px-1.5 py-0.5 font-semibold text-admin-ink"
                      >
                        <Paperclip className="h-3 w-3 shrink-0 text-admin-muted" aria-hidden="true" />
                        <span className="truncate">{f.name}</span>
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            <div className="bg-[#E9E6DC] p-3 sm:p-5">
              <EmailHtmlFrame html={html} allowImages title={`Preview: ${email.subject}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-admin-line bg-white/80 px-5 py-3">
        <button
          type="button"
          onClick={() => onResolve({ ok: false, ...EMPTY_DRAFT })}
          className="h-11 rounded-xl border border-[#D8D5C8] px-4 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE] sm:h-10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onResolve({ ok: true, ...draft })}
          className={cn(
            "flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-white shadow-sm transition-colors sm:h-10",
            config.destructive ? "bg-[#B33A32] hover:bg-[#9a312a]" : "bg-[#34451F] hover:bg-[#283719]"
          )}
        >
          <Send className="h-4 w-4" />
          {config.confirmLabel}
        </button>
      </div>
    </>
  );
}

export function BandEmailDialog({
  config,
  onResolve,
}: {
  config: BandEmailDialogConfig | null;
  onResolve: (result: BandEmailDialogResult) => void;
}) {
  return (
    <Dialog open={!!config} onOpenChange={(open) => !open && onResolve({ ok: false, ...EMPTY_DRAFT })}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(92vh,880px)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-bg p-0 sm:max-w-5xl"
      >
        {config && <BandEmailDialogBody config={config} onResolve={onResolve} />}
      </DialogContent>
    </Dialog>
  );
}
