"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isToday, isThisYear } from "date-fns";
import { ArrowLeft, ExternalLink, Inbox, Mail } from "lucide-react";
import { SiInstagram, SiMessenger } from "react-icons/si";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, type MessageChannel } from "@/lib/meta/channels";
import { INBOX_SOURCE_LABELS, type InboxThread } from "@/lib/inbox";
import { CorrespondencePanel } from "@/components/admin/correspondence-panel";
import { EmptyState, FilterChip, ListSearchInput, StatusPill } from "@/components/admin";

type Filter = "all" | "unread" | MessageChannel;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "instagram", label: "Instagram" },
  { key: "messenger", label: "Messenger" },
  { key: "email", label: "Email" },
];

function ChannelIcon({ channel, className }: { channel: MessageChannel; className?: string }) {
  if (channel === "instagram") return <SiInstagram className={className} aria-hidden="true" />;
  if (channel === "messenger") return <SiMessenger className={className} aria-hidden="true" />;
  return <Mail className={className} aria-hidden="true" />;
}

const CHANNEL_TINT: Record<MessageChannel, string> = {
  instagram: "bg-[#E1306C] text-white",
  messenger: "bg-[#0084FF] text-white",
  email: "bg-admin-primary text-white",
};

function initials(name: string): string {
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || "?").toUpperCase();
}

function when(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isThisYear(d)) return format(d, "d MMM");
  return format(d, "d MMM yyyy");
}

export default function InboxClient({ threads, initialKey }: { threads: InboxThread[]; initialKey: string | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initialKey && threads.some((t) => t.key === initialKey) ? initialKey : null
  );
  const [opened, setOpened] = useState<Set<string>>(() => new Set());

  const unreadOf = (t: InboxThread) => (opened.has(t.key) ? 0 : t.unread);
  const totalUnread = threads.reduce((n, t) => n + unreadOf(t), 0);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter === "unread" && unreadOf(t) === 0) return false;
      if (filter !== "all" && filter !== "unread" && !t.channels.includes(filter)) return false;
      if (!q) return true;
      return [t.name, t.handle ?? "", t.lastPreview, INBOX_SOURCE_LABELS[t.source]].some((s) => s.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, filter, search, opened]);

  const selected = threads.find((t) => t.key === selectedKey) ?? null;

  function open(t: InboxThread) {
    setSelectedKey(t.key);
    setOpened((prev) => new Set(prev).add(t.key));
    window.history.replaceState(null, "", `/requests/inbox?t=${encodeURIComponent(t.key)}`);
    window.setTimeout(() => router.refresh(), 1500);
  }

  function back() {
    setSelectedKey(null);
    window.history.replaceState(null, "", "/requests/inbox");
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <section
          aria-label="Conversations"
          className={cn("overflow-hidden rounded-2xl border border-admin-line bg-admin-card shadow-sm", selected && "max-lg:hidden")}
        >
          <div className="space-y-3 border-b border-admin-line bg-admin-surface px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-admin-ink">
                Inbox{" "}
                <span className="font-semibold text-admin-muted tabular-nums">
                  {totalUnread > 0 ? `${totalUnread} unread` : `${threads.length}`}
                </span>
              </h2>
            </div>
            <ListSearchInput value={search} onChange={setSearch} placeholder="Search names, handles, messages" label="Search conversations" />
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {FILTERS.map((f) => (
                <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                  {f.key !== "all" && f.key !== "unread" && <ChannelIcon channel={f.key} className="h-3 w-3" />}
                  {f.label}
                  {f.key === "unread" && totalUnread > 0 && <span className="tabular-nums">{totalUnread}</span>}
                </FilterChip>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={threads.length === 0 ? "No messages yet" : "Nothing matches"}
              description={
                threads.length === 0
                  ? "Emails, Instagram and Messenger chats show up here as they arrive."
                  : "Try another filter or clear the search."
              }
            />
          ) : (
            <ul className="max-h-[70vh] divide-y divide-admin-line/60 overflow-y-auto">
              {visible.map((t) => {
                const unread = unreadOf(t);
                const isSelected = t.key === selectedKey;
                return (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => open(t)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-admin-surface/70 sm:px-4",
                        isSelected && "bg-admin-primary-soft/60"
                      )}
                    >
                      <span className="relative shrink-0">
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold",
                            unread > 0 ? "bg-admin-primary text-white" : "bg-admin-surface text-admin-muted"
                          )}
                        >
                          {initials(t.name)}
                        </span>
                        <span
                          title={CHANNEL_LABELS[t.lastChannel]}
                          className={cn(
                            "absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-admin-card",
                            CHANNEL_TINT[t.lastChannel]
                          )}
                        >
                          <ChannelIcon channel={t.lastChannel} className="h-2.5 w-2.5" />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-[14px]", unread > 0 ? "font-bold text-admin-ink" : "font-semibold text-admin-ink")}>
                            {t.name}
                          </span>
                          <span className={cn("shrink-0 text-[11px] tabular-nums", unread > 0 ? "font-semibold text-admin-primary" : "text-admin-muted")}>
                            {when(t.lastAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-admin-muted">
                          <span>{INBOX_SOURCE_LABELS[t.source]}</span>
                          {t.status && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{t.status}</span>
                            </>
                          )}
                          {t.handle && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">@{t.handle}</span>
                            </>
                          )}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className={cn("min-w-0 flex-1 truncate text-[13px]", unread > 0 ? "text-admin-ink" : "text-admin-muted")}>
                            {t.lastDirection === "outbound" && <span className="text-admin-muted">You: </span>}
                            {t.lastPreview || "(no text)"}
                          </span>
                          {unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-admin-error px-1.5 text-[11px] font-bold text-white tabular-nums">
                              {unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Conversation" className={cn("min-w-0", !selected && "max-lg:hidden")}>
          {selected ? (
            <div className="overflow-hidden rounded-2xl border border-admin-line bg-admin-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-admin-line bg-admin-surface px-3 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={back}
                  aria-label="Back to conversations"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-admin-muted hover:bg-admin-card hover:text-admin-ink lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-admin-ink">{selected.name}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] font-semibold text-admin-muted">
                    <span>{INBOX_SOURCE_LABELS[selected.source]}</span>
                    {selected.handle && <span>· @{selected.handle}</span>}
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      {selected.channels.map((c) => (
                        <ChannelIcon key={c} channel={c} className="h-3 w-3" />
                      ))}
                      {selected.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}
                    </span>
                  </p>
                </div>
                {selected.status && (
                  <StatusPill tone="neutral" showLabelOnMobile>
                    {selected.status}
                  </StatusPill>
                )}
                {selected.recordHref && (
                  <Link
                    href={selected.recordHref}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#34451F] px-3 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="max-sm:sr-only">Open record</span>
                  </Link>
                )}
              </div>
              <div className="p-3 sm:p-5">
                <CorrespondencePanel key={selected.key} {...selected.owner} counterpartName={selected.name} />
              </div>
            </div>
          ) : (
            <div className="hidden rounded-2xl border border-dashed border-admin-line bg-admin-card/60 lg:block">
              <EmptyState icon={Inbox} title="Pick a conversation" description="Messages from every channel open here, and you can reply on the one they used." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
