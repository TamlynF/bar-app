"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  CalendarDays,
  BadgePoundSterling,
  Users,
  ChevronRight,
  ChevronDown,
  Save,
  Pencil,
  Trash2,
  Hash,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Brain,
} from "lucide-react";
import { saveEventAction, deleteEventAction } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type EventType = {
  id: number;
  type: string;
  sub_type: string | null;
};

export type EventRecord = {
  id: number;
  created_at?: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  description: string | null;
  seating_required: boolean | null;
  payment_amount: number | null;
  host_employee_id: number | null;
  event_types_id: number;
  is_active: boolean | null;
  is_fully_booked: boolean | null;
  group_name: string | null;
  booking_id: number | null;
  external_link: string | null;
};

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "—";
  return timeStr.substring(0, 5);
}

function eventTypeLabel(et: EventType) {
  return [toTitleCase(et.type), toTitleCase(et.sub_type)].filter(Boolean).join(" - ");
}

export type Employee = { id: number; full_name: string };

type QuizCategory = { id: number; category_name: string; question_count: number; short_name?: string; order_no: number };
type QuizQuestion = { id: string; events_id: number; quiz_category_configs_id: number | null };
type BookingRecord = { id: number; event_id: number; status: string; group_size: number; group_name: string | null };

function getBookingStats(eventId: number, bookings: BookingRecord[]) {
  const eventBookings = bookings.filter(b => b.event_id === eventId);
  const confirmed = eventBookings.filter(b => b.status === "confirmed");
  const waitlisted = eventBookings.filter(b => b.status === "waitlisted");
  const cancelled = eventBookings.filter(b => b.status === "cancelled");
  return {
    confirmedCount: confirmed.length,
    confirmedPeople: confirmed.reduce((s, b) => s + (b.group_size ?? 0), 0),
    waitlistedCount: waitlisted.length,
    waitlistedPeople: waitlisted.reduce((s, b) => s + (b.group_size ?? 0), 0),
    cancelledCount: cancelled.length,
    cancelledPeople: cancelled.reduce((s, b) => s + (b.group_size ?? 0), 0),
    totalPeople: confirmed.reduce((s, b) => s + (b.group_size ?? 0), 0),
  };
}

function getQuizStatus(eventId: number, quizCategories: QuizCategory[], quizQuestions: QuizQuestion[]) {
  const eventQs = quizQuestions.filter(q => q.events_id === eventId);
  const categoryCounts = quizCategories.map(cat => ({
    ...cat,
    count: eventQs.filter(q => q.quiz_category_configs_id === cat.id).length,
  }));
  const total = categoryCounts.reduce((s, c) => s + c.count, 0);
  const target = categoryCounts.reduce((s, c) => s + c.question_count, 0);
  const allComplete = categoryCounts.every(c => c.count >= c.question_count);
  const someExist = total > 0;
  return { categoryCounts, total, target, allComplete, someExist };
}

export default function EventsClient({
  initialEvents = [],
  eventTypes = [],
  employees = [],
  quizCategories = [],
  quizQuestions = [],
  bookings = [],
  filter,
}: {
  initialEvents: EventRecord[];
  eventTypes: EventType[];
  employees: Employee[];
  quizCategories: QuizCategory[];
  quizQuestions: QuizQuestion[];
  bookings: BookingRecord[];
  filter?: string;
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [addForTypeId, setAddForTypeId] = useState<number | null>(null);
  const [historyGroups, setHistoryGroups] = useState<Set<number>>(new Set());
  const [formBookingId, setFormBookingId] = useState<string>("");
  const [formGroupName, setFormGroupName] = useState<string>("");

  // Auto-open sheet when returning from another page (?open=id)
  useEffect(() => {
    const openId = searchParams.get("open") || new URLSearchParams(window.location.search).get("open");
    if (!openId) return;
    const event = initialEvents.find((e) => String(e.id) === openId);
    if (event) {
      setSelected(event);
      setIsEditing(false);
      setIsAdding(false);
    }
    // Clean up the URL without navigating
    window.history.replaceState(null, "", "/event-setups/events");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const toggleGroup = (id: number) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const isSheetOpen = !!selected || isAdding;

  const openView = (event: EventRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(event);
  };

  const openAdd = (eventTypeId?: number) => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setAddForTypeId(eventTypeId ?? null);
    setFormBookingId("");
    setFormGroupName("");
    setIsAdding(true);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
    setAddForTypeId(null);
  };

  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveEventAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Delete event",
      description: "Delete this event? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteEventAction(selected.id);
      if (result?.error) {
        setFormError(result.error);
        } else {
          closeSheet();
        }
      });
  };

  // Date filtering: show events from past week onwards by default
  const todayStr = new Date().toISOString().split("T")[0];
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];

  const recentEvents = initialEvents.filter((e) => !e.date || e.date >= oneWeekAgoStr);

  const baseEvents = filter === "quiz-incomplete"
    ? initialEvents.filter((e) => {
        const et = eventTypes.find((t) => t.id === e.event_types_id);
        if (!et?.sub_type?.toLowerCase().includes("quiz")) return false;
        if (!e.date || e.date < todayStr) return false;
        const { total, target } = getQuizStatus(e.id, quizCategories, quizQuestions);
        return total < target;
      })
    : recentEvents;

  // Group events by event type — history groups show all events for that type
  const grouped = eventTypes
    .map((et) => {
      const isShowingHistory = historyGroups.has(et.id);
      const events = isShowingHistory
        ? initialEvents.filter((e) => e.event_types_id === et.id)
        : baseEvents.filter((e) => e.event_types_id === et.id);
      const totalCount = initialEvents.filter((e) => e.event_types_id === et.id).length;
      return { eventType: et, events, totalCount, hasHidden: totalCount > events.length, isShowingHistory };
    })
    .filter((g) => g.events.length > 0 || g.totalCount > 0);

  const visibleEvents = grouped.flatMap((g) => g.events);

  const knownTypeIds = new Set(eventTypes.map((et) => et.id));
  const ungrouped = visibleEvents.filter((e) => !knownTypeIds.has(e.event_types_id));

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  return (
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">

      {/* Filter notice */}
      {filter === "quiz-incomplete" && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
            Upcoming quizzes with incomplete questions
          </p>
          <Link
            href="/event-setups/events"
            className="text-[11px] font-black uppercase tracking-wide text-amber-700 underline shrink-0"
          >
            Clear
          </Link>
        </div>
      )}

      {/* Event List */}
      {visibleEvents.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <CalendarDays className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">
            {filter === "quiz-incomplete" ? "No upcoming quizzes with incomplete questions" : "No events yet"}
          </p>
          <p className="text-[11px] text-[#5F624F] mt-1">
            {filter === "quiz-incomplete" ? "All quiz questions are complete" : "Add your first event to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(({ eventType, events, hasHidden, isShowingHistory }) => {
            const isOpen = !collapsedGroups.has(eventType.id);
            return (
            <section key={eventType.id} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
              <div className="flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3 gap-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(eventType.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#5C4033] truncate">
                    {eventTypeLabel(eventType)} <span className="text-[#5F624F]">({events.length})</span>
                  </p>
                </button>
                {isShowingHistory && (
                  <button
                    type="button"
                    onClick={() => setHistoryGroups((prev) => { const next = new Set(prev); next.delete(eventType.id); return next; })}
                    className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] underline hover:text-[#5C4033] shrink-0"
                  >
                    Recent
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openAdd(eventType.id)}
                  className="w-7 h-7 sm:h-7 sm:w-auto sm:px-2.5 rounded-lg bg-[#5C4033] text-white hover:bg-[#5C4033]/85 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                  title={`Create ${eventTypeLabel(eventType)} event`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wide">Create</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleGroup(eventType.id)}
                  className="shrink-0"
                  title="Toggle group"
                >
                  <ChevronDown className={cn(
                    "w-4 h-4 text-[#5F624F] transition-transform duration-200",
                    isOpen && "rotate-180"
                  )} />
                </button>
              </div>

              {isOpen && <div className="divide-y divide-[#E6DFC8]/50">
                {events.map((event) => {
                  const hasPricing = !!event.payment_amount && event.payment_amount > 0;
                  const host = employees.find((e) => e.id === event.host_employee_id);
                  const hostInitials = host?.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) ?? null;
                  const isQuiz = !!eventType.sub_type?.toLowerCase().includes("quiz");
                  const quizStat = isQuiz ? getQuizStatus(event.id, quizCategories, quizQuestions) : null;
                  const bStats = getBookingStats(event.id, bookings);
                  const inactive = event.is_active === false;
                  const muted = "text-[#5F624F]";
                  return (
                    <div
                      key={event.id}
                      onClick={() => openView(event)}
                      className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]"
                    >
                      {/* Mobile layout */}
                      <div className="flex-1 min-w-0 sm:hidden">
                        {/* Row 1: date + active */}
                        <div className="flex items-center gap-2">
                          <p className={cn("text-xs font-black leading-snug truncate flex-1 min-w-0", inactive ? muted : "text-[#1F1F1A]")}>
                            {formatDate(event.date)}
                          </p>
                          {event.is_fully_booked && (
                            <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">Full</span>
                          )}
                          <span className={cn(
                            "text-[10px] font-black shrink-0 w-14 text-right",
                            !inactive ? "text-green-600" : "text-red-500"
                          )}>
                            {!inactive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {/* Row 2: title | people | quiz/price | host */}
                        <div className="flex items-center mt-0.5 gap-1">
                          <p className={cn("text-[10px] font-medium truncate flex-1 min-w-0", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                            {event.title || "Untitled Event"}
                          </p>
                          <span className={cn("text-[10px] font-black flex items-center gap-0.5 w-8 justify-end shrink-0 tabular-nums", muted)}>
                            <Users className="w-3 h-3 shrink-0" />
                            {bStats.confirmedPeople}
                          </span>
                          <span className="w-8 flex items-center justify-end shrink-0">
                            {quizStat ? (
                              inactive
                                ? <span className={cn("w-4 h-4", muted)}>{quizStat.allComplete ? <CheckCircle2 className="w-4 h-4" /> : quizStat.someExist ? <AlertTriangle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}</span>
                                : quizStat.allComplete
                                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  : quizStat.someExist
                                    ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    : <AlertCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <span className={cn(
                                "text-[10px] font-black",
                                inactive ? muted : hasPricing ? "text-green-700" : "text-[#5F624F]/40"
                              )}>
                                £{hasPricing ? event.payment_amount!.toFixed(2) : "0"}
                              </span>
                            )}
                          </span>
                          <span className="w-6 flex items-center justify-center shrink-0">
                            {hostInitials ? (
                              <span className={cn("text-[10px] font-black bg-[#F7F4EA] border border-[#E6DFC8] w-6 h-6 rounded-full flex items-center justify-center", muted)}>
                                {hostInitials}
                              </span>
                            ) : <span className="w-6" />}
                          </span>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden sm:block flex-1 min-w-0">
                        <p className={cn("text-sm font-black leading-snug truncate", inactive ? muted : "text-[#1F1F1A]")}>
                          {formatDate(event.date)}
                          {(event.start_time || event.end_time) && (
                            <span className={cn("text-[11px] font-medium ml-2", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                              {formatTime(event.start_time)}
                              {event.end_time && (
                                <span className={inactive ? "text-[#5F624F]/30" : "text-[#5F624F]/50"}> {"\u2192"} {formatTime(event.end_time)}</span>
                              )}
                            </span>
                          )}
                        </p>
                        <p className={cn("flex items-center gap-1 text-[11px] font-medium mt-0.5 flex-wrap", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                          {event.title || "Untitled Event"}
                          {host && (
                            <span className={cn("ml-2 font-black", inactive ? "text-[#5F624F]/40" : "text-[#1F1F1A]/60")}>{host.full_name}</span>
                          )}
                        </p>
                      </div>

                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                          {quizStat && (
                          <span className="flex items-center gap-1.5 text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg">
                            {quizStat.allComplete
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                              : quizStat.someExist
                              ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              : <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            {quizStat.total} / {quizStat.target} Questions
                          </span>
                        )}
                        {hasPricing ? (
                          <span className="text-[11px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg flex items-center gap-1">
                            <BadgePoundSterling className="w-3 h-3" />
                            {event.payment_amount!.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg">
                            Free
                          </span>
                        )}
                        <span className={cn(
                          "text-[11px] font-black px-2 py-1 rounded-lg border flex items-center gap-1",
                          event.seating_required
                            ? "text-[#5C4033] bg-[#5C4033]/10 border-[#5C4033]/20"
                            : "text-[#5F624F]/40 bg-[#F7F4EA] border-[#E6DFC8]"
                        )}>
                          Seating
                          {event.seating_required
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-[#5C4033]" />
                            : <XCircle className="w-3.5 h-3.5 text-[#5F624F]/30" />}
                        </span>
                        <span className={cn(
                          "text-[11px] font-black px-2 py-1 rounded-lg border",
                          event.is_active !== false
                            ? "text-green-700 bg-green-50 border-green-200"
                            : "text-red-500 bg-red-50 border-red-200"
                        )}>
                          {event.is_active !== false ? "Active" : "Inactive"}
                        </span>

                      </div>

                      <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
                    </div>
                  );
                })}
                {!isShowingHistory && hasHidden && (
                  <button
                    type="button"
                    onClick={() => setHistoryGroups((prev) => new Set(prev).add(eventType.id))}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-wide text-[#5F624F] hover:text-[#5C4033] hover:bg-[#F7F4EA]/50 transition-colors"
                  >
                    View All History
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>}
            </section>
          )})}

          {ungrouped.length > 0 && (
            <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#F7F4EA]">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#5C4033]">Other</p>
                <span className="text-[10px] font-black text-[#5F624F] bg-white border border-[#E6DFC8] px-2.5 py-1 rounded-lg tabular-nums">
                  {ungrouped.length}
                </span>
              </div>
              <div className="divide-y divide-[#E6DFC8]/50">
                {ungrouped.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => openView(event)}
                    className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[#1F1F1A] leading-snug">{event.title || "Untitled Event"}</p>
                      <p className="text-[11px] text-[#5F624F] font-medium mt-0.5">{formatDate(event.date)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Bottom Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
           className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px]
            sm:h-auto sm:max-h-[80vh] sm:rounded-[2rem] sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                  {isAdding ? "New Event" : isEditing ? "Edit Event" : "View Event"}
                </SheetTitle>
                {selected && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-xs font-black text-[#5F624F] uppercase tracking-wide tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <span className={cn(
                  "shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full border",
                  selected.is_active !== false
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-red-100 text-red-600 border-red-300"
                )}>
                  {selected.is_active !== false ? "Active" : "Inactive"}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4 sm:space-y-5">

            {/* View mode */}
            {!showForm && selected && (() => {
              const et = eventTypes.find((e) => e.id === selected.event_types_id);
              const hasPricing = !!selected.payment_amount && selected.payment_amount > 0;
              const host = employees.find((e) => e.id === selected.host_employee_id);
              const isQuiz = !!et?.sub_type?.toLowerCase().includes("quiz");
              const bk = getBookingStats(selected.id, bookings);
              return (
                <div className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                  {/* Event details */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <DetailCell label="Title" value={selected?.title || "Untitled Event"} />
                    <DetailCell label="Date" value={formatDate(selected.date)} />
                    <DetailCell
                      label="Time"
                      value={
                        selected.start_time || selected.end_time
                          ? `${formatTime(selected.start_time)} - ${formatTime(selected.end_time)}`
                          : "—"
                      }
                    />
                    <DetailCell label="Host" value={host?.full_name ?? "—"} />
                    <DetailCell
                      label="Payment"
                      value={hasPricing ? `£${selected.payment_amount!.toFixed(2)} / person` : "Free"}
                    />
                    <DetailCell label="Seating" value={selected.seating_required ? "Required" : "Not required"} />
                    <DetailCell label="Fully Booked" value={selected.is_fully_booked ? "Yes" : "No"} />
                    {et?.type === "games" && (
                      <>
                        <DetailCell label="Group Name" value={selected.group_name || "—"} />
                        <DetailCell label="Linked Booking" value={selected.booking_id ? `#${selected.booking_id}` : "—"} />
                      </>
                    )}
                    {selected.description && (
                      <DetailCell label="Description" value={selected.description} />
                    )}
                    {selected.external_link && (
                      <DetailCell label="External Link" value={selected.external_link} />
                    )}
                  </div>

                  {/* Quiz questions section */}
                  {isQuiz && (() => {
                    const { categoryCounts } = getQuizStatus(selected.id, quizCategories, quizQuestions);
                    return (
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-3 border-b border-[#E6DFC8]">
                          <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Quiz Questions</span>
                          <span className="flex-1" />
                          <Link
                            href={`/event-setups/events/${selected.id}`}
                            className="h-7 rounded-xl bg-[#5C4033] flex items-center justify-center text-white hover:bg-[#5C4033]/85 transition-colors px-2.5 gap-1.5"
                            title="Manage Quiz"
                          >
                            <Brain className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-wide">Manage Quiz</span>
                          </Link>
                        </div>
                        <div className="px-4 sm:px-5 py-2.5 space-y-2">
                          {categoryCounts.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs sm:text-sm font-bold text-[#1F1F1A]">
                                {cat.category_name}
                                {cat.short_name && <span className="text-[10px] font-black text-[#5F624F]/60 mr-1.5"> ({cat.short_name})</span>}                                
                              </span>
                              <div className="flex items-center gap-1.5">
                                {cat.count >= cat.question_count
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                  : cat.count > 0
                                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                                <span className="text-xs sm:text-sm font-black tabular-nums text-[#5F624F]">
                                  {cat.count} / {cat.question_count}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bookings summary */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 border-b border-[#E6DFC8]">
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Bookings</span>
                      <span className="flex-1" />
                      <Link
                        href={`/event-bookings/event/${selected.id}`}
                        className="h-7 rounded-xl bg-[#5C4033] flex items-center justify-center text-white hover:bg-[#5C4033]/85 transition-colors px-2.5 gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-wide">View All</span>
                      </Link>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-[#E6DFC8]/50">
                      <div className="px-2 sm:px-3 py-2 text-center">
                        <p className="text-base sm:text-lg font-black text-green-600 tabular-nums leading-tight">{bk.confirmedPeople}</p>
                        <p className="text-[10px] sm:text-[9px] font-black uppercase tracking-wide text-[#5F624F]">Confirmed</p>
                      </div>
                      <div className="px-2 sm:px-3 py-2 text-center">
                        <p className="text-base sm:text-lg font-black text-amber-500 tabular-nums leading-tight">{bk.waitlistedPeople}</p>
                        <p className="text-[10px] sm:text-[9px] font-black uppercase tracking-wide text-[#5F624F]">Waitlisted</p>
                      </div>
                      <div className="px-2 sm:px-3 py-2 text-center">
                        <p className="text-base sm:text-lg font-black text-red-500 tabular-nums leading-tight">{bk.cancelledPeople}</p>
                        <p className="text-[10px] sm:text-[9px] font-black uppercase tracking-wide text-[#5F624F]">Cancelled</p>
                      </div>
                    </div>
                  </div>

                  {formError && <ErrorBox message={formError} />}
                </div>
              );
            })()}

            {/* Edit / Add form */}
            {showForm && (
              <form id="event-form" action={handleSubmit} className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  {/* Title */}
                  <FormRow label="Title" required>
                    <input
                      name="title"
                      required
                      placeholder="e.g. Music Bingo"
                      defaultValue={formDefault?.title ?? (() => {
                        if (!addForTypeId) return "";
                        const et = eventTypes.find((t) => t.id === addForTypeId);
                        const sub = et?.sub_type?.toLowerCase() ?? "";
                        if (sub.includes("quiz")) return "Quiz Night";
                        if (sub.includes("bingo")) return "Music Bingo";
                        return "";
                      })()}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  {/* Event Type */}
                  <FormRow label="Event Type" required>
                    <select
                      title="Event Type"
                      name="event_types_id"
                      required
                      defaultValue={formDefault?.event_types_id ?? addForTypeId ?? eventTypes[0]?.id ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
                    >
                      {eventTypes.map((et) => (
                        <option key={et.id} value={et.id} className="dir-ltr">{eventTypeLabel(et)}</option>
                      ))}
                    </select>
                  </FormRow>

                  {/* Date */}
                  <FormRow label="Date" required>
                    <input
                      title="Date"
                      name="date"
                      type="date"
                      required
                      defaultValue={formDefault?.date ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
                    />
                  </FormRow>

                  {/* Time */}
                  <FormRow label="Time">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <input
                        title="Start time"
                        name="start_time"
                        type="time"
                        defaultValue={formDefault?.start_time ? formatTime(formDefault.start_time) : ""}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none w-[5.5rem] text-right"
                      />
                      <span className="text-[#5F624F]/50 text-xs">-</span>
                      <input
                        title="End time"
                        name="end_time"
                        type="time"
                        defaultValue={formDefault?.end_time ? formatTime(formDefault.end_time) : ""}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none w-[5.5rem] text-right"
                      />
                    </div>
                  </FormRow>

                  {/* Host */}
                  <FormRow label="Host">
                    <select
                      title="Host"
                      name="host_employee_id"
                      defaultValue={formDefault?.host_employee_id ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
                    >
                      <option value="" className="dir-ltr">No host</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id} className="dir-ltr">{e.full_name}</option>
                      ))}
                    </select>
                  </FormRow>

                  {/* Payment */}
                  <FormRow label="Payment (£)">
                    <input
                      name="payment_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      defaultValue={formDefault?.payment_amount ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  {/* Seating */}
                  <FormRow label="Seating Required">
                    <span className="flex-1" />
                    <input
                      title="Seating Required"
                      id="seating_required"
                      name="seating_required"
                      type="checkbox"
                      defaultChecked={formDefault?.seating_required ?? true}
                      className="w-5 h-5 rounded accent-[#5C4033] cursor-pointer"
                    />
                  </FormRow>

                  {/* Active */}
                  <FormRow label="Active">
                    <span className="flex-1" />
                    <input
                      title="Active"
                      id="is_active"
                      name="is_active"
                      type="checkbox"
                      defaultChecked={formDefault?.is_active ?? true}
                      className="w-5 h-5 rounded accent-[#5C4033] cursor-pointer"
                    />
                  </FormRow>

                  {/* Fully Booked */}
                  <FormRow label="Fully Booked">
                    <span className="flex-1" />
                    <input
                      title="Fully Booked"
                      id="is_fully_booked"
                      name="is_fully_booked"
                      type="checkbox"
                      defaultChecked={formDefault?.is_fully_booked ?? false}
                      className="w-5 h-5 rounded accent-red-600 cursor-pointer"
                    />
                  </FormRow>

                  {/* Group Name & Booking (games only) */}
                  {(() => {
                    const etId = formDefault?.event_types_id ?? addForTypeId;
                    const et = eventTypes.find(t => t.id === etId);
                    if (et?.type !== "games") return null;
                    const eventBookings = formDefault
                      ? bookings.filter(b => b.event_id === formDefault.id && b.status !== "cancelled")
                      : [];
                    return (
                      <>
                        <FormRow label="Linked Booking">
                          <input type="hidden" name="booking_id" value={formBookingId} />
                          <select
                            title="Linked Booking"
                            value={formBookingId}
                            onChange={(e) => {
                              const bId = e.target.value;
                              setFormBookingId(bId);
                              if (bId) {
                                const bk = eventBookings.find(b => String(b.id) === bId);
                                if (bk?.group_name) setFormGroupName(bk.group_name);
                              }
                            }}
                            className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
                          >
                            <option value="" className="dir-ltr">No booking</option>
                            {eventBookings.map(b => (
                              <option key={b.id} value={b.id} className="dir-ltr">
                                #{b.id} — {b.group_name || "Unnamed"}
                              </option>
                            ))}
                          </select>
                        </FormRow>
                        <FormRow label="Group Name">
                          <input type="hidden" name="group_name" value={formGroupName} />
                          <input
                            value={formGroupName}
                            onChange={(e) => setFormGroupName(e.target.value)}
                            placeholder="e.g. The Brainiacs"
                            className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                          />
                        </FormRow>
                      </>
                    );
                  })()}

                  {/* Description */}
                  <div className="px-4 sm:px-5 py-2.5 sm:py-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wide">Description</span>
                    </div>
                    <textarea
                      name="description"
                      placeholder="Brief description of the event..."
                      rows={2}
                      defaultValue={formDefault?.description ?? ""}
                      className="w-full text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none placeholder:text-[#5F624F]/40 resize-none"
                    />
                  </div>

                  {/* External Link */}
                  <FormRow label="External Link">
                    <input
                      name="external_link"
                      type="url"
                      placeholder="https://instagram.com/..."
                      defaultValue={formDefault?.external_link ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>
                </div>

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-wide text-[10px] bg-white hover:bg-red-50 hover:border-red-200"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete
                </Button>
                <Button
                  onClick={() => { setFormError(null); setFormBookingId(selected?.booking_id ? String(selected.booking_id) : ""); setFormGroupName(selected?.group_name ?? ""); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-2" />Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormError(null);
                    if (isAdding) closeSheet();
                    else setIsEditing(false);
                  }}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="event-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  {isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Save className="w-4 h-4 mr-2" />Save</>}
                </Button>
              </div>
            )}
          </div>
          {ConfirmDialogUI}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
        {required && <span className="text-red-500 text-[10px] font-black">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
      </div>
      <span className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug">
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 font-bold leading-snug">{message}</p>
    </div>
  );
}
