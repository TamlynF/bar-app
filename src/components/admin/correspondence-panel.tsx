"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { AlertCircle, Loader2, Mail, Paperclip, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { splitQuotedReply, type CorrespondenceMessage } from "@/lib/email/correspondence";
import {
  getCorrespondence,
  markCorrespondenceRead,
  sendCorrespondenceReply,
  type CorrespondenceFilter,
  type CorrespondenceThread,
} from "@/app/(private)/settings/music-acts/correspondence-actions";

const KIND_LABELS: Record<string, string> = {
  application: "Application received",
  offered: "Offer",
  booked: "Booking confirmed",
  declined: "Declined",
  rescheduled: "Rescheduled",
};

const LONG_BODY_CHARS = 420;
const LONG_BODY_LINES = 8;

function senderName(m: CorrespondenceMessage): string {
  if (m.direction === "outbound") return m.sentByName ?? "Don Fenticas";
  const named = m.fromAddress.match(/^\s*"?([^"<]+?)"?\s*</);
  return named ? named[1] : m.fromAddress;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageItem({ message, showRequestLink }: { message: CorrespondenceMessage; showRequestLink: boolean }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inbound = message.direction === "inbound";
  const { body, quoted } = inbound ? splitQuotedReply(message.textBody) : { body: message.textBody, quoted: "" };
  const isLong = body.length > LONG_BODY_CHARS || body.split("\n").length > LONG_BODY_LINES;
  const kindLabel = message.kind ? KIND_LABELS[message.kind] : undefined;
  const unread = inbound && !message.readAt;

  return (
    <li className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "w-full max-w-[92%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[85%]",
          inbound ? "border-admin-line bg-admin-card" : "border-admin-primary/15 bg-admin-primary-soft",
          unread && "ring-2 ring-admin-gold/60"
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-bold text-admin-ink">{senderName(message)}</span>
          {kindLabel && (
            <span className="rounded-md bg-admin-surface px-1.5 py-px text-[11px] font-semibold text-admin-muted">
              {kindLabel}
            </span>
          )}
          {unread && <span className="text-[11px] font-semibold text-admin-warning">New</span>}
          <time className="ml-auto text-[11px] text-admin-muted" dateTime={message.createdAt}>
            {format(new Date(message.createdAt), "EEE d MMM, HH:mm")}
          </time>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-admin-muted" title={message.subject}>
          {message.subject}
          {showRequestLink && !message.bandRequestId && " · sent from the act page"}
        </p>

        <p
          className={cn(
            "mt-2 text-[13px] leading-relaxed break-words whitespace-pre-line text-admin-ink",
            isLong && !expanded && "line-clamp-6"
          )}
        >
          {body || <span className="text-admin-muted italic">No message text</span>}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-[11px] font-semibold text-admin-primary hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {quoted && (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setShowQuoted((v) => !v)}
              aria-expanded={showQuoted}
              className="text-[11px] font-semibold text-admin-muted hover:text-admin-ink hover:underline"
            >
              {showQuoted ? "Hide earlier message" : "Show earlier message"}
            </button>
            {showQuoted && (
              <p className="mt-1.5 border-l-2 border-admin-line pl-2.5 text-[12px] leading-relaxed break-words whitespace-pre-line text-admin-muted">
                {quoted}
              </p>
            )}
          </div>
        )}

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
      </div>
    </li>
  );
}

export function CorrespondencePanel({
  bandRequestId,
  musicActId,
  editable = true,
}: {
  bandRequestId?: string;
  musicActId?: string;
  editable?: boolean;
}) {
  const [thread, setThread] = useState<CorrespondenceThread | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const markedFor = useRef<string | null>(null);

  const filterKey = bandRequestId ? `band:${bandRequestId}` : musicActId ? `act:${musicActId}` : "";

  useEffect(() => {
    if (!filterKey) return;
    const filter: CorrespondenceFilter = bandRequestId ? { bandRequestId } : { musicActId: musicActId! };
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
  }, [filterKey, bandRequestId, musicActId, reloadKey]);

  function send() {
    const body = draft.trim();
    if (!body || !filterKey) return;
    const filter: CorrespondenceFilter = bandRequestId ? { bandRequestId } : { musicActId: musicActId! };
    setSendError(null);
    startSending(async () => {
      try {
        const res = await sendCorrespondenceReply(filter, body);
        if (res.error) {
          setSendError(res.error);
          return;
        }
        setDraft("");
        if (res.thread) setThread(res.thread);
        toast.success("Email sent");
      } catch {
        setSendError("Couldn't send the email. Try again.");
      }
    });
  }

  const messages = thread?.messages ?? [];

  return (
    <div className="space-y-3 p-4 sm:p-5">
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
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
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-admin-line px-4 py-6 text-center">
          <Mail className="h-5 w-5 text-admin-muted" aria-hidden="true" />
          <p className="text-[13px] text-admin-muted">No emails yet. Emails sent to this act and their replies appear here.</p>
        </div>
      ) : (
        <ol className="space-y-2.5" aria-label="Email correspondence">
          {messages.map((m) => (
            <MessageItem key={m.id} message={m} showRequestLink={!bandRequestId} />
          ))}
        </ol>
      )}

      {editable && thread && (
        <div className="space-y-2 border-t border-admin-line pt-3">
          <label htmlFor={`reply-${filterKey}`} className="text-[12px] font-semibold text-admin-muted">
            {messages.some((m) => m.direction === "inbound") ? "Reply" : "New email"}
          </label>
          <textarea
            id={`reply-${filterKey}`}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (sendError) setSendError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            rows={4}
            disabled={isSending || !thread.recipient}
            placeholder={thread.recipient ? `Write to ${thread.recipient}…` : "Add an email address to this act first"}
            className="w-full resize-y rounded-xl border border-admin-line bg-admin-card px-3 py-2 text-[13px] text-admin-ink transition-colors placeholder:text-admin-muted/60 focus:border-admin-primary/40 focus:outline-none disabled:opacity-60"
          />
          {sendError && (
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-admin-error">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {sendError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-admin-muted">
              {thread.repliesEnabled
                ? "Replies from the band appear in this thread."
                : "Replies won't show here until the reply domain is set up."}
            </p>
            <button
              type="button"
              onClick={send}
              disabled={isSending || !draft.trim() || !thread.recipient}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#34451F] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#283719] disabled:pointer-events-none disabled:opacity-50"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
