"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  CalendarDays,
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
  Brain,
  Link2,
  Copy,
  Check,
  Search,
  X,
} from "lucide-react";
import { saveEventAction, deleteEventAction } from "./actions";
import { MonthPicker } from "./month-picker";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { badgeClassFromColor } from "@/lib/event-type-colors";
import { BookingConfigEditor } from "@/components/booking-config-editor";
import type { BookingConfig } from "@/lib/booking-config";
import type { EventBehavior } from "@/lib/event-behavior";

export type { BookingConfig };

export type EventType = {
  id: number;
  name: string;
  color: string | null;
};

export type EventSubtype = {
  id: number;
  event_types_id: number;
  name: string;
  color: string | null;
  default_event_title: string | null;
  tagline: string | null;
  behavior: EventBehavior;
  host_required: boolean;
  seating_required: boolean;
  is_bookable: boolean;
  payment_required: boolean;
  default_payment_amount: number | null;
  default_booking_config: BookingConfig | null;
};

export type EventRecord = {
  id: number;
  created_at?: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  tagline: string | null;
  seating_required: boolean | null;
  payment_amount: number | null;
  host_employee_id: number | null;
  event_types_id: number;
  event_subtypes_id: number;
  is_active: boolean | null;
  is_fully_booked: boolean | null;
  group_name: string | null;
  booking_id: number | null;
  external_link: string | null;
  karaoke_request_url: string | null;
  is_bookable: boolean | null;
  booking_page_url: string | null;
  booking_config: BookingConfig | null;
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
  eventSubtypes = [],
  employees = [],
  quizCategories = [],
  quizQuestions = [],
  bookings = [],
  filter,
}: {
  initialEvents: EventRecord[];
  eventTypes: EventType[];
  eventSubtypes: EventSubtype[];
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
  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());
  const [expandedSubTypes, setExpandedSubTypes] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [formBookingId, setFormBookingId] = useState<string>("");
  const [formGroupName, setFormGroupName] = useState<string>("");
  const [formIsBookable, setFormIsBookable] = useState(false);
  const [formBookingConfig, setFormBookingConfig] = useState<BookingConfig>({});
  // Controlled form fields (so subtype selection can prefill them)
  const [formTypeId, setFormTypeId] = useState<string>("");
  const [formSubtypeId, setFormSubtypeId] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formTagline, setFormTagline] = useState<string>("");
  const [formPayment, setFormPayment] = useState<string>("");
  const [formSeating, setFormSeating] = useState<boolean>(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [quizOpen, setQuizOpen] = useState(true);
  const [bookingsOpen, setBookingsOpen] = useState(true);
  const [bookingSettingsOpen, setBookingSettingsOpen] = useState(false);
  const [bookingPageOpen, setBookingPageOpen] = useState(false);

  // ---- Lookups ----
  const typeById = new Map(eventTypes.map((t) => [t.id, t]));
  const subtypeById = new Map(eventSubtypes.map((s) => [s.id, s]));
  const subtypesByType = new Map<number, EventSubtype[]>();
  for (const s of eventSubtypes) {
    if (!subtypesByType.has(s.event_types_id)) subtypesByType.set(s.event_types_id, []);
    subtypesByType.get(s.event_types_id)!.push(s);
  }

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
    window.history.replaceState(null, "", "/event-setups/events");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const toggleType = (id: number) =>
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const toggleSubType = (id: number) =>
    setExpandedSubTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const isSearching = searchQuery.trim() !== "";
  const forceOpen = isSearching;
  const isSheetOpen = !!selected || isAdding;

  const applySubtypeDefaults = (sub: EventSubtype | undefined) => {
    setFormTitle(sub?.default_event_title ?? "");
    setFormTagline(sub?.tagline ?? "");
    setFormPayment(sub?.default_payment_amount != null ? String(sub.default_payment_amount) : "");
    setFormSeating(sub?.seating_required ?? true);
    setFormIsBookable(sub?.is_bookable ?? false);
    setFormBookingConfig(sub?.default_booking_config ?? {});
  };

  const openView = (event: EventRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(event);
  };

  const openAdd = (subtypeId?: number) => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    const sub = subtypeId ? subtypeById.get(subtypeId) : undefined;
    setFormTypeId(sub ? String(sub.event_types_id) : (eventTypes[0]?.id ? String(eventTypes[0].id) : ""));
    setFormSubtypeId(sub ? String(sub.id) : "");
    setFormBookingId("");
    setFormGroupName("");
    applySubtypeDefaults(sub);
    setIsAdding(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setFormError(null);
    setFormTypeId(String(selected.event_types_id));
    setFormSubtypeId(String(selected.event_subtypes_id));
    setFormTitle(selected.title ?? "");
    setFormTagline(selected.tagline ?? "");
    setFormPayment(selected.payment_amount != null ? String(selected.payment_amount) : "");
    setFormSeating(selected.seating_required ?? true);
    setFormBookingId(selected.booking_id ? String(selected.booking_id) : "");
    setFormGroupName(selected.group_name ?? "");
    setFormIsBookable(!!selected.is_bookable);
    setFormBookingConfig(selected.booking_config ?? {});
    setIsEditing(true);
  };

  const onSelectType = (typeId: string) => {
    setFormTypeId(typeId);
    const subs = subtypesByType.get(Number(typeId)) ?? [];
    const first = subs[0];
    setFormSubtypeId(first ? String(first.id) : "");
    applySubtypeDefaults(first);
  };

  const onSelectSubtype = (subtypeId: string) => {
    setFormSubtypeId(subtypeId);
    const sub = subtypeById.get(Number(subtypeId));
    if (sub) setFormTypeId(String(sub.event_types_id));
    applySubtypeDefaults(sub);
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

  // --- Filtering ---
  const todayStr = new Date().toISOString().split("T")[0];
  const hostById = new Map(employees.map((e) => [e.id, e.full_name]));

  const matchesFilters = (e: EventRecord) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const host = e.host_employee_id ? (hostById.get(e.host_employee_id) ?? "") : "";
      const hay = `${e.title ?? ""} ${formatDate(e.date)} ${e.date ?? ""} ${host}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filterMonth && e.date) {
      const eventMonth = e.date.slice(0, 7);
      if (eventMonth !== filterMonth) return false;
    }
    return true;
  };

  const quizIncompleteBase = filter === "quiz-incomplete"
    ? initialEvents.filter((e) => {
        const sub = subtypeById.get(e.event_subtypes_id);
        if (sub?.behavior !== "quiz") return false;
        if (!e.date || e.date < todayStr) return false;
        const { total, target } = getQuizStatus(e.id, quizCategories, quizQuestions);
        return total < target;
      })
    : null;

  // --- Two-level grouping: type -> subtype ---
  type SubGroup = { subtype: EventSubtype; events: EventRecord[] };
  type TypeGroup = { type: EventType; subGroups: SubGroup[]; count: number };

  const typeGroupMap = new Map<number, TypeGroup>();
  for (const t of [...eventTypes].sort((a, b) => a.name.localeCompare(b.name))) {
    typeGroupMap.set(t.id, { type: t, subGroups: [], count: 0 });
  }

  for (const sub of [...eventSubtypes].sort((a, b) => a.name.localeCompare(b.name))) {
    const base = filter === "quiz-incomplete" && quizIncompleteBase ? quizIncompleteBase : initialEvents;
    const events = base
      .filter((e) => e.event_subtypes_id === sub.id && matchesFilters(e))
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    const tg = typeGroupMap.get(sub.event_types_id);
    if (!tg) continue;
    if (!isSearching || events.length > 0) {
      tg.subGroups.push({ subtype: sub, events });
      tg.count += events.length;
    }
  }

  const typeGroups = Array.from(typeGroupMap.values()).filter((tg) => !isSearching || tg.count > 0);

  const knownSubtypeIds = new Set(eventSubtypes.map((s) => s.id));
  const ungrouped = initialEvents.filter(matchesFilters).filter((e) => !knownSubtypeIds.has(e.event_subtypes_id));

  const visibleEvents = typeGroups.flatMap((tg) => tg.subGroups.flatMap((sg) => sg.events)).concat(ungrouped);

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;
  const selectedSubtype = subtypeById.get(Number(formSubtypeId));
  const selectedTypeForForm = typeById.get(Number(formTypeId));
  const formSubtypeOptions = subtypesByType.get(Number(formTypeId)) ?? [];

  return (
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">

      {/* Filter notice */}
      {filter === "quiz-incomplete" && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
            Upcoming quizzes with incomplete questions
          </p>
          <Link href="/event-setups/events" className="text-[11px] font-black uppercase tracking-wide text-amber-700 underline shrink-0">
            Clear
          </Link>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white border border-[#E6DFC8] rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
        <button
          type="button"
          onClick={() => openAdd()}
          className="h-11 px-4 rounded-xl bg-[#5C4033] text-white hover:bg-[#5C4033]/85 transition-colors flex items-center justify-center gap-1.5 shrink-0 sm:order-last"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wide">New Event</span>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 h-11 px-3 flex-1 min-w-0 rounded-xl border border-[#E6DFC8] focus-within:border-[#5C4033] transition-colors">
            <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
            <input
              type="text"
              placeholder="Search title, date or host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
            />
          </div>
          <MonthPicker value={filterMonth} onChange={setFilterMonth} />
          {isSearching && (
            <button type="button" onClick={() => setSearchQuery("")} className="shrink-0 p-2 rounded-lg hover:bg-[#E6DFC8] transition-colors" title="Clear search">
              <X className="w-4 h-4 text-[#5F624F]/50" />
            </button>
          )}
        </div>
      </div>

      {/* Event List */}
      {visibleEvents.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <CalendarDays className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">
            {filter === "quiz-incomplete" ? "No upcoming quizzes with incomplete questions" : "No events found"}
          </p>
          <p className="text-[11px] text-[#5F624F] mt-1">
            {filter === "quiz-incomplete"
              ? "All quiz questions are complete"
              : isSearching ? "Try adjusting your search" : "No events in this month"}
          </p>
          {isSearching && (
            <button type="button" onClick={() => setSearchQuery("")} className="mt-3 text-[11px] font-black uppercase tracking-wide text-[#5C4033] underline">
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {typeGroups.map((tg) => {
            const typeOpen = expandedTypes.has(tg.type.id) || forceOpen;
            const subGroupsToShow = tg.subGroups.filter((sg) => sg.events.length > 0);
            if (isSearching && subGroupsToShow.length === 0) return null;
            return (
              <section key={tg.type.id} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleType(tg.type.id)}
                  className="w-full flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3.5 gap-2.5 min-h-11"
                >
                  <span className="text-sm font-black uppercase tracking-tight text-[#5C4033] truncate flex-1 text-left">
                    {toTitleCase(tg.type.name)} <span className="text-[#5F624F] text-xs font-bold">({tg.count})</span>
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200 shrink-0", typeOpen && "rotate-180")} />
                </button>

                {typeOpen && (
                  <div className="px-3 sm:px-4 py-3 space-y-3">
                    {subGroupsToShow.map((sg) => {
                      const subOpen = expandedSubTypes.has(sg.subtype.id) || forceOpen;
                      const color = sg.subtype.color;
                      return (
                        <div key={sg.subtype.id} className={cn(
                          "rounded-xl border overflow-hidden",
                          badgeClassFromColor(color).split(" ").filter((c) => c.startsWith("border")).join(" ")
                        )}>
                          <div className={cn("flex items-center gap-2 px-3 sm:px-4 py-2 min-h-10", badgeClassFromColor(color))}>
                            <button type="button" onClick={() => toggleSubType(sg.subtype.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                              <span className="text-[11px] font-black uppercase tracking-wide">{toTitleCase(sg.subtype.name)}</span>
                              <span className="text-[10px] font-bold opacity-60">({sg.events.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openAdd(sg.subtype.id)}
                              className="w-7 h-7 rounded-lg bg-[#5C4033] text-white hover:bg-[#5C4033]/85 transition-colors flex items-center justify-center shrink-0"
                              title={`Create ${toTitleCase(tg.type.name)} - ${toTitleCase(sg.subtype.name)} event`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => toggleSubType(sg.subtype.id)} className="shrink-0" aria-label={subOpen ? "Collapse events" : "Expand events"}>
                              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", subOpen && "rotate-180")} />
                            </button>
                          </div>

                          {subOpen && (
                            <div className={cn("divide-y", (() => {
                              const borderColor = badgeClassFromColor(color).split(" ").find((c) => c.startsWith("border-") && c !== "border") ?? "";
                              return borderColor.replace("border-", "divide-");
                            })())}>
                              {sg.events.map((event) => {
                                const hasPricing = !!event.payment_amount && event.payment_amount > 0;
                                const host = employees.find((emp) => emp.id === event.host_employee_id);
                                const isQuiz = sg.subtype.behavior === "quiz";
                                const quizStat = isQuiz ? getQuizStatus(event.id, quizCategories, quizQuestions) : null;
                                const bStats = getBookingStats(event.id, bookings);
                                const inactive = event.is_active === false;
                                const dateObj = new Date(event.date + "T00:00:00");
                                const monthAbbr = dateObj.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
                                const dayNum = dateObj.getDate();

                                return (
                                  <div
                                    key={event.id}
                                    onClick={() => openView(event)}
                                    className={cn("px-3 sm:px-4 py-3 flex items-center gap-2.5 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]", inactive && "opacity-60")}
                                  >
                                    <div className={cn("w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border", badgeClassFromColor(color))}>
                                      <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{monthAbbr}</span>
                                      <span className="text-sm font-black leading-none">{dayNum}</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className={cn("text-sm font-black leading-snug truncate flex-1 min-w-0", inactive ? "text-[#5F624F]" : "text-[#1F1F1A]")}>
                                          {event.title || "Untitled Event"}
                                        </p>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {(bStats.confirmedPeople > 0 || event.is_bookable) && (
                                            <span className="text-[10px] font-black text-[#5F624F] flex items-center gap-0.5 tabular-nums">
                                              <Users className="w-3 h-3" />{bStats.confirmedPeople}
                                            </span>
                                          )}
                                          {event.is_fully_booked && <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Full</span>}
                                          {inactive && <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" title="Inactive" />}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <p className="text-[11px] text-[#5F624F] truncate flex-1 min-w-0">
                                          {formatTime(event.start_time)}
                                          {event.end_time ? ` → ${formatTime(event.end_time)}` : ""}
                                          {(event.start_time || event.end_time) && host ? " · " : ""}
                                          {host ? (() => { const parts = host.full_name.split(" "); const first = parts[0].length > 4 ? parts[0].slice(0, 4) : parts[0]; return parts.length > 1 ? `${first} ${parts[parts.length - 1][0]}.` : first; })() : ""}
                                        </p>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {quizStat ? (
                                            <span className="flex items-center gap-0.5">
                                              <span className="text-[10px] font-black text-[#5F624F]">Qz:</span>
                                              {quizStat.allComplete
                                                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                : quizStat.someExist
                                                  ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                  : <AlertCircle className="w-4 h-4 text-red-500" />}
                                            </span>
                                          ) : hasPricing ? (
                                            <span className="text-[10px] font-black text-green-700">£{event.payment_amount!.toFixed(2)}</span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>

                                    <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {ungrouped.length > 0 && (
            <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#F7F4EA]">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#5C4033]">Other</p>
                <span className="text-[10px] font-black text-[#5F624F] bg-white border border-[#E6DFC8] px-2.5 py-1 rounded-lg tabular-nums">{ungrouped.length}</span>
              </div>
              <div className="divide-y divide-[#E6DFC8]/50">
                {ungrouped.map((event) => (
                  <div key={event.id} onClick={() => openView(event)} className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]">
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
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-140
            sm:h-auto sm:max-h-[80vh] sm:rounded-4xl sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                  {isAdding ? "New Event" : isEditing ? "Edit Event" : (() => {
                    const sub = selected ? subtypeById.get(selected.event_subtypes_id) : null;
                    const subType = toTitleCase(sub?.name);
                    return subType ? `${subType} Event` : "View Event";
                  })()}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {isAdding ? "Create a new event." : isEditing ? "Edit this event's details." : "View this event's details."}
                </SheetDescription>
                {selected && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-xs font-black text-[#5F624F] uppercase tracking-wide tabular-nums">ID: {selected.id}</span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <span className={cn(
                  "shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full border",
                  selected.is_active !== false ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-600 border-red-300"
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
              const sub = subtypeById.get(selected.event_subtypes_id);
              const type = typeById.get(selected.event_types_id);
              const hasPricing = !!selected.payment_amount && selected.payment_amount > 0;
              const host = employees.find((e) => e.id === selected.host_employee_id);
              const isQuiz = sub?.behavior === "quiz";
              const bk = getBookingStats(selected.id, bookings);
              return (
                <div className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <button type="button" onClick={() => setDetailsOpen(o => !o)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left">
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Event Details</span>
                      <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", detailsOpen && "rotate-180")} />
                    </button>
                    {detailsOpen && (
                      <>
                        <DetailCell label="Title" value={selected?.title || "Untitled Event"} />
                        <DetailCell label="Date" value={formatDate(selected.date)} />
                        <DetailCell label="Time" value={selected.start_time || selected.end_time ? `${formatTime(selected.start_time)} - ${formatTime(selected.end_time)}` : "—"} />
                        {(sub?.host_required || selected.host_employee_id != null) && <DetailCell label="Host" value={host?.full_name ?? "—"} />}
                        {(sub?.payment_required || hasPricing) && (
                          <DetailCell label="Payment" value={hasPricing ? `£${selected.payment_amount!.toFixed(2)} / person` : "Free"} />
                        )}
                        {(sub?.seating_required || selected.seating_required) && <DetailCell label="Seating Required" value={selected.seating_required ? "Yes" : "No"} />}
                        {selected.tagline && <DetailCell label="Tagline" value={selected.tagline} />}
                        {selected.external_link && <DetailCell label="External Link" value={selected.external_link} />}
                        {sub?.behavior === "karaoke" && selected.karaoke_request_url && <DetailCell label="Karaoke Request URL" value={selected.karaoke_request_url} />}
                      </>
                    )}
                  </div>

                  {isQuiz && (() => {
                    const { categoryCounts } = getQuizStatus(selected.id, quizCategories, quizQuestions);
                    return (
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                        <button type="button" onClick={() => setQuizOpen(o => !o)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left">
                          <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Quiz Questions</span>
                          <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", quizOpen && "rotate-180")} />
                        </button>
                        {quizOpen && (
                          <>
                            <div className="px-4 sm:px-5 py-2.5 space-y-2">
                              {categoryCounts.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between gap-2">
                                  <span className="text-xs sm:text-sm font-bold text-[#1F1F1A]">{cat.category_name}</span>
                                  <div className="flex items-center gap-1.5">
                                    {cat.count >= cat.question_count ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : cat.count > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                                    <span className="text-xs sm:text-sm font-black tabular-nums text-[#5F624F]">{cat.count} / {cat.question_count}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="px-4 sm:px-5 py-2.5 border-t border-[#E6DFC8]">
                              <Link href={`/event-setups/events/${selected.id}`} className="w-full h-9 rounded-xl bg-[#5C4033] flex items-center justify-center text-white hover:bg-[#5C4033]/85 transition-colors gap-1.5" title="Manage Quiz">
                                <Brain className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-wide">Manage Quiz</span>
                              </Link>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {selected.is_bookable && <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <button type="button" onClick={() => setBookingsOpen(o => !o)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left">
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Bookings</span>
                      <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", bookingsOpen && "rotate-180")} />
                    </button>
                    {bookingsOpen && (
                      <>
                        <DetailCell label="Fully Booked" value={selected.is_fully_booked ? "Yes" : "No"} />
                        {type?.name === "games" && (
                          <DetailCell label="Winning Team" value={selected.booking_id ? `#${selected.booking_id}: ${selected.group_name || "Unnamed"}` : "—"} />
                        )}
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
                        <div className="px-4 sm:px-5 py-2.5 border-t border-[#E6DFC8]">
                          <Link href={`/event-bookings/event/${selected.id}`} className="w-full h-9 rounded-xl bg-[#5C4033] flex items-center justify-center text-white hover:bg-[#5C4033]/85 transition-colors gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-wide">View All</span>
                          </Link>
                        </div>
                      </>
                    )}
                  </div>}

                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <button type="button" onClick={() => setBookingSettingsOpen(o => !o)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left">
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Public Booking Settings</span>
                      <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", bookingSettingsOpen && "rotate-180")} />
                    </button>
                    {bookingSettingsOpen && (
                      <>
                        <DetailCell label="Public Booking" value={selected.is_bookable ? "Enabled" : "Disabled"} />

                        {selected.is_bookable && (
                          <div className="px-4 sm:px-5 py-3 border-t border-[#E6DFC8]">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Link2 className="w-3.5 h-3.5 text-[#5F624F]" />
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]">Shareable Booking Link</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-[11px] font-bold text-[#26300D] bg-[#F7F4EA] border border-[#E6DFC8] rounded-lg px-3 py-2 flex-1 truncate">
                                {selected.booking_page_url ?? (typeof window !== "undefined" ? `${window.location.origin}/book/event/${selected.id}` : `/book/event/${selected.id}`)}
                              </code>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                                const url = selected.booking_page_url ?? `${window.location.origin}/book/event/${selected.id}`;
                                navigator.clipboard.writeText(url);
                                setLinkCopied(true);
                                setTimeout(() => setLinkCopied(false), 2000);
                              }}>
                                {linkCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[#5F624F]" />}
                              </Button>
                            </div>
                          </div>
                        )}

                        {selected.is_bookable && (
                          <div className="border-t border-[#E6DFC8]">
                            <button type="button" onClick={() => setBookingPageOpen(o => !o)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#E6DFC8]/60 hover:bg-[#E6DFC8]/80 transition-colors text-left">
                              <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Booking Page</span>
                              <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", bookingPageOpen && "rotate-180")} />
                            </button>
                            {bookingPageOpen && (
                              <div className="p-3 sm:p-4 bg-[#F7F4EA]/40">
                                <BookingConfigEditor value={selected.booking_config ?? {}} readOnly />
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
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
                  {/* Event Type */}
                  <FormRow label="Event Type" required>
                    <select
                      title="Event Type"
                      name="event_types_id"
                      required
                      value={formTypeId}
                      onChange={(e) => onSelectType(e.target.value)}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
                    >
                      {eventTypes.map((t) => (
                        <option key={t.id} value={t.id} className="dir-ltr">{toTitleCase(t.name)}</option>
                      ))}
                    </select>
                  </FormRow>

                  {/* Sub-Type */}
                  <FormRow label="Sub-Type" required>
                    <select
                      title="Sub-Type"
                      name="event_subtypes_id"
                      required
                      value={formSubtypeId}
                      onChange={(e) => onSelectSubtype(e.target.value)}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
                    >
                      <option value="" disabled className="dir-ltr">Select a sub-type...</option>
                      {formSubtypeOptions.map((s) => (
                        <option key={s.id} value={s.id} className="dir-ltr">{toTitleCase(s.name)}</option>
                      ))}
                    </select>
                  </FormRow>

                  {/* Title */}
                  <FormRow label="Title" required>
                    <input
                      name="title"
                      required
                      placeholder="e.g. Music Bingo"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  {/* Date */}
                  <FormRow label="Date" required>
                    <input title="Date" name="date" type="date" required defaultValue={formDefault?.date ?? ""} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none" />
                  </FormRow>

                  {/* Time */}
                  <FormRow label="Time">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <input title="Start time" name="start_time" type="time" defaultValue={formDefault?.start_time ? formatTime(formDefault.start_time) : ""} className="text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none w-22 text-right" />
                      <span className="text-[#5F624F]/50 text-xs">-</span>
                      <input title="End time" name="end_time" type="time" defaultValue={formDefault?.end_time ? formatTime(formDefault.end_time) : ""} className="text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none w-22 text-right" />
                    </div>
                  </FormRow>

                  {/* Host — only when subtype requires a host */}
                  {selectedSubtype?.host_required && (
                    <FormRow label="Host">
                      <select title="Host" name="host_employee_id" defaultValue={formDefault?.host_employee_id ?? ""} className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl">
                        <option value="" className="dir-ltr">No host</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id} className="dir-ltr">{e.full_name}</option>
                        ))}
                      </select>
                    </FormRow>
                  )}

                  {/* Payment */}
                  <FormRow label="Payment (£)">
                    <input name="payment_amount" type="number" min="0" step="0.01" placeholder="0.00" value={formPayment} onChange={(e) => setFormPayment(e.target.value)} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                  </FormRow>

                  {/* Seating */}
                  <FormRow label="Seating Required">
                    <span className="flex-1" />
                    <input title="Seating Required" id="seating_required" name="seating_required" type="checkbox" checked={formSeating} onChange={(e) => setFormSeating(e.target.checked)} className="w-5 h-5 rounded accent-[#5C4033] cursor-pointer" />
                  </FormRow>

                  {/* Active */}
                  <FormRow label="Active">
                    <span className="flex-1" />
                    <input title="Active" id="is_active" name="is_active" type="checkbox" defaultChecked={formDefault?.is_active ?? true} className="w-5 h-5 rounded accent-[#5C4033] cursor-pointer" />
                  </FormRow>

                  {/* Fully Booked */}
                  <FormRow label="Fully Booked">
                    <span className="flex-1" />
                    <input title="Fully Booked" id="is_fully_booked" name="is_fully_booked" type="checkbox" defaultChecked={formDefault?.is_fully_booked ?? false} className="w-5 h-5 rounded accent-red-600 cursor-pointer" />
                  </FormRow>

                  {/* Group Name & Booking (games only) */}
                  {selectedTypeForForm?.name === "games" && (() => {
                    const eventBookings = formDefault ? bookings.filter(b => b.event_id === formDefault.id && b.status !== "cancelled") : [];
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
                              <option key={b.id} value={b.id} className="dir-ltr">#{b.id} — {b.group_name || "Unnamed"}</option>
                            ))}
                          </select>
                        </FormRow>
                        <FormRow label="Group Name">
                          <input type="hidden" name="group_name" value={formGroupName} />
                          <input value={formGroupName} onChange={(e) => setFormGroupName(e.target.value)} placeholder="e.g. The Brainiacs" className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                        </FormRow>
                      </>
                    );
                  })()}

                  {/* Tagline */}
                  <div className="px-4 sm:px-5 py-2.5 sm:py-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wide">Tagline</span>
                    </div>
                    <textarea name="tagline" placeholder="Brief tagline for the event..." rows={2} value={formTagline} onChange={(e) => setFormTagline(e.target.value)} className="w-full text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none placeholder:text-[#5F624F]/40 resize-none" />
                  </div>

                  {/* External Link */}
                  <FormRow label="External Link">
                    <input name="external_link" type="url" placeholder="https://instagram.com/..." defaultValue={formDefault?.external_link ?? ""} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                  </FormRow>

                  {/* Karaoke Song Request Link — only when subtype is karaoke */}
                  {selectedSubtype?.behavior === "karaoke" && (
                    <FormRow label="Singa Link">
                      <input name="karaoke_request_url" type="url" placeholder="https://app.singa.com/..." defaultValue={formDefault?.karaoke_request_url ?? ""} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                    </FormRow>
                  )}

                  {/* Booking URL */}
                  <FormRow label="Booking URL">
                    <input name="booking_page_url" type="url" placeholder="Auto-generated on save" defaultValue={formDefault?.booking_page_url ?? ""} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                  </FormRow>
                </div>

                {/* Public Booking enable + config */}
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#26300D]">Public Booking</span>
                  </div>
                  <FormRow label="Enable Booking Page">
                    <input type="hidden" name="is_bookable" value={formIsBookable ? "on" : ""} />
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black uppercase tracking-wide", formIsBookable ? "text-green-600" : "text-[#5F624F]")}>{formIsBookable ? "On" : "Off"}</span>
                      <button type="button" title="Toggle public booking" onClick={() => setFormIsBookable(!formIsBookable)} className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0 border", formIsBookable ? "bg-green-500 border-green-600" : "bg-[#5F624F]/20 border-[#5F624F]/30")}>
                        <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", formIsBookable ? "translate-x-5.25" : "translate-x-0.5")} />
                      </button>
                    </div>
                  </FormRow>
                </div>

                {formIsBookable && (
                  <>
                    <input type="hidden" name="booking_config" value={JSON.stringify(formBookingConfig)} />
                    <BookingConfigEditor value={formBookingConfig} onChange={setFormBookingConfig} />
                  </>
                )}

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-4xl">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="ghost" onClick={handleDelete} disabled={isPending} className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-wide text-[10px] bg-white hover:bg-red-50 hover:border-red-200">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete
                </Button>
                <Button onClick={openEdit} className="h-14 flex-1 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95">
                  <Pencil className="w-4 h-4 mr-2" />Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" onClick={() => { setFormError(null); if (isAdding) closeSheet(); else setIsEditing(false); }} disabled={isPending} className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white">
                  Cancel
                </Button>
                <Button type="button" disabled={isPending} onClick={() => { const form = document.getElementById('event-form') as HTMLFormElement | null; if (form) form.requestSubmit(); }} className="h-14 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save</>}
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

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
        {required && <span className="text-red-500 text-[10px] font-black">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      <span className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug">{value}</span>
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
