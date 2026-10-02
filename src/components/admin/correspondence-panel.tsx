"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  ChevronDown,
  ImageOff,
  Link2,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmailComposer } from "@/components/admin/email-composer";
import { cleanEmailHtml, emailFrameDocument } from "@/lib/email/email-html";
import {
  CORRESPONDENCE_SOURCE_LABELS,
  splitQuotedReply,
  type CorrespondenceMessage,
} from "@/lib/email/correspondence";
import {
  getCorrespondence,
  markCorrespondenceRead,
  relinkCorrespondenceMessage,
  sendCorrespondenceReply,
  type CorrespondenceBooking,
  type CorrespondenceFilter,
  type RelinkScope,
  type CorrespondenceThread,
} from "@/app/(private)/settings/music-acts/correspondence-actions";

const KIND_LABELS: Record<string, string> = {
  application: "Application received",
  offered: "Offer",
  booked: "Booking confirmed",
  declined: "Declined",
  rescheduled: "Rescheduled",
  invoice: "Invoice request",
  enquiry: "Enquiry received",
  confirmed: "Booking confirmed",
  cancelled: "Cancelled",
};

const LONG_BODY_CHARS = 420;
const LONG_BODY_LINES = 8;
const COLLAPSED_FRAME_PX = 200;

function senderName(m: CorrespondenceMessage, counterpartName?: string): string {
  if (m.direction === "outbound") return m.sentByName ?? "Don Fenticas";
  if (counterpartName?.trim()) return counterpartName.trim();
  const named = m.fromAddress.match(/^\s*"?([^"<]+?)"?\s*</);
  return named ? named[1] : m.fromAddress;
}

function initials(name: string): string {
  const words = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function snippetOf(message: CorrespondenceMessage): string {
  const text = message.direction === "inbound" ? splitQuotedReply(message.textBody).body : message.textBody;
  return text
    .replace(/<(?:https?:|mailto:)[^>\s]+>/gi, "")
    .replace(/\*(\S[^*]*?)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function EmailHtmlFrame({
  html,
  allowImages,
  title,
  onHeight,
}: {
  html: string;
  allowImages: boolean;
  title: string;
  onHeight?: (px: number) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);

  function measure() {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    const px = Math.ceil(doc.documentElement.scrollHeight);
    setHeight(px);
    onHeight?.(px);
  }

  function handleLoad() {
    measure();
    const doc = frameRef.current?.contentDocument;
    for (const img of doc?.images ?? []) img.addEventListener("load", measure);
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(frame);
    return () => observer.disconnect();
  });

  return (
    <iframe
      ref={frameRef}
      title={title}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={emailFrameDocument(html, allowImages)}
      onLoad={handleLoad}
      style={{ "--frame-h": `${height || 40}px` } as React.CSSProperties}
      className="block h-[var(--frame-h)] w-full border-0 bg-transparent"
    />
  );
}

function QuotedToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Hide earlier messages" : "Show earlier messages"}
      title={open ? "Hide earlier messages" : "Show earlier messages"}
      className="mt-2 flex h-5 items-center rounded-full bg-black/5 px-2 text-admin-muted transition-colors hover:bg-black/10 hover:text-admin-ink"
    >
      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function EmailBody({ message, fadeClass }: { message: CorrespondenceMessage; fadeClass: string }) {
  const inbound = message.direction === "inbound";
  const [showImages, setShowImages] = useState(!inbound);
  const [showQuoted, setShowQuoted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [frameHeight, setFrameHeight] = useState(0);

  const clean = message.htmlBody
    ? cleanEmailHtml(message.htmlBody, { blockImages: !showImages, includeQuoted: showQuoted })
    : null;

  if (!clean) {
    const { body, quoted } = inbound ? splitQuotedReply(message.textBody) : { body: message.textBody, quoted: "" };
    const isLong = body.length > LONG_BODY_CHARS || body.split("\n").length > LONG_BODY_LINES;
    return (
      <>
        <p
          className={cn(
            "text-[13px] leading-relaxed break-words whitespace-pre-line text-admin-ink",
            isLong && !expanded && "line-clamp-6"
          )}
        >
          {body || <span className="text-admin-muted italic">No message text</span>}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-[12px] font-semibold text-admin-primary hover:underline"
          >
            {expanded ? "Show less" : "Show full email"}
          </button>
        )}
        {quoted && <QuotedToggle open={showQuoted} onToggle={() => setShowQuoted((v) => !v)} />}
        {quoted && showQuoted && (
          <p className="mt-1.5 border-l-2 border-admin-line pl-2.5 text-[12px] leading-relaxed break-words whitespace-pre-line text-admin-muted">
            {quoted}
          </p>
        )}
      </>
    );
  }

  const overflowing = frameHeight > COLLAPSED_FRAME_PX;
  const clipped = overflowing && !expanded;

  return (
    <>
      {clean.blockedImages > 0 && !showImages && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/5 px-2.5 py-1.5 text-[12px] text-admin-muted">
          <span className="flex items-center gap-1.5">
            <ImageOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Images are hidden to protect your privacy.
          </span>
          <button
            type="button"
            onClick={() => setShowImages(true)}
            className="font-semibold text-admin-primary hover:underline"
          >
            Show images
          </button>
        </div>
      )}
      <div className={cn("relative overflow-hidden", clipped && "max-h-50")}>
        <EmailHtmlFrame
          html={clean.html}
          allowImages={showImages}
          title={`Email: ${message.subject}`}
          onHeight={setFrameHeight}
        />
        {clipped && (
          <div
            aria-hidden="true"
            className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t to-transparent", fadeClass)}
          />
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[12px] font-semibold text-admin-primary hover:underline"
        >
          {expanded ? "Show less" : "Show full email"}
        </button>
      )}
      {clean.hasQuoted && <QuotedToggle open={showQuoted} onToggle={() => setShowQuoted((v) => !v)} />}
    </>
  );
}

const NO_BOOKING = "none";

function BookingLink({
  currentId,
  bookings,
  noun,
  onRelink,
  busy,
}: {
  currentId: string | null;
  bookings: CorrespondenceBooking[];
  noun: string;
  onRelink?: (targetId: string | null) => void;
  busy: boolean;
}) {
  const current = bookings.find((b) => b.id === currentId);
  const unlinked = `Not linked to a ${noun.toLowerCase()}`;
  const label = current ? current.label : currentId ? `Another ${noun.toLowerCase()}` : unlinked;
  const chip = cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
    current ? "border-admin-primary/25 bg-white text-admin-primary" : "border-dashed border-admin-line bg-white/70 text-admin-muted"
  );
  const content = (
    <>
      <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {current ? `${noun}: ` : ""}
        {label}
      </span>
    </>
  );
  if (!onRelink) return <span className={chip}>{content}</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          aria-label={`Linked ${noun.toLowerCase()}: ${label}. Change`}
          title={`Change which ${noun.toLowerCase()} this email belongs to`}
          className={cn(chip, "transition-colors hover:bg-admin-primary-soft disabled:opacity-50 max-sm:min-h-8")}
        >
          {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" /> : null}
          {content}
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[12px] text-admin-muted">This email belongs to</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={currentId ?? NO_BOOKING}
          onValueChange={(v) => {
            const next = v === NO_BOOKING ? null : v;
            if (next !== currentId) onRelink(next);
          }}
        >
          {bookings.map((b) => (
            <DropdownMenuRadioItem key={b.id} value={b.id} className="text-[13px]">
              {b.label}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value={NO_BOOKING} className="text-[13px]">
            {unlinked}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MessageBubble({
  message,
  counterpartName,
  showSource,
  bookings,
  bookingNoun = "Booking",
  linkedId,
  onRelink,
  relinking,
}: {
  message: CorrespondenceMessage;
  counterpartName?: string;
  showSource: boolean;
  bookings?: CorrespondenceBooking[];
  bookingNoun?: string;
  linkedId: string | null;
  onRelink?: (targetId: string | null) => void;
  relinking: boolean;
}) {
  const [open, setOpen] = useState(false);
  const outbound = message.direction === "outbound";
  const name = senderName(message, counterpartName);
  const kindLabel = message.kind ? KIND_LABELS[message.kind] : undefined;
  const unread = !outbound && !message.readAt;

  return (
    <li className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className={cn(
          "rounded-2xl border shadow-xs",
          open ? "w-full" : "max-w-[90%] sm:max-w-[85%]",
          outbound ? "border-admin-primary/20 bg-admin-primary-soft" : "border-admin-line bg-white",
          unread && "ring-2 ring-admin-gold/50"
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start gap-2.5 rounded-2xl px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-[#34451F]/40 focus-visible:outline-none"
          >
            <Avatar className="mt-0.5 size-8">
              <AvatarFallback
                className={cn(
                  "text-[11px] font-bold text-white",
                  outbound ? "bg-admin-primary" : "bg-violet-600"
                )}
              >
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[13px] font-bold text-admin-ink">{name}</span>
                {kindLabel && (
                  <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-px text-[11px] font-semibold text-admin-muted max-sm:hidden">
                    {kindLabel}
                  </span>
                )}
                {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-admin-gold" aria-label="New" />}
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-admin-muted">
                  {message.attachments.length > 0 && <Paperclip className="h-3 w-3" aria-label="Has attachments" />}
                  <time dateTime={message.createdAt}>{format(new Date(message.createdAt), "EEE d MMM, HH:mm")}</time>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
                    aria-hidden="true"
                  />
                </span>
              </span>
              {open ? (
                <span className="mt-0.5 block truncate text-[11px] text-admin-muted" title={message.subject}>
                  {message.subject}
                  {showSource && ` · ${CORRESPONDENCE_SOURCE_LABELS[message.source]}`}
                </span>
              ) : (
                <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-admin-ink/80">
                  {snippetOf(message) || message.subject}
                </span>
              )}
            </span>
          </button>
        </CollapsibleTrigger>
        {bookings && (
          <div className="-mt-1 px-3 pb-2.5 pl-13.5">
            <BookingLink
              currentId={linkedId}
              bookings={bookings}
              noun={bookingNoun}
              onRelink={onRelink}
              busy={relinking}
            />
          </div>
        )}
        <CollapsibleContent className="px-3 pb-3 sm:pl-13.5">
          <EmailBody message={message} fadeClass={outbound ? "from-admin-primary-soft" : "from-white"} />
          {message.attachments.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {message.attachments.map((a) => (
                <li key={a.path}>
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-admin-line bg-white px-2 py-1 text-[12px] font-semibold text-admin-ink transition-colors hover:bg-admin-surface"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-admin-muted" aria-hidden="true" />
                      <span className="truncate">{a.name}</span>
                      <span className="shrink-0 font-normal text-admin-muted">{formatBytes(a.size)}</span>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-admin-line px-2 py-1 text-[12px] text-admin-muted">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {a.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

type ThreadOwner = {
  bandRequestId?: string;
  privateHireRequestId?: string;
  enquiryId?: string;
  musicActId?: string;
  contactId?: number;
};

function toFilter(o: ThreadOwner): CorrespondenceFilter | null {
  if (o.bandRequestId) return { bandRequestId: o.bandRequestId };
  if (o.privateHireRequestId) return { privateHireRequestId: o.privateHireRequestId };
  if (o.enquiryId) return { enquiryId: o.enquiryId };
  if (o.musicActId) return { musicActId: o.musicActId };
  if (o.contactId) return { contactId: o.contactId };
  return null;
}

export function MessageCountPill({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <span className="shrink-0 rounded-full border border-admin-line bg-white px-2.5 py-0.5 text-[11px] font-semibold text-admin-muted tabular-nums">
      {count} message{count === 1 ? "" : "s"}
    </span>
  );
}

export function CorrespondencePanel({
  bandRequestId,
  musicActId,
  privateHireRequestId,
  enquiryId,
  contactId,
  counterpartName,
  onCountChange,
  editable = true,
}: ThreadOwner & {
  counterpartName?: string;
  onCountChange?: (count: number) => void;
  editable?: boolean;
}) {
  const [thread, setThread] = useState<CorrespondenceThread | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const markedFor = useRef<string | null>(null);

  const filterKey =
    bandRequestId ?? privateHireRequestId ?? enquiryId ?? musicActId ?? (contactId ? `contact-${contactId}` : "");
  const aggregated = !bandRequestId && !privateHireRequestId && !enquiryId;

  useEffect(() => {
    const filter = toFilter({ bandRequestId, privateHireRequestId, enquiryId, musicActId, contactId });
    if (!filter) return;
    let alive = true;
    getCorrespondence(filter)
      .then((t) => {
        if (!alive) return;
        setThread(t);
        setLoadFailed(false);
        const hasUnread = t.messages.some((m) => m.direction === "inbound" && !m.readAt);
        if (hasUnread && markedFor.current !== `${filterKey}:${reloadKey}`) {
          markedFor.current = `${filterKey}:${reloadKey}`;
          void markCorrespondenceRead(filter);
        }
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [bandRequestId, privateHireRequestId, enquiryId, musicActId, contactId, filterKey, reloadKey]);

  const messages = thread?.messages ?? [];

  useEffect(() => {
    if (thread) onCountChange?.(thread.messages.length);
  }, [thread, onCountChange]);

  function send(html: string, files: File[]): Promise<boolean> {
    const filter = toFilter({ bandRequestId, privateHireRequestId, enquiryId, musicActId, contactId });
    if (!filter) return Promise.resolve(false);
    setSendError(null);
    const form = new FormData();
    form.set("html", html);
    for (const f of files) form.append("files", f);
    return new Promise((resolve) => {
      startSending(async () => {
        const res = await sendCorrespondenceReply(filter, form).catch(() => ({
          error: "Couldn't send the email. Try again.",
          thread: undefined,
        }));
        if (res.error) {
          setSendError(res.error);
          resolve(false);
          return;
        }
        if (res.thread) setThread(res.thread);
        toast.success("Email sent");
        resolve(true);
      });
    });
  }

  const relinkScope: RelinkScope | null = musicActId
    ? { musicActId }
    : privateHireRequestId
      ? { privateHireRequestId }
      : null;

  async function relink(messageId: string, targetId: string | null) {
    if (!relinkScope) return;
    setRelinkingId(messageId);
    const res = await relinkCorrespondenceMessage(messageId, relinkScope, targetId).catch(() => ({
      error: "Couldn't move that email.",
      thread: undefined,
    }));
    setRelinkingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.thread) setThread(res.thread);
    const noun = (thread?.bookingNoun ?? "Booking").toLowerCase();
    toast.success(targetId ? `Email moved to that ${noun}` : `Email unlinked from its ${noun}`);
  }

  const hasInbound = messages.some((m) => m.direction === "inbound");
  const who = counterpartName?.trim();

  return (
    <div>
      <div className="space-y-2.5 bg-admin-surface/40 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[12px] text-admin-muted">
            {thread?.recipient ? (
              <>
                With <span className="font-semibold text-admin-ink">{thread.recipient}</span>
              </>
            ) : thread ? (
              "No email address on file"
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Check for new emails"
            title="Check for new emails"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink max-sm:h-11 max-sm:w-11"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loadFailed ? (
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-admin-error">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Couldn&apos;t load the emails. Use refresh to try again.
          </p>
        ) : !thread ? (
          <div className="flex items-center justify-center py-6 text-admin-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading emails" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-admin-line bg-white px-4 py-6 text-center">
            <Mail className="h-5 w-5 text-admin-muted" aria-hidden="true" />
            <p className="text-[13px] text-admin-muted">No emails yet. Emails you send and the replies to them appear here.</p>
          </div>
        ) : (
          <ol className="space-y-2.5" aria-label="Email correspondence">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                counterpartName={who}
                showSource={aggregated}
                bookings={thread.bookings}
                bookingNoun={thread.bookingNoun}
                linkedId={musicActId ? m.bandRequestId : m.privateHireRequestId}
                onRelink={editable && relinkScope ? (id) => relink(m.id, id) : undefined}
                relinking={relinkingId === m.id}
              />
            ))}
          </ol>
        )}
      </div>

      {editable && thread && (
        <div className="space-y-2 border-t border-admin-line p-3 sm:p-4">
          <EmailComposer
            id={`reply-${filterKey}`}
            disabled={!thread.recipient}
            sending={isSending}
            placeholder={thread.recipient ? (hasInbound ? "Write a reply…" : "Write an email…") : "Add an email address first"}
            label={
              thread.recipient ? (
                <>
                  {hasInbound ? "Reply to" : "New email to"}{" "}
                  {who && <span className="font-bold text-admin-ink">{who}</span>}
                  {who ? " · " : ""}
                  {thread.recipient}
                </>
              ) : (
                "No email address on file"
              )
            }
            onSend={send}
          />
          {sendError && (
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-admin-error">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {sendError}
            </p>
          )}
          {!thread.repliesEnabled && (
            <p className="text-[11px] leading-snug text-admin-muted">
              Replies won&apos;t show here until the reply domain is set up.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
