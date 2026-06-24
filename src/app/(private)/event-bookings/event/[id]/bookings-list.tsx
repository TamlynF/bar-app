"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  X,
  Ticket,
  User,
  Users,
  Copy,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { updateBookingStatusAction } from "./actions";

export type BookingItem = {
  id: number;
  groupName: string;
  size: number;
  status: string;
  paid: number;
  total: number;
  request: string | null;
  createdAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  tables: string;
};

export type BookingsEventMeta = {
  title: string;
  dateLabel: string;
  startTime: string | null;
  price: number;
};

const ST_META: Record<string, { label: string; pill: string; solid: string; soft: string }> = {
  confirmed: { label: "Confirmed", pill: "bg-green-100 text-green-700 border-green-200", solid: "bg-green-600 text-white border-green-600", soft: "text-green-700 border-green-300" },
  waitlisted: { label: "Waitlisted", pill: "bg-amber-100 text-amber-700 border-amber-200", solid: "bg-amber-500 text-white border-amber-500", soft: "text-amber-700 border-amber-300" },
  cancelled: { label: "Cancelled", pill: "bg-[#F7F4EA] text-[#5F624F] border-[#E6DFC8]", solid: "bg-[#5F624F] text-white border-[#5F624F]", soft: "text-[#5F624F] border-[#E6DFC8]" },
};
const stMeta = (s: string) => ST_META[s] ?? ST_META.cancelled;
const ORDER: Record<string, number> = { confirmed: 0, waitlisted: 1, cancelled: 2 };

export function BookingsList({ items, event }: { items: BookingItem[]; event: BookingsEventMeta }) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [filter, setFilter] = useState<"all" | "confirmed" | "waitlisted" | "cancelled">("all");
  const [selId, setSelId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const selected = selId != null ? list.find((b) => b.id === selId) ?? null : null;

  const setStatus = (id: number, status: string) => {
    setList((prev) => prev.map((b) => (b.id === id ? { ...b, status, paid: status === "confirmed" ? b.total : 0 } : b)));
    setPendingId(id);
    startTransition(async () => {
      await updateBookingStatusAction(id, status);
      router.refresh();
      setPendingId(null);
    });
  };

  const count = (s: string) => list.filter((b) => b.status === s).length;
  const pills: { key: typeof filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: list.length },
    { key: "confirmed", label: "Confirmed", n: count("confirmed") },
    { key: "waitlisted", label: "Waitlisted", n: count("waitlisted") },
    { key: "cancelled", label: "Cancelled", n: count("cancelled") },
  ];

  const shown = (filter === "all" ? list : list.filter((b) => b.status === filter))
    .slice()
    .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.groupName.localeCompare(b.groupName));

  return (
    <section className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pills.map((p) => {
          const on = filter === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setFilter(p.key)}
              className={cn(
                "shrink-0 h-8 px-3.5 rounded-full border text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 transition-colors",
                on ? "bg-[#5C4033] text-white border-[#5C4033]" : "bg-white text-[#5F624F] border-[#E6DFC8] hover:border-[#5C4033]"
              )}
            >
              {p.label} <span className="opacity-70">{p.n}</span>
            </button>
          );
        })}
      </div>

      {/* Rows */}
      {shown.length === 0 ? (
        <div className="bg-white border border-[#E6DFC8] rounded-2xl p-10 text-center">
          <Users className="w-7 h-7 text-[#5F624F] opacity-30 mx-auto mb-2" />
          <p className="text-sm font-black text-[#1F1F1A]">No {filter === "all" ? "" : filter} bookings</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((b) => {
            const m = stMeta(b.status);
            const rowPending = pendingId === b.id && isPending;
            return (
              <div key={b.id} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
                <button type="button" onClick={() => setSelId(b.id)} className="w-full text-left flex items-start gap-2.5 px-3 py-3 hover:bg-[#F7F4EA]/50 transition-colors">
                  <span className={cn("shrink-0 mt-0.5 text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border", m.pill)}>{m.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[#1F1F1A] leading-snug truncate">{b.groupName}</p>
                    {b.contactName && (
                      <p className="text-[11px] text-[#5F624F] font-medium truncate">
                        {b.contactName}
                        {b.contactEmail && <span className="opacity-60"> · {b.contactEmail}</span>}
                      </p>
                    )}
                    {b.request && <p className="text-[10px] text-[#a39d86] italic truncate mt-0.5">“{b.request}”</p>}
                  </div>
                  <div className="shrink-0 text-center min-w-10">
                    <p className="text-lg font-black text-[#1F1F1A] tabular-nums leading-none">{b.size}</p>
                    <p className="text-[8px] font-black uppercase tracking-wide text-[#5F624F]">guests</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0 self-center" />
                </button>
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#FBF8EE] border-t border-[#E6DFC8]/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#1F1F1A]">
                      <Ticket className="w-3 h-3 text-[#5F624F]" /> {b.tables || "—"}
                    </span>
                    {event.price > 0 && (
                      <span className="text-[11px] font-black text-[#1F1F1A]">
                        £{b.paid.toFixed(2)}<span className="text-[#5F624F] font-medium">/£{b.total.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {rowPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#5F624F]" />
                    ) : (
                      <>
                        {b.status !== "confirmed" && (
                          <button type="button" title="Confirm" onClick={() => setStatus(b.id, "confirmed")} className="w-7 h-7 rounded-lg border border-[#E6DFC8] bg-white grid place-items-center text-green-600 hover:bg-green-50 hover:border-green-200 transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {b.status !== "waitlisted" && b.status !== "cancelled" && (
                          <button type="button" title="Waitlist" onClick={() => setStatus(b.id, "waitlisted")} className="w-7 h-7 rounded-lg border border-[#E6DFC8] bg-white grid place-items-center text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors">
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {b.status !== "cancelled" && (
                          <button type="button" title="Cancel" onClick={() => setStatus(b.id, "cancelled")} className="w-7 h-7 rounded-lg border border-[#E6DFC8] bg-white grid place-items-center text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single-booking detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelId(null); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 max-h-[88vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-130
            sm:max-h-[80vh] sm:rounded-4xl sm:bottom-6 sm:border-2 sm:border-[#E6DFC8]"
        >
          {selected && (() => {
            const m = stMeta(selected.status);
            const outstanding = Math.max(0, selected.total - selected.paid);
            const payState = selected.total === 0 ? "Free" : selected.paid >= selected.total ? "Paid in full" : selected.paid > 0 ? "Part paid" : "Unpaid";
            return (
              <>
                <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sm:rounded-t-4xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] truncate">{event.title}</p>
                      <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">{selected.groupName}</SheetTitle>
                      <SheetDescription className="sr-only">Booking details</SheetDescription>
                      <span className="text-[10px] font-black text-[#5F624F] uppercase tracking-wide tabular-nums">Booking #{selected.id}</span>
                    </div>
                    <span className={cn("shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full border", m.pill)}>{m.label}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 space-y-4">
                  {/* Guest */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#F7F4EA] text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Guest</div>
                    <ContactRow icon={<User className="w-4 h-4" />} value={selected.contactName ?? "—"} />
                    {selected.contactEmail && <ContactRow icon={<Copy className="w-4 h-4" />} value={selected.contactEmail} copy={selected.contactEmail} />}
                    {selected.contactPhone && <ContactRow icon={<Users className="w-4 h-4" />} value={selected.contactPhone} copy={selected.contactPhone} />}
                  </div>

                  {/* Booking */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#F7F4EA] text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Booking</div>
                    <DRow label="Party Size" value={`${selected.size} guest${selected.size === 1 ? "" : "s"}`} />
                    <DRow label="Table" value={selected.tables || "—"} />
                    <DRow label="Event Date" value={`${event.dateLabel}${event.startTime ? ` · ${event.startTime}` : ""}`} />
                    <DRow label="Booked On" value={selected.createdAt} />
                  </div>

                  {selected.request && (
                    <div className="bg-[#FBF6E6] border border-[#F0E4BE] rounded-2xl px-4 py-3">
                      <p className="text-[9.5px] font-black uppercase tracking-wide text-amber-700">Special request</p>
                      <p className="text-sm text-[#1F1F1A] italic leading-snug mt-1">“{selected.request}”</p>
                    </div>
                  )}

                  {/* Payment */}
                  {event.price > 0 && (
                    <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-[#F7F4EA] text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Payment</div>
                      <DRow label="Per Person" value={`£${event.price.toFixed(2)}`} />
                      <DRow label="Total Due" value={`£${selected.total.toFixed(2)}`} />
                      <DRow label="Paid" value={`£${selected.paid.toFixed(2)}`} accent="text-green-700" />
                      {outstanding > 0 && <DRow label="Outstanding" value={`£${outstanding.toFixed(2)}`} accent="text-red-600" />}
                      <DRow label="Status" value={payState} />
                    </div>
                  )}

                  {/* Status changer */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#F7F4EA] text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Update Status</div>
                    <div className="flex gap-2 p-3">
                      {(["confirmed", "waitlisted", "cancelled"] as const).map((s) => {
                        const sm = stMeta(s);
                        const on = selected.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(selected.id, s)}
                            className={cn("flex-1 h-10 rounded-xl border text-[9.5px] font-black uppercase tracking-wide inline-flex items-center justify-center gap-1.5 transition-colors", on ? sm.solid : cn("bg-white", sm.soft))}
                          >
                            {s === "confirmed" ? <Check className="w-3.5 h-3.5" /> : s === "waitlisted" ? <Clock className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            {sm.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 px-4 py-4 pb-8 sm:pb-4 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md sm:rounded-b-4xl">
                  <button type="button" onClick={() => setSelId(null)} className="w-full h-12 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white">
                    Close
                  </button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function ContactRow({ icon, value, copy }: { icon: React.ReactNode; value: string; copy?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#E6DFC8]/60 first:border-t-0">
      <span className="inline-flex items-center gap-2 min-w-0 text-sm font-black text-[#1F1F1A] truncate">
        <span className="text-[#5F624F] shrink-0">{icon}</span>
        <span className="truncate">{value}</span>
      </span>
      {copy && (
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(copy); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
          className="shrink-0 h-7 px-2.5 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] text-[9.5px] font-black uppercase tracking-wide text-[#5C4033] hover:bg-[#E6DFC8]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

function DRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#E6DFC8]/60">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">{label}</span>
      <span className={cn("text-sm font-black text-right", accent ?? "text-[#1F1F1A]")}>{value}</span>
    </div>
  );
}
