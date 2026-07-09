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
  all: { text: "text-[#1F1F1A]", border: "border-[#E6DFC8]", dot: "bg-[#5F624F]", ring: "ring-slate-500/40", bg: "bg-[#F7F4EA]", icon: null },
  pending: { text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", ring: "ring-amber-500/40", bg: "bg-amber-50", icon: <Clock className="w-4 h-4" /> },
  responded: { text: "text-green-700", border: "border-green-200", dot: "bg-green-500", ring: "ring-green-500/40", bg: "bg-green-50", icon: <CheckCircle className="w-4 h-4" /> },
  closed: { text: "text-stone-600", border: "border-stone-200", dot: "bg-stone-400", ring: "ring-stone-400/40", bg: "bg-stone-100", icon: <Archive className="w-4 h-4" /> },
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
    <div className="flex flex-col items-center gap-1.5 min-w-14 shrink-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex justify-center items-center border-2 rounded-full w-12 h-12 hover:scale-105 active:scale-95 transition-all touch-manipulation",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white ${theme.border}`
        )}
      >
        <span className={cn("font-black text-sm leading-none", isActive ? "text-white" : theme.text)}>
          {count}
        </span>
      </button>
      <span className={cn("font-black text-[10px] sm:text-[11px] uppercase tracking-tight", isActive ? theme.text : "text-[#5F624F]")}>
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
      {/* Card row */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "bg-white border-[#E6DFC8] border-2 rounded-2xl w-full overflow-hidden",
          "flex items-center gap-3 px-3 py-3.5 text-left",
          "hover:bg-[#F7F4EA]/60 transition-all active:scale-[0.98] shadow-sm"
        )}
      >
        <div className={cn("flex justify-center items-center border rounded-full w-11 h-11 shrink-0", theme.bg, theme.text, theme.border)}>
          {theme.icon ?? <Mail className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-black text-[#1F1F1A] text-sm truncate uppercase tracking-tight">
              {enquiry.full_name}
            </p>
            {enquiry.subject && (
              <span className="bg-[#5C4033]/5 px-1.5 py-0.5 border border-[#5C4033]/15 rounded max-w-32 font-black text-[#5C4033] text-[10px] truncate uppercase shrink-0">
                {enquiry.subject}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-semibold text-[#5F624F] text-xs truncate">
            {enquiry.message}
          </p>
        </div>

        <ChevronRight className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
      </button>

      {/* Detail sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="right-auto bottom-6 sm:left-1/2 flex flex-col bg-[#F7F4EA] p-0 border-[#E6DFC8] rounded-4xl rounded-t-4xl w-140 h-auto max-h-[85vh] -translate-x-1/2"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-[#E6DFC8] border-b-2 shrink-0">
            <SheetTitle className="flex items-center gap-2 font-black text-[#1F1F1A] text-sm uppercase tracking-widest">
              Enquiry
              <span className={cn("px-2 py-0.5 border rounded-full font-black text-[10px] uppercase", theme.bg, theme.text, theme.border)}>
                {status}
              </span>
            </SheetTitle>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 space-y-5 px-6 py-5 min-h-0 overflow-y-auto touch-pan-y">
            {/* Contact */}
            <div className="space-y-2">
              <p className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide">Contact</p>
              <div className="bg-white px-4 border border-[#E6DFC8] rounded-2xl overflow-hidden">
                <div className="flex justify-between items-start gap-4 py-3 border-[#E6DFC8] border-b">
                  <span className="pt-0.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">Name</span>
                  <span className="font-bold text-[#1F1F1A] text-sm text-right">{enquiry.full_name}</span>
                </div>
                <div className="flex justify-between items-start gap-4 py-3 border-[#E6DFC8] border-b">
                  <span className="flex items-center gap-1.5 pt-0.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">
                    <Mail className="w-3 h-3" /> Email
                  </span>
                  <a href={`mailto:${enquiry.email}`} className="font-bold text-[#5C4033] text-sm text-right underline underline-offset-2 break-all">
                    {enquiry.email}
                  </a>
                </div>
                {enquiry.phone_no && (
                  <div className="flex justify-between items-start gap-4 py-3 border-[#E6DFC8] border-b">
                    <span className="flex items-center gap-1.5 pt-0.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">
                      <Phone className="w-3 h-3" /> Phone
                    </span>
                    <a href={`tel:${enquiry.phone_no}`} className="font-bold text-[#5C4033] text-sm underline underline-offset-2">
                      {enquiry.phone_no}
                    </a>
                  </div>
                )}
                <div className="flex justify-between items-start gap-4 py-3">
                  <span className="pt-0.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">Received</span>
                  <span className="font-bold text-[#1F1F1A] text-sm">
                    {new Date(enquiry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <p className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
                {enquiry.subject ? `Message — ${enquiry.subject}` : "Message"}
              </p>
              <div className="bg-white px-4 py-3 border border-[#E6DFC8] rounded-2xl">
                <p className="text-[#1F1F1A] text-sm leading-relaxed whitespace-pre-wrap">{enquiry.message}</p>
              </div>
            </div>

            {/* Previous reply */}
            {enquiry.reply_message && (
              <div className="bg-[#5C4033]/5 p-5 border-[#5C4033]/15 border-2 rounded-3xl">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquareQuote className="opacity-40 w-4 h-4 text-[#5C4033]" />
                  <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">Our Reply</span>
                </div>
                <p className="text-[#1F1F1A] text-sm italic leading-relaxed whitespace-pre-wrap">
                  &quot;{enquiry.reply_message}&quot;
                </p>
              </div>
            )}

            <div className="h-4" />
          </div>

          {/* Footer — reply + close for open enquiries */}
          {status !== "closed" && (
            <div className="z-40 bg-white/80 backdrop-blur-md px-6 py-5 pb-10 sm:pb-5 border-[#E6DFC8] border-t-2 rounded-b-4xl shrink-0">
              <div className="space-y-3">
                {status === "pending" && (
                  <div>
                    <label htmlFor={`reply-${enquiry.id}`} className="block mb-1.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
                      Reply (emailed to {enquiry.full_name})
                    </label>
                    <textarea
                      id={`reply-${enquiry.id}`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      rows={3}
                      className="bg-[#F7F4EA] px-4 py-3 border border-[#E6DFC8] focus:border-[#5C4033]/30 rounded-2xl focus:outline-none w-full text-[#1F1F1A] placeholder:text-[#5F624F]/50 text-sm transition-all resize-none"
                    />
                  </div>
                )}

                {error && <p className="font-bold text-red-500 text-xs">{error}</p>}

                <div className="flex gap-2">
                  {status === "pending" && (
                    <button
                      type="button"
                      onClick={handleReply}
                      disabled={isPending}
                      className="flex flex-1 justify-center items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 py-3 rounded-2xl font-black text-white text-xs uppercase tracking-wider transition-all"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send Reply
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending}
                    className="flex flex-1 justify-center items-center gap-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 py-3 border border-stone-300 rounded-2xl font-black text-stone-700 text-xs uppercase tracking-wider transition-all"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
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
    <div className="space-y-3 animate-in duration-500 fade-in">
      {/* Stats + Search grouped card */}
      <div className="bg-white shadow-sm border border-[#E6DFC8] rounded-2xl">
        <div className="flex sm:flex-row flex-col items-center">
          <div className="sm:flex-1 px-2 pt-2 overflow-x-auto no-scrollbar">
            <div className="flex sm:justify-evenly items-stretch gap-3 px-2 py-3 w-full min-w-max">
              <StatusCircle count={stats.total} status="all" label="Total" isActive={activeStatusFilters.size === 0} onClick={() => setActiveStatusFilters(new Set())} />
              <StatusCircle count={stats.pending} status="pending" label="Pending" isActive={activeStatusFilters.has("pending")} onClick={() => toggleStatusFilter("pending")} />
              <StatusCircle count={stats.responded} status="responded" label="Responded" isActive={activeStatusFilters.has("responded")} onClick={() => toggleStatusFilter("responded")} />
              <StatusCircle count={stats.closed} status="closed" label="Closed" isActive={activeStatusFilters.has("closed")} onClick={() => toggleStatusFilter("closed")} />
            </div>
          </div>

          <div className="sm:hidden mx-3 border-[#E6DFC8] border-t" />
          <div className="hidden sm:block self-stretch bg-[#E6DFC8] my-2 w-px" />

          <div className="flex justify-center mb-3 sm:mb-0 px-4 py-2 shrink-0">
            <div className="flex items-center gap-3 px-4 border border-[#E6DFC8] focus-within:border-[#5C4033] rounded-xl w-full sm:w-56 max-w-sm h-10 transition-colors">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
                <input
                  type="text"
                  placeholder="Search names, messages..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none min-w-0 placeholder:font-normal text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-sm placeholder:normal-case placeholder:tracking-normal"
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
                  className="hover:bg-[#E6DFC8] p-1 rounded-lg transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5 text-[#5F624F]/50" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2 pb-2">
        {filtered.length === 0 ? (
          <div className="bg-white py-16 border border-[#E6DFC8] border-dashed rounded-2xl text-center">
            <Inbox className="mx-auto mb-3 w-10 h-10 text-[#5F624F]/50" />
            <p className="font-medium text-[#5F624F] text-sm">No enquiries found</p>
          </div>
        ) : (
          filtered.map((e) => <EnquiryCard key={e.id} enquiry={e} />)
        )}
      </div>
    </div>
  );
}