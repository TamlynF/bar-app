"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  Calendar,
  CalendarDays,
  Clock,
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
  Sparkles,
  Brain,
} from "lucide-react";
import { saveEventAction, deleteEventAction } from "./actions";
import { cn } from "@/lib/utils";

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
  return [toTitleCase(et.type), toTitleCase(et.sub_type)].filter(Boolean).join(" > ");
}

export type Employee = { id: number; full_name: string };

type QuizCategory = { id: number; category_name: string; question_count: number };
type QuizQuestion = { id: string; events_id: number; quiz_category_configs_id: number | null };

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
  filter,
}: {
  initialEvents: EventRecord[];
  eventTypes: EventType[];
  employees: Employee[];
  quizCategories: QuizCategory[];
  quizQuestions: QuizQuestion[];
  filter?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  // Auto-open sheet when returning from quiz questions page (?open=id)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    const event = initialEvents.find((e) => String(e.id) === openId);
    if (event) {
      setSelected(event);
      setIsEditing(false);
      setIsAdding(false);
    }
    router.replace("/event-setups");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setIsAdding(true);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
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

  const handleDelete = () => {
    if (!selected) return;
    if (window.confirm("Delete this event? This cannot be undone.")) {
      startTransition(async () => {
        const result = await deleteEventAction(selected.id);
        if (result?.error) {
          setFormError(result.error);
        } else {
          closeSheet();
        }
      });
    }
  };

  // Apply filter if present
  const todayStr = new Date().toISOString().split("T")[0];
  const visibleEvents = filter === "quiz-incomplete"
    ? initialEvents.filter((e) => {
        const et = eventTypes.find((t) => t.id === e.event_types_id);
        if (!et?.sub_type?.toLowerCase().includes("quiz")) return false;
        if (!e.date || e.date < todayStr) return false;
        const { total, target } = getQuizStatus(e.id, quizCategories, quizQuestions);
        return total < target;
      })
    : initialEvents;

  // Group events by event type
  const grouped = eventTypes
    .map((et) => ({
      eventType: et,
      events: visibleEvents.filter((e) => e.event_types_id === et.id),
    }))
    .filter((g) => g.events.length > 0);

  const knownTypeIds = new Set(eventTypes.map((et) => et.id));
  const ungrouped = visibleEvents.filter((e) => !knownTypeIds.has(e.event_types_id));

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
          {visibleEvents.length} event{visibleEvents.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={openAdd}
          size="sm"
          className="h-9 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-[#26300D] text-[#FDCC4B] hover:bg-[#26300D]/90"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Event
        </Button>
      </div>

      {/* Filter notice */}
      {filter === "quiz-incomplete" && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">
            Upcoming quizzes with incomplete questions
          </p>
          <Link
            href="/event-setups/events"
            className="text-[11px] font-black uppercase tracking-widest text-amber-700 underline shrink-0"
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
          {grouped.map(({ eventType, events }) => {
            const isOpen = !collapsedGroups.has(eventType.id);
            return (
            <section key={eventType.id} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(eventType.id)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left"
              >
                <p className="text-[11px] font-black uppercase tracking-widest text-[#26300D]">
                  {eventTypeLabel(eventType)}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black text-[#5F624F] bg-white border border-[#E6DFC8] px-2.5 py-1 rounded-lg tabular-nums">
                    {events.length}
                  </span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-[#5F624F] transition-transform duration-200",
                    isOpen && "rotate-180"
                  )} />
                </div>
              </button>

              {isOpen && <div className="divide-y divide-[#E6DFC8]">
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
                  return (
                    <div
                      key={event.id}
                      onClick={() => openView(event)}
                      className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-[#1F1F1A] leading-snug sm:truncate">
                          {event.title || "Untitled Event"}
                        </p>

                        {/* Mobile */}
                        <div className="flex items-center gap-2 mt-1 sm:hidden">
                          <span className="text-[10px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-0.5 rounded-lg flex items-center gap-1 flex-1 min-w-0">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span className="truncate">{formatDate(event.date)}</span>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn(
                              "text-[10px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] w-6 h-6 rounded-full flex items-center justify-center",
                              !hostInitials && "opacity-0"
                            )}>
                              {hostInitials ?? ""}
                            </span>
                            {hasPricing && (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                £{event.payment_amount!.toFixed(2)}
                              </span>
                            )}
                            {quizStat && (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-0.5 rounded-lg">                            
                                {quizStat.allComplete
                                  ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                                  : quizStat.someExist
                                    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                              
                              {quizStat.total} / {quizStat.target}
                              </span>
                              )}
                          </div>
                        </div>

                        {/* Desktop */}
                        <p className="hidden sm:flex items-center gap-1 text-[11px] text-[#5F624F] font-medium mt-0.5 flex-wrap">
                          <Calendar className="w-3 h-3" />
                          {formatDate(event.date)}
                          {(event.start_time || event.end_time) && (
                            <span className="ml-2 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(event.start_time)}
                              {event.end_time && (
                                <span className="text-[#5F624F]/50">→ {formatTime(event.end_time)}</span>
                              )}
                            </span>
                          )}
                          {host && (
                            <span className="ml-2 font-black text-[#1F1F1A]/60">{host.full_name}</span>
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
                          <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1">
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
                            ? "text-[#26300D] bg-[#26300D]/10 border-[#26300D]/20"
                            : "text-[#5F624F]/40 bg-[#F7F4EA] border-[#E6DFC8]"
                        )}>
                          Seating
                          {event.seating_required
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-[#26300D]" />
                            : <XCircle className="w-3.5 h-3.5 text-[#5F624F]/30" />}
                        </span>
                      
                      </div>

                      <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
                    </div>
                  );
                })}
              </div>}
            </section>
          )})}

          {ungrouped.length > 0 && (
            <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#F7F4EA]">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#26300D]">Other</p>
                <span className="text-[10px] font-black text-[#5F624F] bg-white border border-[#E6DFC8] px-2.5 py-1 rounded-lg tabular-nums">
                  {ungrouped.length}
                </span>
              </div>
              <div className="divide-y divide-[#E6DFC8]">
                {ungrouped.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => openView(event)}
                    className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#1F1F1A] leading-snug">{event.title || "Untitled Event"}</p>
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
                {selected && !isEditing && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-xs font-black text-[#5F624F] uppercase tracking-widest tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
              {selected && !isEditing && !isAdding && (() => {
                const et = eventTypes.find((e) => e.id === selected.event_types_id);
                const isQuiz = !!et?.sub_type?.toLowerCase().includes("quiz");
                return isQuiz ? (
                  <Link
                    href={`/event-setups/${selected.id}`}
                    className="shrink-0 h-10 rounded-2xl bg-[#26300D] flex items-center justify-center text-[#FDCC4B] hover:bg-[#26300D]/85 transition-colors px-3 gap-2"
                    title="Manage Quiz"
                  >
                    <Brain className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Manage Quiz</span>
                  </Link>
                ) : null;
              })()}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 touch-pan-y space-y-5">

            {/* View mode */}
            {!showForm && selected && (() => {
              const et = eventTypes.find((e) => e.id === selected.event_types_id);
              const hasPricing = !!selected.payment_amount && selected.payment_amount > 0;
              const host = employees.find((e) => e.id === selected.host_employee_id);
              const isQuiz = !!et?.sub_type?.toLowerCase().includes("quiz");
              return (
                <div className="animate-in fade-in duration-200 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 space-y-5 sm:space-y-0">
                  {/* Left — detail cells */}
                  <div className="space-y-5">
                    <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                      <DetailCell label="Title" value={selected?.title || "Untitled Event"} />
                      <DetailCell label="Event Type" value={et ? eventTypeLabel(et) : `Type #${selected.event_types_id}`} />
                      <DetailCell label="Date" value={formatDate(selected.date)} />
                      <DetailCell label="Start Time" value={formatTime(selected.start_time)} />
                      <DetailCell label="End Time" value={formatTime(selected.end_time)} />
                      <DetailCell label="Host" value={host?.full_name ?? "—"} />
                      <DetailCell
                        label="Payment"
                        value={hasPricing ? `£${selected.payment_amount!.toFixed(2)} / person` : "Free"}
                      />
                      <DetailCell label="Seating" value={selected.seating_required ? "Required" : "Not required"} />
                      {selected.description && (
                        <DetailCell label="Description" value={selected.description} />
                      )}
                    </div>
                    {formError && <ErrorBox message={formError} />}
                  </div>

                  {/* Right — quiz section (only rendered for quiz events) */}
                  {isQuiz && (() => {
                    const { categoryCounts } = getQuizStatus(selected.id, quizCategories, quizQuestions);
                    return (
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                        <div className="px-5 py-4 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-2">Quiz Questions</p>
                          {categoryCounts.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#1F1F1A]">{cat.category_name}</span>
                              <div className="flex items-center gap-1.5">
                                {cat.count >= cat.question_count
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                  : cat.count > 0
                                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                                <span className="text-xs font-black tabular-nums text-[#5F624F]">
                                  {cat.count} / {cat.question_count}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Edit / Add form */}
            {showForm && (
              <form id="event-form" action={handleSubmit} className="animate-in fade-in duration-200">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2">
                {/* Title */}
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    name="title"
                    required
                    placeholder="e.g. Music Bingo"
                    defaultValue={formDefault?.title ?? ""}
                    className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                  />
                </div>

                {/* Event Type */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                    Event Type <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <select
                      title="Event Type"
                      name="event_types_id"
                      required
                      defaultValue={formDefault?.event_types_id ?? eventTypes[0]?.id ?? ""}
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-black tracking-widest outline-none focus:border-[#26300D] appearance-none"
                    >
                      {eventTypes.map((et) => (
                        <option key={et.id} value={et.id}>{eventTypeLabel(et)}</option>
                      ))}
                    </select>
                    
                  </div>
                  </div>
                  
                {/* Start + End time */}
                  <div className="flex gap-2">
                     {/* Date */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                    Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    name="date"
                    type="date"
                    required
                    defaultValue={formDefault?.date ?? ""}
                    className="h-14 w-2/3 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-black focus:border-[#26300D] transition-all"
                  />
                </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Start</Label>
                    <Input
                      name="start_time"
                      type="time"
                      defaultValue={formDefault?.start_time ? formatTime(formDefault.start_time) : ""}
                      className="h-14 w-36 rounded-2xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-black focus:border-[#26300D] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">End</Label>
                    <Input
                      name="end_time"
                      type="time"
                      defaultValue={formDefault?.end_time ? formatTime(formDefault.end_time) : ""}
                      className="h-14 w-36 rounded-2xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-black focus:border-[#26300D] transition-all"
                    />
                  </div>
                </div>

                {/* Host */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Host</Label>
                  <div className="relative">
                    <select
                      title="Host"
                      name="host_employee_id"
                      defaultValue={formDefault?.host_employee_id ?? ""}
                      className="w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-black tracking-widest outline-none focus:border-[#26300D] appearance-none"
                    >
                      <option value="">No host</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.full_name}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F]/30 rotate-90 pointer-events-none" />
                  </div>
                </div>

                {/* Payment Amount */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                    Payment per Person (£)
                  </Label>
                  <div className="flex items-center h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white focus-within:border-[#26300D] transition-all overflow-hidden">
                    <div className="flex items-center justify-center px-4 h-full border-r-2 border-[#E6DFC8] shrink-0">
                      <BadgePoundSterling className="w-4 h-4 text-[#5F624F]" />
                    </div>
                    <input
                      name="payment_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      defaultValue={formDefault?.payment_amount ?? ""}
                      className="flex-1 h-full px-3 text-sm font-bold bg-transparent outline-none text-[#1F1F1A] placeholder:text-[#5F624F]/40"
                    />
                  </div>
                </div>

                {/* Seating Required */}
                <div className="flex items-center justify-between h-14 bg-white rounded-2xl border-2 border-[#E6DFC8] px-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-[#5F624F]" />
                    <Label className="text-sm font-black text-[#1F1F1A] cursor-pointer" htmlFor="seating_required">
                      Seating Required
                    </Label>
                  </div>
                  <input
                    title="Seating Required"
                    id="seating_required"
                    name="seating_required"
                    type="checkbox"
                    defaultChecked={formDefault?.seating_required ?? true}
                    className="w-5 h-5 rounded accent-[#26300D] cursor-pointer"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Description</Label>
                  <textarea
                    name="description"
                    placeholder="Brief description of the event..."
                    rows={3}
                    defaultValue={formDefault?.description ?? ""}
                    className="w-full rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 py-3.5 text-sm font-bold text-[#1F1F1A] placeholder:text-[#5F624F]/40 focus:border-[#26300D] outline-none transition-all resize-none"
                  />
                </div>

                  {formError && <ErrorBox message={formError} />}
                  </div>
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
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-widest text-[10px] bg-white hover:bg-red-50 hover:border-red-200"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
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
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-widest text-[10px] bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="event-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  {isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Save className="w-4 h-4 mr-2" />Save</>}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
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
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
          {label}
        </span>
      </div>
      <span className="text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug">
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
