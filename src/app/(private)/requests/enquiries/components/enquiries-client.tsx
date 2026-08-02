"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Inbox,
  X,
  ChevronRight,
  Clock,
  CheckCircle,
  Archive,
  Mail,
  Phone,
  Loader2,
  Send,
  MessageSquareQuote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { replyToEnquiry, closeEnquiry } from "../actions";

export type Enquiry = {
  id: string;
  full_name: string;
  email: string;
  phone_no: string | null;
  subject: string | null;
  message: string;
  status: string;
  reply_message: string | null;
  admin_notes: string | null;
  created_at: string;
};

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

type StatusTheme = {
  text: string;
  border: string;
  dot: string;
  ring: string;
  bg: string;
  icon: React.ReactNode;
};

const statusTheme: Record<string, StatusTheme> = {
  all: { text: "text-[#20231A]", border: "border-[#D8D5C8]", dot: "bg-[#5E6654]", ring: "ring-slate-500/40", bg: "bg-[#F4F1E8]", icon: null },
  pending: { text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", ring: "ring-amber-500/40", bg: "bg-amber-50", icon: <Clock className="h-4 w-4" /> },
  responded: { text: "text-green-700", border: "border-green-200", dot: "bg-green-500", ring: "ring-green-500/40", bg: "bg-green-50", icon: <CheckCircle className="h-4 w-4" /> },
  closed: { text: "text-stone-600", border: "border-stone-200", dot: "bg-stone-400", ring: "ring-stone-400/40", bg: "bg-stone-100", icon: <Archive className="h-4 w-4" /> },
};

function StatusCircle({
  count,
  status,
  label,
  isActive,
  onClick,
}: {
  count: number;
  status: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const theme = statusTheme[status] || statusTheme.pending;
  return (
    <div className="flex min-w-14 shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border-2 transition-all hover:scale-105 active:scale-95",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white ${theme.border}`
        )}
      >
        <span className={cn("font-black text-sm leading-none", isActive ? "text-white" : theme.text)}>
          {count}
        </span>
      </button>
      <span className={cn("font-black text-[10px] tracking-tight uppercase sm:text-[11px]", isActive ? theme.text : "text-[#5E6654]")}>
        {label}
      </span>
    </div>
  );
}

function EnquiryCard({ enquiry }: { enquiry: Enquiry }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const status = normStatus(enquiry.status);
  const theme = statusTheme[status] ?? statusTheme.pending;

  function handleReply() {
    if (!replyText.trim()) {
      setError("Write a reply before sending.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await replyToEnquiry(enquiry.id, replyText);
        setOpen(false);
        router.refresh();
      } catch {
        setError("Failed to send reply. Please try again.");
      }
    });
  }

  function handleClose() {
    setError(null);
    startTransition(async () => {
      try {
        await closeEnquiry(enquiry.id);
        setOpen(false);
        router.refresh();
      } catch {
        setError("Failed to close enquiry. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white",
          "flex items-center gap-3 px-3 py-3.5 text-left",
          "shadow-sm transition-all hover:bg-[#F4F1E8]/60 active:scale-[0.98]"
        )}
      >
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border", theme.bg, theme.text, theme.border)}>
          {theme.icon ?? <Mail className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-black text-sm tracking-tight text-[#20231A] uppercase">
              {enquiry.full_name}
            </p>
            {enquiry.subject && (
              <span className="max-w-32 shrink-0 truncate rounded border border-[#34451F]/15 bg-[#34451F]/5 px-1.5 py-0.5 font-black text-[10px] text-[#34451F] uppercase">
                {enquiry.subject}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-[#5E6654]">
            {enquiry.message}
          </p>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-[#5E6654]/50" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="right-auto bottom-6 flex h-auto max-h-[85vh] w-140 -translate-x-1/2 flex-col rounded-4xl rounded-t-4xl border-[#D8D5C8] bg-[#F4F1E8] p-0 sm:left-1/2"
        >
          <div className="shrink-0 border-b-2 border-[#D8D5C8] px-6 pt-6 pb-4">
            <SheetTitle className="flex items-center gap-2 font-black text-sm tracking-widest text-[#20231A] uppercase">
              Enquiry
              <span className={cn("rounded-full border px-2 py-0.5 font-black text-[10px] uppercase", theme.bg, theme.text, theme.border)}>
                {status}
              </span>
            </SheetTitle>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <p className="font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Contact</p>
              <div className="overflow-hidden rounded-2xl border border-[#D8D5C8] bg-white px-4">
                <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] py-3">
                  <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Name</span>
                  <span className="text-right text-sm font-bold text-[#20231A]">{enquiry.full_name}</span>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] py-3">
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                    <Mail className="h-3 w-3" /> Email
                  </span>
                  <a href={`mailto:${enquiry.email}`} className="text-right text-sm font-bold break-all text-[#34451F] underline underline-offset-2">
                    {enquiry.email}
                  </a>
                </div>
                {enquiry.phone_no && (
                  <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] py-3">
                    <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                      <Phone className="h-3 w-3" /> Phone
                    </span>
                    <a href={`tel:${enquiry.phone_no}`} className="text-sm font-bold text-[#34451F] underline underline-offset-2">
                      {enquiry.phone_no}
                    </a>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 py-3">
                  <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Received</span>
                  <span className="text-sm font-bold text-[#20231A]">
                    {new Date(enquiry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                {enquiry.subject ? `Message - ${enquiry.subject}` : "Message"}
              </p>
              <div className="rounded-2xl border border-[#D8D5C8] bg-white px-4 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#20231A]">{enquiry.message}</p>
              </div>
            </div>

            {enquiry.reply_message && (
              <div className="rounded-3xl border-2 border-[#34451F]/15 bg-[#34451F]/5 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <MessageSquareQuote className="h-4 w-4 text-[#34451F] opacity-40" />
                  <span className="font-black text-[10px] tracking-wide text-[#34451F] uppercase">Our Reply</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#20231A] italic">
                  &quot;{enquiry.reply_message}&quot;
                </p>
              </div>
            )}

            <div className="h-4" />
          </div>

          {status !== "closed" && (
            <div className="z-40 shrink-0 rounded-b-4xl border-t-2 border-[#D8D5C8] bg-white/80 px-6 py-5 pb-10 backdrop-blur-md sm:pb-5">
              <div className="space-y-3">
                {status === "pending" && (
                  <div>
                    <label htmlFor={`reply-${enquiry.id}`} className="mb-1.5 block font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                      Reply (emailed to {enquiry.full_name})
                    </label>
                    <textarea
                      id={`reply-${enquiry.id}`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-[#D8D5C8] bg-[#F4F1E8] px-4 py-3 text-sm text-[#20231A] transition-all placeholder:text-[#5E6654]/50 focus:border-[#34451F]/30 focus:outline-none"
                    />
                  </div>
                )}

                {error && <p className="text-xs font-bold text-red-500">{error}</p>}

                <div className="flex gap-2">
                  {status === "pending" && (
                    <button
                      type="button"
                      onClick={handleReply}
                      disabled={isPending}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 py-3 font-black text-xs tracking-wider text-white uppercase transition-all hover:bg-green-700 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Reply
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-stone-100 py-3 font-black text-xs tracking-wider text-stone-700 uppercase transition-all hover:bg-stone-200 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function EnquiriesClient({ initialEnquiries, initialStatus }: { initialEnquiries: Enquiry[]; initialStatus?: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(
    () => (initialStatus && initialStatus in statusTheme && initialStatus !== "all" ? new Set([initialStatus]) : new Set())
  );

  const toggleStatusFilter = (status: string) => {
    const next = new Set(activeStatusFilters);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setActiveStatusFilters(next);
  };

  const filtered = useMemo(() => {
    return initialEnquiries
      .filter((e) => {
        const s = normStatus(e.status);
        const matchesStatus = activeStatusFilters.size === 0 ? true : activeStatusFilters.has(s);
        const q = searchQuery.trim().toLowerCase();
        return (
          matchesStatus &&
          (q === "" ||
            (e.full_name || "").toLowerCase().includes(q) ||
            (e.email || "").toLowerCase().includes(q) ||
            (e.subject || "").toLowerCase().includes(q) ||
            (e.message || "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { pending: 0, responded: 1, closed: 2 };
        const sa = statusOrder[normStatus(a.status)] ?? 4;
        const sb = statusOrder[normStatus(b.status)] ?? 4;
        if (sa !== sb) return sa - sb;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [initialEnquiries, activeStatusFilters, searchQuery]);

  const stats = useMemo(() => ({
    total: initialEnquiries.length,
    pending: initialEnquiries.filter((e) => normStatus(e.status) === "pending").length,
    responded: initialEnquiries.filter((e) => normStatus(e.status) === "responded").length,
    closed: initialEnquiries.filter((e) => normStatus(e.status) === "closed").length,
  }), [initialEnquiries]);

  return (
    <div className="animate-in space-y-3 duration-500 fade-in">
      <div className="rounded-2xl border border-[#D8D5C8] bg-white shadow-sm">
        <div className="flex flex-col items-center sm:flex-row">
          <div className="no-scrollbar overflow-x-auto px-2 pt-2 sm:flex-1">
            <div className="flex w-full min-w-max items-stretch gap-3 px-2 py-3 sm:justify-evenly">
              <StatusCircle count={stats.total} status="all" label="Total" isActive={activeStatusFilters.size === 0} onClick={() => setActiveStatusFilters(new Set())} />
              <StatusCircle count={stats.pending} status="pending" label="Pending" isActive={activeStatusFilters.has("pending")} onClick={() => toggleStatusFilter("pending")} />
              <StatusCircle count={stats.responded} status="responded" label="Responded" isActive={activeStatusFilters.has("responded")} onClick={() => toggleStatusFilter("responded")} />
              <StatusCircle count={stats.closed} status="closed" label="Closed" isActive={activeStatusFilters.has("closed")} onClick={() => toggleStatusFilter("closed")} />
            </div>
          </div>

          <div className="mx-3 border-t border-[#D8D5C8] sm:hidden" />
          <div className="my-2 hidden w-px self-stretch bg-[#D8D5C8] sm:block" />

          <div className="mb-3 flex shrink-0 justify-center px-4 py-2 sm:mb-0">
            <div className="flex h-10 w-full max-w-sm items-center gap-3 rounded-xl border border-[#D8D5C8] px-4 transition-colors focus-within:border-[#34451F] sm:w-56">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-[#5E6654]/50" />
                <input
                  type="text"
                  placeholder="Search names, messages..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#20231A] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#5E6654]/40 placeholder:normal-case"
                />
              </div>
              {(activeStatusFilters.size > 0 || searchQuery.length > 0) && (
                <button
                  type="button"
                  title="Clear filters"
                  onClick={() => {
                    setActiveStatusFilters(new Set());
                    setSearchQuery("");
                  }}
                  className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#D8D5C8]"
                >
                  <X className="h-3.5 w-3.5 text-[#5E6654]/50" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 pb-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8D5C8] bg-white py-16 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-[#5E6654]/50" />
            <p className="text-sm font-medium text-[#5E6654]">No enquiries found</p>
          </div>
        ) : (
          filtered.map((e) => <EnquiryCard key={e.id} enquiry={e} />)
        )}
      </div>
    </div>
  );
}