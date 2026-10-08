"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmailComposer } from "@/components/admin/email-composer";
import { ChannelPicker, EmailHtmlFrame } from "@/components/admin/correspondence-panel";
import { bandEmailHtml } from "@/lib/band-email-html";
import { cleanReplyFragment } from "@/lib/email/correspondence";
import type { ThreadChannel } from "@/lib/email/correspondence";
import { CHANNEL_LABELS, type MessageChannel, type MetaChannel } from "@/lib/meta/channels";
import { BAND_OFFER_REPLIES, quickReplyHint, type OfferCard } from "@/lib/band-offer-message";
import { ChatComposer } from "@/components/admin/chat-composer";
import type { BandEmail, BandEmailKind } from "@/lib/band-emails";
import type { TemplateSlots } from "@/lib/email/render";

/* Offered only when the act chats with us: the message goes on Instagram or
   Messenger instead of (or as well as) the email. */
export type BandChatOption = {
  channels: ThreadChannel[];
  initial: MessageChannel;
  text: string;
  card: OfferCard;
  outro: string;
};

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
  chat?: BandChatOption;
  build: (noteText: string) => BandEmail;
};

export type BandEmailDialogResult = {
  ok: boolean;
  text: string;
  html: string;
  files: File[];
  channel: MessageChannel;
  message: string;
  outro: string;
  alsoEmail: boolean;
};

type Draft = { html: string; text: string; files: File[] };
const EMPTY_DRAFT: Draft = { html: "", text: "", files: [] };
const CANCELLED: BandEmailDialogResult = {
  ok: false,
  ...EMPTY_DRAFT,
  channel: "email",
  message: "",
  outro: "",
  alsoEmail: false,
};

/* A phone's width, so the text wraps where it will on the band's screen. */
const PHONE = "w-[375px] max-w-full";
const BUBBLE = "max-w-[80%] rounded-2xl rounded-bl-md bg-[#EFEFEF] px-3.5 py-2.5 text-[14px] leading-snug whitespace-pre-wrap break-words text-[#0A0A0A]";

function ChatPreview({
  channel,
  handle,
  text,
  card,
  outro,
}: {
  channel: MetaChannel;
  handle: string | null;
  text: string;
  card: OfferCard;
  outro: string;
}) {
  return (
    <div className={cn(PHONE, "overflow-hidden rounded-[28px] border-4 border-[#1C1C1E] bg-white shadow-md")}>
      <div className="flex items-center gap-2 border-b border-[#EFEFEF] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFEFEF] text-[11px] font-bold text-[#0A0A0A]">
          DF
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">Don Fenticas</p>
          <p className="truncate text-[11px] text-[#737373]">
            to {handle ? `@${handle}` : "their account"} on {CHANNEL_LABELS[channel]}
          </p>
        </div>
      </div>
      <div className="space-y-2 px-3 py-4">
        <div className={BUBBLE}>{text.trim() || "Your message"}</div>
        <div className="w-[80%] overflow-hidden rounded-2xl rounded-bl-md border border-[#DBDBDB] bg-white text-[14px]">
          <div className="px-3.5 py-2.5">
            <p className="font-semibold text-[#0A0A0A]">{card.title}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-[#737373]">{card.subtitle}</p>
          </div>
          <div className="border-t border-[#DBDBDB] px-3.5 py-2.5 text-center font-semibold text-[#0095F6]">{card.buttonTitle}</div>
        </div>
        {outro.trim() && <div className={BUBBLE}>{outro}</div>}
        <div className="flex flex-wrap justify-end gap-1.5 pt-1">
          {BAND_OFFER_REPLIES.map((r) => (
            <span
              key={r.response}
              className="rounded-full border border-[#0095F6] bg-white px-3 py-1 text-[12px] font-semibold text-[#0095F6]"
            >
              {r.title}
            </span>
          ))}
        </div>
      </div>
      <p className="border-t border-[#EFEFEF] px-4 py-2 text-[11px] leading-snug text-[#737373]">{quickReplyHint(channel)}</p>
    </div>
  );
}

function BandEmailDialogBody({
  config,
  onResolve,
}: {
  config: BandEmailDialogConfig;
  onResolve: (result: BandEmailDialogResult) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const handleChange = useCallback((d: Draft) => setDraft(d), []);
  const [channel, setChannel] = useState<MessageChannel>(config.chat?.initial ?? "email");
  const [message, setMessage] = useState(config.chat?.text ?? "");
  const [outro, setOutro] = useState(config.chat?.outro ?? "");
  const [alsoEmail, setAlsoEmail] = useState(false);

  const chat = channel !== "email" ? (config.chat?.channels.find((c) => c.channel === channel) ?? null) : null;
  const chatClosed = chat?.allowance.mode === "closed" ? chat.allowance.reason : null;
  const emailAvailable = !!config.to.trim();
  const sendsEmail = channel === "email" || alsoEmail;
  const canSend = channel === "email" ? true : !!chat && !chatClosed && !!message.trim();
  const confirmLabel = channel === "email" ? config.confirmLabel : alsoEmail ? "Send, message & email" : "Send & message";

  const email = config.build(draft.text);
  const html = bandEmailHtml({
    kind: config.kind,
    slots: config.slots,
    email,
    groupName: config.groupName,
    noteHtml: draft.text.trim() ? cleanReplyFragment(draft.html) : "",
    actionsUrl: config.actionsUrl,
  });

  const title = channel === "email" ? config.title : config.title.replace("email band", "message band");
  const description =
    channel === "email"
      ? config.description
      : `The band gets this on ${CHANNEL_LABELS[channel]} straight away and can tap a reply to accept, discuss or withdraw.`;

  return (
    <>
      <div className="flex items-start gap-3 border-b border-admin-line bg-white/80 px-5 py-4">
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[17px] font-bold text-admin-ink">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-admin-muted">{description}</DialogDescription>
        </div>
        <button
          type="button"
          onClick={() => onResolve(CANCELLED)}
          aria-label="Close"
          title="Close"
          className="-mt-1 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:overflow-hidden">
        <div className="space-y-3 p-5 lg:overflow-y-auto">
          {config.chat && (
            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-admin-muted">Send on</p>
              <ChannelPicker value={channel} emailAvailable={emailAvailable} channels={config.chat.channels} onChange={setChannel} />
            </div>
          )}
          {channel !== "email" && (
            <>
              <div className={cn(PHONE, "space-y-3")}>
                <ChatComposer
                  id="band-offer-message"
                  label="Message to the band"
                  value={message}
                  onChange={setMessage}
                  rows={18}
                  hint="Written for you from the slot and fee - edit anything before sending. Changes aren't saved. Select a word, then bold, italic or underline it; DMs have no real formatting, so these use lookalike letters."
                />
                <p className="rounded-xl border border-dashed border-admin-line bg-admin-surface/60 px-3 py-2 text-[12px] text-admin-muted">
                  The &ldquo;{config.chat!.card.buttonTitle}&rdquo; card goes here, between the two messages.
                </p>
                <ChatComposer id="band-offer-outro" label="After the link" value={outro} onChange={setOutro} rows={3} />
              </div>
              {chatClosed && (
                <p className="flex items-start gap-1.5 text-[12px] font-semibold text-admin-error">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {chatClosed}
                </p>
              )}
              <label className="flex items-start gap-2 text-[13px] text-admin-ink">
                <input
                  type="checkbox"
                  checked={alsoEmail}
                  disabled={!emailAvailable}
                  onChange={(e) => setAlsoEmail(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#34451F]"
                />
                <span>
                  Also send the offer by email
                  {!emailAvailable && <span className="block text-[12px] text-admin-muted">No email address on file.</span>}
                </span>
              </label>
            </>
          )}
          {sendsEmail && (
            <>
              <EmailComposer
                id={`band-email-${config.kind}`}
                label={<span className="font-semibold text-admin-ink">{channel === "email" ? config.label : "Note in the email (optional)"}</span>}
                placeholder={config.placeholder}
                minHeightClass={channel === "email" ? "min-h-40" : "min-h-24"}
                onChange={handleChange}
              />
              <p className="text-[12px] leading-snug text-admin-muted">
                Your message appears in the email as the &ldquo;Note from our team&rdquo; block. Attachments go with the
                email and are saved in the correspondence thread.
              </p>
            </>
          )}
        </div>

        <div className="space-y-4 border-t border-admin-line bg-admin-surface/60 p-5 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          {chat && (
            <div>
              <p className="mb-2 text-[12px] font-semibold text-admin-muted">Preview - what the band sees on {CHANNEL_LABELS[chat.channel]}</p>
              <ChatPreview channel={chat.channel} handle={chat.handle} text={message} card={config.chat!.card} outro={outro} />
            </div>
          )}
          {sendsEmail && (
          <div>
          <p className="mb-2 text-[12px] font-semibold text-admin-muted">
            {chat ? "Preview - the email" : "Preview - exactly what the band receives"}
          </p>
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
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-admin-line bg-white/80 px-5 py-3">
        <button
          type="button"
          onClick={() => onResolve(CANCELLED)}
          className="h-11 rounded-xl border border-[#D8D5C8] px-4 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE] sm:h-10"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSend}
          onClick={() =>
            onResolve({
              ok: true,
              ...(sendsEmail ? draft : EMPTY_DRAFT),
              channel,
              message: channel === "email" ? "" : message.trim(),
              outro: channel === "email" ? "" : outro.trim(),
              alsoEmail: channel !== "email" && alsoEmail,
            })
          }
          className={cn(
            "flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-10",
            config.destructive ? "bg-[#B33A32] hover:bg-[#9a312a]" : "bg-[#34451F] hover:bg-[#283719]"
          )}
        >
          <Send className="h-4 w-4" />
          {confirmLabel}
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
    <Dialog open={!!config} onOpenChange={(open) => !open && onResolve(CANCELLED)}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(92vh,880px)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-bg p-0 sm:max-w-5xl"
      >
        {config && <BandEmailDialogBody config={config} onResolve={onResolve} />}
      </DialogContent>
    </Dialog>
  );
}
