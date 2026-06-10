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
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { badgeClassFromColor } from "@/lib/event-type-colors";

export type EventType = {
  id: number;
  type: string;
  sub_type: string | null;
  badge_color: string | null;
  type_color: string | null;
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
  karaoke_request_url: string | null;
  is_bookable: boolean | null;
  booking_page_url: string | null;
  booking_config: BookingConfig | null;
};

export type BookingConfig = {
  collect_group_name?: boolean;
  group_name_label?: string;
  collect_phone?: boolean;
  collect_group_size?: boolean;
  collect_special_requests?: boolean;
  min_group_size?: number;
  max_group_size?: number;
  group_size_options?: number[];
  custom_cta_text?: string;
  custom_tagline?: string;
  confirmation_message?: string;
  booking_image_url?: string | null;
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
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedSubTypes, setExpandedSubTypes] = useState<Set<string>>(new Set());
  const [addForTypeId, setAddForTypeId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [formBookingId, setFormBookingId] = useState<string>("");
  const [formGroupName, setFormGroupName] = useState<string>("");
  const [formIsBookable, setFormIsBookable] = useState(false);
  const [formBookingConfig, setFormBookingConfig] = useState<BookingConfig>({});
  const [linkCopied, setLinkCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [quizOpen, setQuizOpen] = useState(true);
  const [bookingsOpen, setBookingsOpen] = useState(true);
  const [bookingSettingsOpen, setBookingSettingsOpen] = useState(false);
  const [bookingCustomOpen, setBookingCustomOpen] = useState(false);
  const [pageFieldsOpen, setPageFieldsOpen] = useState(true);
  const [pageCustomOpen, setPageCustomOpen] = useState(true);

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

  const toggleType = (type: string) =>
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) { next.delete(type); } else { next.add(type); }
      return next;
    });

  const toggleSubType = (key: string) =>
    setExpandedSubTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });

  const isSearching = searchQuery.trim() !== "";
  const forceOpen = isSearching;

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
    setFormIsBookable(false);
    setFormBookingConfig({});
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
      const eventMonth = e.date.slice(0, 7); // "YYYY-MM"
      if (eventMonth !== filterMonth) return false;
    }
    return true;
  };

  // Quiz-incomplete filter mode
  const quizIncompleteBase = filter === "quiz-incomplete"
    ? initialEvents.filter((e) => {
        const et = eventTypes.find((t) => t.id === e.event_types_id);
        if (!et?.sub_type?.toLowerCase().includes("quiz")) return false;
        if (!e.date || e.date < todayStr) return false;
        const { total, target } = getQuizStatus(e.id, quizCategories, quizQuestions);
        return total < target;
      })
    : null;

  // --- Two-level grouping ---
  type SubGroup = { eventType: EventType; key: string; events: EventRecord[] };
  type TypeGroup = { type: string; subGroups: SubGroup[]; count: number };

  const typeGroupMap = new Map<string, TypeGroup>();

  for (const et of eventTypes) {
    let source: EventRecord[];
    if (filter === "quiz-incomplete" && quizIncompleteBase) {
      source = quizIncompleteBase.filter((e) => e.event_types_id === et.id && matchesFilters(e));
    } else {
      source = initialEvents.filter((e) => e.event_types_id === et.id && matchesFilters(e));
    }
    source.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    const key = `${et.type}::${et.sub_type ?? ""}`;
    const sub: SubGroup = { eventType: et, key, events: source };

    const typeKey = et.type.toLowerCase();
    if (!typeGroupMap.has(typeKey)) {
      typeGroupMap.set(typeKey, { type: et.type, subGroups: [], count: 0 });
    }
    const tg = typeGroupMap.get(typeKey)!;
    // When searching, only include sub-groups with matches
    if (!isSearching || sub.events.length > 0) {
      tg.subGroups.push(sub);
      tg.count += sub.events.length;
    }
  }

  // Remove empty type groups when searching
  const typeGroups = Array.from(typeGroupMap.values()).filter((tg) => !isSearching || tg.count > 0);

  const knownTypeIds = new Set(eventTypes.map((et) => et.id));
  const ungroupedSource = initialEvents.filter(matchesFilters);
  const ungrouped = ungroupedSource.filter((e) => !knownTypeIds.has(e.event_types_id));

  const visibleEvents = typeGroups.flatMap((tg) => tg.subGroups.flatMap((sg) => sg.events)).concat(ungrouped);

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

      {/* Header bar — search + date range + New Event */}
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
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            title="Filter by month"
            className="h-11 w-[9rem] px-2 rounded-xl border border-[#E6DFC8] focus:border-[#5C4033] text-xs font-bold text-[#1F1F1A] bg-transparent outline-none transition-colors shrink-0"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="shrink-0 p-2 rounded-lg hover:bg-[#E6DFC8] transition-colors"
              title="Clear search"
            >
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
            {filter === "quiz-incomplete"
              ? "No upcoming quizzes with incomplete questions"
              : "No events found"}
          </p>
          <p className="text-[11px] text-[#5F624F] mt-1">
            {filter === "quiz-incomplete"
              ? "All quiz questions are complete"
              : isSearching
                ? "Try adjusting your search"
                : "No events in this month"}
          </p>
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-3 text-[11px] font-black uppercase tracking-wide text-[#5C4033] underline"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {typeGroups.map((tg) => {
            const typeOpen = expandedTypes.has(tg.type.toLowerCase()) || forceOpen;
            return (
              <section key={tg.type} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
                {/* Type header */}
                <button
                  type="button"
                  onClick={() => toggleType(tg.type.toLowerCase())}
                  className="w-full flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3.5 gap-2.5 min-h-[44px]"
                >
                  <span className="text-sm font-black uppercase tracking-tight text-[#5C4033] truncate flex-1 text-left">
                    {toTitleCase(tg.type)} <span className="text-[#5F624F] text-xs font-bold">({tg.count})</span>
                  </span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-[#5F624F] transition-transform duration-200 shrink-0",
                    typeOpen && "rotate-180"
                  )} />
                </button>

                {/* Sub-type sections */}
                {typeOpen && (
                  <div className="px-3 sm:px-4 py-3 space-y-3">
                    {tg.subGroups.filter((sg) => sg.events.length > 0).map((sg) => {
                      const subKey = sg.key;
                      const subOpen = expandedSubTypes.has(subKey) || forceOpen;
                      return (
                        <div key={sg.eventType.id} className={cn(
                          "rounded-xl border overflow-hidden",
                          badgeClassFromColor(sg.eventType.badge_color).split(" ").filter((c) => c.startsWith("border")).join(" ")
                        )}>
                          {/* Sub-type header */}
                          <div className={cn(
                            "flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[40px]",
                            badgeClassFromColor(sg.eventType.badge_color)
                          )}>
                            <button
                              type="button"
                              onClick={() => toggleSubType(subKey)}
                              className="flex-1 min-w-0 flex items-center gap-2 text-left"
                            >
                              <span className="text-[11px] font-black uppercase tracking-wide">
                                {toTitleCase(sg.eventType.sub_type)}
                              </span>
                              <span className="text-[10px] font-bold opacity-60">
                                ({sg.events.length})
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openAdd(sg.eventType.id)}
                              className="w-7 h-7 rounded-lg bg-[#5C4033] text-white hover:bg-[#5C4033]/85 transition-colors flex items-center justify-center shrink-0"
                              title={`Create ${eventTypeLabel(sg.eventType)} event`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSubType(subKey)}
                              className="shrink-0"
                              aria-label={subOpen ? "Collapse events" : "Expand events"}
                            >
                              <ChevronDown className={cn(
                                "w-3.5 h-3.5 transition-transform duration-200",
                                subOpen && "rotate-180"
                              )} />
                            </button>
                          </div>

                          {/* Event rows */}
                          {subOpen && (
                            <div className={cn(
                              "divide-y",
                              (() => {
                                const borderColor = badgeClassFromColor(sg.eventType.badge_color).split(" ").find((c) => c.startsWith("border-") && c !== "border") ?? "";
                                return borderColor.replace("border-", "divide-");
                              })()
                            )}>
                              {sg.events.map((event) => {
                                const hasPricing = !!event.payment_amount && event.payment_amount > 0;
                                const host = employees.find((emp) => emp.id === event.host_employee_id);
                                const hostInitials = host?.full_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2) ?? null;
                                const isQuiz = !!sg.eventType.sub_type?.toLowerCase().includes("quiz");
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
                                    className={cn(
                                      "px-3 sm:px-4 py-3 flex items-center gap-2.5 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]",
                                      inactive && "opacity-60"
                                    )}
                                  >
                                    {/* Date badge */}
                                    <div className={cn(
                                      "w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border",
                                      badgeClassFromColor(sg.eventType.badge_color)
                                    )}>
                                      <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{monthAbbr}</span>
                                      <span className="text-sm font-black leading-none">{dayNum}</span>
                                    </div>

                                    {/* Title + meta */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className={cn("text-sm font-black leading-snug truncate flex-1 min-w-0", inactive ? "text-[#5F624F]" : "text-[#1F1F1A]")}>
                                          {event.title || "Untitled Event"}
                                        </p>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {(bStats.confirmedPeople > 0 || event.is_bookable) && (
                                            <span className="text-[10px] font-black text-[#5F624F] flex items-center gap-0.5 tabular-nums">
                                              <Users className="w-3 h-3" />
                                              {bStats.confirmedPeople}
                                            </span>
                                          )}
                                          {event.is_fully_booked && (
                                            <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Full</span>
                                          )}
                                          {inactive && (
                                            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" title="Inactive" />
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <p className="text-[11px] text-[#5F624F] truncate flex-1 min-w-0">
                                          {formatTime(event.start_time)}
                                          {event.end_time ? ` \u2192 ${formatTime(event.end_time)}` : ""}
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
                                            <span className="text-[10px] font-black text-green-700">
                                              £{event.payment_amount!.toFixed(2)}
                                            </span>
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
                  {isAdding ? "New Event" : isEditing ? "Edit Event" : (() => {
                    const et = selected ? eventTypes.find((e) => e.id === selected.event_types_id) : null;
                    const subType = toTitleCase(et?.sub_type);
                    return subType ? `${subType} Event` : "View Event";
                  })()}
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
                  {/* Event Details — collapsible */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setDetailsOpen(o => !o)}
                      className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Event Details</span>
                      <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", detailsOpen && "rotate-180")} />
                    </button>
                    {detailsOpen && (
                      <>
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
                        <DetailCell label="Seating Required" value={selected.seating_required ? "Yes" : "No"} />
                        {selected.description && (
                          <DetailCell label="Description" value={selected.description} />
                        )}
                        {selected.external_link && (
                          <DetailCell label="External Link" value={selected.external_link} />
                        )}
                        {selected.karaoke_request_url && (
                          <DetailCell label="Karaoke Request URL" value={selected.karaoke_request_url} />
                        )}
                      </>
                    )}
                  </div>

                  {/* Quiz questions — collapsible */}
                  {isQuiz && (() => {
                    const { categoryCounts } = getQuizStatus(selected.id, quizCategories, quizQuestions);
                    return (
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setQuizOpen(o => !o)}
                          className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left"
                        >
                          <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Quiz Questions</span>
                          <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", quizOpen && "rotate-180")} />
                        </button>
                        {quizOpen && (
                          <>
                            <div className="px-4 sm:px-5 py-2.5 space-y-2">
                              {categoryCounts.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between gap-2">
                                  <span className="text-xs sm:text-sm font-bold text-[#1F1F1A]">
                                    {cat.category_name}
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
                            <div className="px-4 sm:px-5 py-2.5 border-t border-[#E6DFC8]">
                              <Link
                                href={`/event-setups/events/${selected.id}`}
                                className="w-full h-9 rounded-xl bg-[#5C4033] flex items-center justify-center text-white hover:bg-[#5C4033]/85 transition-colors gap-1.5"
                                title="Manage Quiz"
                              >
                                <Brain className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-wide">Manage Quiz</span>
                              </Link>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Bookings — collapsible (only when bookable) */}
                  {selected.is_bookable && <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setBookingsOpen(o => !o)}
                      className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Bookings</span>
                      <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", bookingsOpen && "rotate-180")} />
                    </button>
                    {bookingsOpen && (
                      <>
                        <DetailCell label="Fully Booked" value={selected.is_fully_booked ? "Yes" : "No"} />
                        {et?.type === "games" && (
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
                          <Link
                            href={`/event-bookings/event/${selected.id}`}
                            className="w-full h-9 rounded-xl bg-[#5C4033] flex items-center justify-center text-white hover:bg-[#5C4033]/85 transition-colors gap-1.5"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-wide">View All</span>
                          </Link>
                        </div>
                      </>
                    )}
                  </div>}

                  {/* Booking Page Settings — collapsible */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setBookingSettingsOpen(o => !o)}
                      className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Public Booking Settings</span>
                      <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", bookingSettingsOpen && "rotate-180")} />
                    </button>
                    {bookingSettingsOpen && (
                      <>
                        <DetailCell label="Public Booking" value={selected.is_bookable ? "Enabled" : "Disabled"} />

                        {/* Booking Page Customizations — only when bookable and not quiz/bingo */}
                        {selected.is_bookable && !et?.sub_type?.toLowerCase().includes("quiz") && !et?.sub_type?.toLowerCase().includes("bingo") && (() => {
                          const cfg = selected.booking_config ?? {};
                          return (
                            <div className="border-t border-[#E6DFC8]">
                              <button
                                type="button"
                                onClick={() => setBookingCustomOpen(o => !o)}
                                className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#E6DFC8]/60 hover:bg-[#E6DFC8]/80 transition-colors text-left"
                              >
                                <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Booking Page Customizations</span>
                                <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", bookingCustomOpen && "rotate-180")} />
                              </button>
                              {bookingCustomOpen && (
                                <div className="space-y-0">
                                  {/* Page Fields — collapsible */}
                                  <div className="border-t border-[#E6DFC8]">
                                    <button
                                      type="button"
                                      onClick={() => setPageFieldsOpen(o => !o)}
                                      className="w-full flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#F7F4EA]/50 hover:bg-[#F7F4EA] transition-colors text-left"
                                    >
                                      <span className="text-[9px] font-black uppercase tracking-widest text-[#5F624F]">Page Fields</span>
                                      <ChevronDown className={cn("w-3.5 h-3.5 text-[#5F624F] transition-transform duration-200", pageFieldsOpen && "rotate-180")} />
                                    </button>
                                    {pageFieldsOpen && (
                                      <div className="divide-y divide-[#E6DFC8]/50">
                                        {[
                                          { label: "Name", enabled: true, always: true },
                                          { label: "Email", enabled: true, always: true },
                                          { label: "Phone Number", enabled: cfg.collect_phone !== false },
                                          { label: "Group Size", enabled: cfg.collect_group_size !== false },
                                          { label: "Group Name", enabled: !!cfg.collect_group_name },
                                          { label: "Special Requests", enabled: cfg.collect_special_requests !== false },
                                        ].map(field => (
                                          <div key={field.label} className="flex items-center justify-between px-4 sm:px-5 py-2">
                                            <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">{field.label}</span>
                                            {field.always ? (
                                              <span className="text-[10px] font-black uppercase tracking-wide text-green-600">Always On</span>
                                            ) : (
                                              <input type="checkbox" checked={field.enabled} readOnly aria-label={field.label} className="w-4 h-4 rounded accent-[#5C4033] pointer-events-none" />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Page Customizations — collapsible */}
                                  <div className="border-t border-[#E6DFC8]">
                                    <button
                                      type="button"
                                      onClick={() => setPageCustomOpen(o => !o)}
                                      className="w-full flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#F7F4EA]/50 hover:bg-[#F7F4EA] transition-colors text-left"
                                    >
                                      <span className="text-[9px] font-black uppercase tracking-widest text-[#5F624F]">Page Customizations</span>
                                      <ChevronDown className={cn("w-3.5 h-3.5 text-[#5F624F] transition-transform duration-200", pageCustomOpen && "rotate-180")} />
                                    </button>
                                    {pageCustomOpen && (
                                      <div>
                                        {cfg.collect_group_name && (
                                          <DetailCell label="Group Name Label" value={cfg.group_name_label || "—"} />
                                        )}
                                        {cfg.collect_group_size !== false && (
                                          <>
                                            <DetailCell label="Min Group Size" value={cfg.min_group_size != null ? String(cfg.min_group_size) : "—"} />
                                            <DetailCell label="Max Group Size" value={cfg.max_group_size != null ? String(cfg.max_group_size) : "—"} />
                                            <DetailCell label="Size Options" value={cfg.group_size_options?.length ? cfg.group_size_options.join(", ") : "—"} />
                                          </>
                                        )}
                                        <DetailCell label="Button Text" value={cfg.custom_cta_text || "—"} />
                                        <DetailCell label="Tagline" value={cfg.custom_tagline || "—"} />
                                        <DetailCell label="Confirmation Msg" value={cfg.confirmation_message || "—"} />
                                        <DetailCell label="Booking Image" value={cfg.booking_image_url || "—"} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Shareable booking link */}
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                                  const url = selected.booking_page_url ?? `${window.location.origin}/book/event/${selected.id}`;
                                  navigator.clipboard.writeText(url);
                                  setLinkCopied(true);
                                  setTimeout(() => setLinkCopied(false), 2000);
                                }}
                              >
                                {linkCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[#5F624F]" />}
                              </Button>
                            </div>
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

                  {/* Karaoke Song Request Link */}
                  <FormRow label="Singa Link">
                    <input
                      name="karaoke_request_url"
                      type="url"
                      placeholder="https://app.singa.com/..."
                      defaultValue={formDefault?.karaoke_request_url ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  {/* Booking URL (auto-generated on save; override here if needed) */}
                  <FormRow label="Booking URL">
                    <input
                      name="booking_page_url"
                      type="url"
                      placeholder="Auto-generated on save"
                      defaultValue={formDefault?.booking_page_url ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>
                </div>

                {/* Public Booking Config */}
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#26300D]">Public Booking</span>
                  </div>

                  <FormRow label="Enable Booking Page">
                    <input type="hidden" name="is_bookable" value={formIsBookable ? "on" : ""} />
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wide",
                        formIsBookable ? "text-green-600" : "text-[#5F624F]"
                      )}>
                        {formIsBookable ? "On" : "Off"}
                      </span>
                      <button
                        type="button"
                        title="Toggle public booking"
                        onClick={() => setFormIsBookable(!formIsBookable)}
                        className={cn(
                          "w-11 h-6 rounded-full transition-colors relative shrink-0 border",
                          formIsBookable ? "bg-green-500 border-green-600" : "bg-[#5F624F]/20 border-[#5F624F]/30"
                        )}
                      >
                        <span className={cn(
                          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                          formIsBookable ? "translate-x-[21px]" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>
                  </FormRow>

                  {formIsBookable && (
                    <>
                      <input type="hidden" name="booking_config" value={JSON.stringify(formBookingConfig)} />

                      {/* Form Fields Section Header */}
                      <div className="px-4 sm:px-5 py-2 bg-[#F7F4EA]/50">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#5F624F]">Form Fields</span>
                      </div>

                      {/* Always-on fields (not toggleable) */}
                      <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">Name</span>
                        <span className="text-[10px] font-black uppercase tracking-wide text-green-600">Always On</span>
                      </div>
                      <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">Email</span>
                        <span className="text-[10px] font-black uppercase tracking-wide text-green-600">Always On</span>
                      </div>

                      {/* Toggleable fields */}
                      <ToggleRow label="Phone Number" value={formBookingConfig.collect_phone !== false} onChange={v => setFormBookingConfig(c => ({ ...c, collect_phone: v }))} />
                      <ToggleRow label="Group Size" value={formBookingConfig.collect_group_size !== false} onChange={v => setFormBookingConfig(c => ({ ...c, collect_group_size: v }))} />
                      <ToggleRow label="Group Name" value={!!formBookingConfig.collect_group_name} onChange={v => setFormBookingConfig(c => ({ ...c, collect_group_name: v }))} />
                      <ToggleRow label="Special Requests" value={formBookingConfig.collect_special_requests !== false} onChange={v => setFormBookingConfig(c => ({ ...c, collect_special_requests: v }))} />
                    </>
                  )}
                </div>

                {/* Booking Customisation */}
                {formIsBookable && (
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                    <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60">
                      <span className="text-[11px] font-black uppercase tracking-wide text-[#26300D]">Booking Customisation</span>
                    </div>

                    {formBookingConfig.collect_group_name && (
                      <FormRow label="Group Name Label">
                        <input
                          placeholder="e.g. Team Name"
                          value={formBookingConfig.group_name_label ?? ""}
                          onChange={e => setFormBookingConfig(c => ({ ...c, group_name_label: e.target.value }))}
                          className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                        />
                      </FormRow>
                    )}

                    {formBookingConfig.collect_group_size !== false && (
                      <FormRow label="Max Group Size">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          placeholder="e.g. 10"
                          value={formBookingConfig.max_group_size ?? ""}
                          onChange={e => setFormBookingConfig(c => ({ ...c, max_group_size: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                          className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40 w-16"
                        />
                      </FormRow>
                    )}

                    <FormRow label="Button Text">
                      <input
                        placeholder="e.g. Book Now"
                        value={formBookingConfig.custom_cta_text ?? ""}
                        onChange={e => setFormBookingConfig(c => ({ ...c, custom_cta_text: e.target.value }))}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                      />
                    </FormRow>

                    <FormRow label="Tagline">
                      <input
                        placeholder="e.g. Join us for an unforgettable night!"
                        value={formBookingConfig.custom_tagline ?? ""}
                        onChange={e => setFormBookingConfig(c => ({ ...c, custom_tagline: e.target.value }))}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                      />
                    </FormRow>

                    <FormRow label="Confirmation Msg">
                      <input
                        placeholder="e.g. See you there!"
                        value={formBookingConfig.confirmation_message ?? ""}
                        onChange={e => setFormBookingConfig(c => ({ ...c, confirmation_message: e.target.value }))}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                      />
                    </FormRow>

                    <FormRow label="Booking Image URL">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={formBookingConfig.booking_image_url ?? ""}
                        onChange={e => setFormBookingConfig(c => ({ ...c, booking_image_url: e.target.value || null }))}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                      />
                    </FormRow>
                  </div>
                )}

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
                  onClick={() => {
                    setFormError(null);
                    setFormBookingId(selected?.booking_id ? String(selected.booking_id) : "");
                    setFormGroupName(selected?.group_name ?? "");
                    setFormIsBookable(!!selected?.is_bookable);
                    setFormBookingConfig(selected?.booking_config ?? {});
                    setIsEditing(true);
                  }}
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
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const form = document.getElementById('event-form') as HTMLFormElement | null;
                    if (form) form.requestSubmit();
                  }}
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

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-2.5">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] font-black uppercase tracking-wide", value ? "text-green-600" : "text-[#5F624F]")}>
          {value ? "On" : "Off"}
        </span>
        <button
          type="button"
          title={`Toggle ${label}`}
          onClick={() => onChange(!value)}
          className={cn(
            "w-11 h-6 rounded-full transition-colors relative shrink-0 border",
            value ? "bg-green-500 border-green-600" : "bg-[#5F624F]/20 border-[#5F624F]/30"
          )}
        >
          <span className={cn(
            "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            value ? "translate-x-[21px]" : "translate-x-0.5"
          )} />
        </button>
      </div>
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
