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
  Clock,
  Flame,
  ArrowDownUp,
} from "lucide-react";
import { saveEventAction, deleteEventAction } from "./actions";
import { DatePicker, type DateRange } from "./month-picker";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { badgeClassFromColor, swatchHexFromColor } from "@/lib/event-type-colors";
import { buildAdminBookingGroups } from "@/lib/admin-booking-groups";
import { validateEventForm } from "@/lib/event-form-validation";
import { BookingConfigEditor } from "@/components/booking-config-editor";
import { IconPicker } from "@/components/icon-picker";
import type { BookingConfig } from "@/lib/booking-config";
import type { EventBehavior } from "@/lib/event-behavior";

export type { BookingConfig };

export type EventType = {
  id: number;
  name: string;
  color: string | null;
  booking_grouping: string | null;
  is_bookable: boolean | null;
  booking_config: BookingConfig | null;
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
  booking_config: BookingConfig | null;
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
  booking_card_title: string | null;
  booking_card_tagline: string | null;
  booking_card_icon: string | null;
  booking_card_badge: string | null;
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}
function dayNumOf(dateStr: string) {
  return parseDate(dateStr).getDate();
}
function weekdayOf(dateStr: string) {
  return WEEKDAYS[parseDate(dateStr).getDay()];
}
function monthAbbrOf(dateStr: string) {
  return MONTHS_ABBR[parseDate(dateStr).getMonth()];
}
function relativeDayOf(dateStr: string, todayStr: string) {
  const diff = Math.round((parseDate(dateStr).getTime() - parseDate(todayStr).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return WEEKDAYS_LONG[parseDate(dateStr).getDay()];
  return `${weekdayOf(dateStr)} ${dayNumOf(dateStr)} ${monthAbbrOf(dateStr)}`;
}

function shortHost(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0].length > 6 ? parts[0].slice(0, 6) : parts[0];
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0]}.` : first;
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
  const [catFilter, setCatFilter] = useState<number | "all">("all");
  const [sortSoon, setSortSoon] = useState(true);
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const mm = String(m + 1).padStart(2, "0");
    return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
  });
  const [formBookingId, setFormBookingId] = useState<string>("");
  const [formGroupName, setFormGroupName] = useState<string>("");
  const [formIsBookable, setFormIsBookable] = useState(false);
  const [formBookingConfig, setFormBookingConfig] = useState<BookingConfig>({});
  // Booking-card branding (shown only for per_event categories when bookable)
  const [formCardTitle, setFormCardTitle] = useState("");
  const [formCardTagline, setFormCardTagline] = useState("");
  const [formCardIcon, setFormCardIcon] = useState<string | null>(null);
  const [formCardBadge, setFormCardBadge] = useState("");
  // Controlled form fields (so subtype selection can prefill them)
  const [formTypeId, setFormTypeId] = useState<string>("");
  const [formSubtypeId, setFormSubtypeId] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formTagline, setFormTagline] = useState<string>("");
  const [formPayment, setFormPayment] = useState<string>("");
  const [formSeating, setFormSeating] = useState<boolean>(true);
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formFullyBooked, setFormFullyBooked] = useState<boolean>(false);
  const [formDetailsOpen, setFormDetailsOpen] = useState(true);
  const [formSettingsOpen, setFormSettingsOpen] = useState(true);
  const [formBookingSettingsOpen, setFormBookingSettingsOpen] = useState(true);
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

  const toggleQuickFilter = (key: string) =>
    setQuickFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });

  const isSearching = searchQuery.trim() !== "";
  const isSheetOpen = !!selected || isAdding;

  const applySubtypeDefaults = (sub: EventSubtype | undefined, type?: EventType) => {
    setFormTitle(sub?.default_event_title ?? "");
    setFormTagline(sub?.tagline ?? "");
    setFormPayment(sub?.default_payment_amount != null ? String(sub.default_payment_amount) : "");
    setFormSeating(sub?.seating_required ?? true);
    // is_bookable / booking_config are inherited from whichever level owns the
    // booking page for this category's grouping: the type (per_type) or the
    // sub-type (per_subtype). per_event events own their own config, so they
    // start blank and are filled in on the event itself.
    const owner = type ?? (sub ? typeById.get(sub.event_types_id) : undefined);
    if (owner?.booking_grouping === "per_type") {
      setFormIsBookable(owner.is_bookable ?? false);
      setFormBookingConfig(owner.booking_config ?? {});
    } else if (owner?.booking_grouping === "per_subtype") {
      setFormIsBookable(sub?.is_bookable ?? false);
      setFormBookingConfig(sub?.booking_config ?? {});
    } else {
      setFormIsBookable(false);
      setFormBookingConfig({});
    }
  };

  const openView = (event: EventRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(event);
    // Reflect the open event in the URL so navigating away (e.g. "View All") and
    // pressing Back returns here with this sheet reopened in view mode.
    window.history.replaceState(null, "", `/event-setups/events?open=${event.id}`);
  };

  const openAdd = (subtypeId?: number) => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    const sub = subtypeId ? subtypeById.get(subtypeId) : undefined;
    const ownerType = sub ? typeById.get(sub.event_types_id) : (eventTypes[0] ? typeById.get(eventTypes[0].id) : undefined);
    setFormTypeId(sub ? String(sub.event_types_id) : (eventTypes[0]?.id ? String(eventTypes[0].id) : ""));
    setFormSubtypeId(sub ? String(sub.id) : "");
    setFormBookingId("");
    setFormGroupName("");
    setFormCardTitle("");
    setFormCardTagline("");
    setFormCardIcon(null);
    setFormCardBadge("");
    setFormActive(true);
    setFormFullyBooked(false);
    setFormDetailsOpen(true);
    setFormSettingsOpen(true);
    applySubtypeDefaults(sub, ownerType);
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
    setFormActive(selected.is_active ?? true);
    setFormFullyBooked(selected.is_fully_booked ?? false);
    setFormDetailsOpen(true);
    setFormSettingsOpen(true);
    setFormBookingId(selected.booking_id ? String(selected.booking_id) : "");
    setFormGroupName(selected.group_name ?? "");
    setFormIsBookable(!!selected.is_bookable);
    setFormBookingConfig(selected.booking_config ?? {});
    setFormCardTitle(selected.booking_card_title ?? "");
    setFormCardTagline(selected.booking_card_tagline ?? "");
    setFormCardIcon(selected.booking_card_icon ?? null);
    setFormCardBadge(selected.booking_card_badge ?? "");
    setIsEditing(true);
  };

  const onSelectType = (typeId: string) => {
    setFormTypeId(typeId);
    const subs = subtypesByType.get(Number(typeId)) ?? [];
    const first = subs[0];
    setFormSubtypeId(first ? String(first.id) : "");
    applySubtypeDefaults(first, typeById.get(Number(typeId)));
  };

  const onSelectSubtype = (subtypeId: string) => {
    setFormSubtypeId(subtypeId);
    const sub = subtypeById.get(Number(subtypeId));
    if (sub) setFormTypeId(String(sub.event_types_id));
    applySubtypeDefaults(sub, sub ? typeById.get(sub.event_types_id) : undefined);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
    // Drop the ?open marker so a closed sheet isn't restored on Back/refresh.
    window.history.replaceState(null, "", "/event-setups/events");
  };

  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    // Required fields live inside the collapsible "Details" section, so validate
    // here rather than relying on native `required` (which can't focus a field in
    // a collapsed/hidden section). Validation logic is shared with the server
    // action via the pure helper in @/lib/event-form-validation.
    const date = formData.get("date")?.toString() ?? "";
    const validation = validateEventForm(
      {
        eventTypesId: formData.get("event_types_id") ? Number(formData.get("event_types_id")) : null,
        eventSubtypesId: formData.get("event_subtypes_id") ? Number(formData.get("event_subtypes_id")) : null,
        title: formData.get("title")?.toString() ?? "",
        date,
        startTime: formData.get("start_time")?.toString() ?? "",
        endTime: formData.get("end_time")?.toString() ?? "",
      },
      initialEvents,
      formDefault?.id ?? null
    );
    if (!validation.ok) {
      setFormDetailsOpen(true);
      if (validation.code === "missing_fields") {
        setFormError("Fill in event type, sub-type, title, date, start time and end time.");
      } else if (validation.code === "end_before_start") {
        setFormError("End time must be after the start time.");
      } else {
        const c = validation.clash;
        setFormError(`Clashes with an active event on ${formatDate(date)}: ${c.title} (${c.start}${c.end ? ` - ${c.end}` : ""}).`);
      }
      return;
    }

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
    if (dateRange?.start) {
      if (!e.date) return false;
      if (dateRange.end && dateRange.end !== dateRange.start) {
        if (e.date < dateRange.start || e.date > dateRange.end) return false;
      } else if (e.date !== dateRange.start) {
        return false;
      }
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

  // --- Flat, filterable, date-sorted list ---
  const baseEvents = filter === "quiz-incomplete" && quizIncompleteBase ? quizIncompleteBase : initialEvents;

  const needsQuiz = (e: EventRecord) => {
    const sub = subtypeById.get(e.event_subtypes_id);
    if (sub?.behavior !== "quiz") return false;
    const { total, target } = getQuizStatus(e.id, quizCategories, quizQuestions);
    return total < target;
  };

  const QUICK_FILTERS: { key: string; label: string; test: (e: EventRecord) => boolean }[] = [
    { key: "bookings", label: "Has bookings", test: (e) => getBookingStats(e.id, bookings).confirmedPeople > 0 },
    { key: "quiz", label: "Needs quiz", test: needsQuiz },
    { key: "active", label: "Active only", test: (e) => e.is_active !== false },
  ];

  const passesQuick = (e: EventRecord) =>
    [...quickFilters].every((k) => QUICK_FILTERS.find((q) => q.key === k)!.test(e));

  // Category chips reflect search + month + quick filters (but not the chosen category).
  const chipBase = baseEvents.filter((e) => matchesFilters(e) && passesQuick(e));
  const typeCounts = new Map<number, number>();
  for (const e of chipBase) typeCounts.set(e.event_types_id, (typeCounts.get(e.event_types_id) ?? 0) + 1);
  const chipTypes = [...eventTypes]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ type: t, count: typeCounts.get(t.id) ?? 0 }));

  const visibleEvents = baseEvents
    .filter((e) => matchesFilters(e) && passesQuick(e) && (catFilter === "all" || e.event_types_id === catFilter))
    .sort((a, b) => {
      const cmp = (a.date ?? "").localeCompare(b.date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? "");
      return sortSoon ? cmp : -cmp;
    });

  const anyFilterActive = isSearching || catFilter !== "all" || quickFilters.size > 0;
  const clearAllFilters = () => { setCatFilter("all"); setQuickFilters(new Set()); setSearchQuery(""); };

  // Group the (already date-sorted) list into day buckets for sticky day headers.
  const dayGroups: { date: string; events: EventRecord[] }[] = [];
  for (const e of visibleEvents) {
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === e.date) last.events.push(e);
    else dayGroups.push({ date: e.date, events: [e] });
  }

  const renderEventRow = (event: EventRecord) => {
    const sub = subtypeById.get(event.event_subtypes_id);
    const type = typeById.get(event.event_types_id);
    const colorKey = sub?.color ?? type?.color ?? null;
    const accentHex = swatchHexFromColor(colorKey) ?? "#5C4033";
    const badgeClass = badgeClassFromColor(colorKey);
    const host = employees.find((emp) => emp.id === event.host_employee_id);
    const isQuiz = sub?.behavior === "quiz";
    const quizStat = isQuiz ? getQuizStatus(event.id, quizCategories, quizQuestions) : null;
    const bStats = getBookingStats(event.id, bookings);
    const inactive = event.is_active === false;
    const hasPricing = !!event.payment_amount && event.payment_amount > 0;
    const isTonight = event.date === todayStr && !inactive;

    return (
      <button
        key={event.id}
        type="button"
        onClick={() => openView(event)}
        style={{ "--spine": accentHex } as React.CSSProperties}
        className={cn(
          "relative w-full text-left flex items-center gap-3 pl-4 pr-3 py-3 bg-white border rounded-2xl transition active:scale-[0.99] hover:shadow-md",
          isTonight ? "border-[#FF6B35] ring-1 ring-[#FF6B35]/40" : "border-[#E6DFC8]",
          inactive && "opacity-60"
        )}
      >
        {/* colour spine */}
        <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-(--spine)" />

        {isTonight && (
          <span className="absolute -top-2 left-3 z-1 inline-flex items-center gap-1 h-4.75 px-2 rounded-full bg-[#FF6B35] text-white text-[9px] font-black uppercase tracking-wide shadow">
            <Flame className="w-2.5 h-2.5" /> Tonight
          </span>
        )}

        {/* date badge */}
        <div className={cn("w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border", badgeClass)}>
          <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{monthAbbrOf(event.date)}</span>
          <span className="text-base font-black leading-none">{dayNumOf(event.date)}</span>
        </div>

        {/* middle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {sub && <span className={cn("text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded", badgeClass)}>{toTitleCase(sub.name)}</span>}
            {inactive && <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Inactive</span>}
            {quizStat && !quizStat.allComplete && (
              <span className="inline-flex items-center gap-0.5">
                <span className="text-[9px] font-black text-[#5F624F]">Qz</span>
                {quizStat.someExist
                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
              </span>
            )}
          </div>
          <p className={cn("text-sm font-black leading-tight truncate", inactive ? "text-[#5F624F]" : "text-[#1F1F1A]")}>
            {event.title || "Untitled Event"}
          </p>
          <div className="flex items-center gap-2.5 mt-1 text-[11px] text-[#5F624F] font-semibold flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(event.start_time)}{event.end_time ? `–${formatTime(event.end_time)}` : ""}
            </span>
            {host && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4.25 h-4.25 rounded-full text-white text-[8.5px] font-black inline-grid place-items-center bg-(--spine)">
                  {host.full_name[0]}
                </span>
                {shortHost(host.full_name)}
              </span>
            )}
          </div>
          {event.tagline && <p className="text-[11px] italic text-[#a39d86] truncate mt-1">{event.tagline}</p>}
        </div>

        {/* right */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {(event.is_bookable || bStats.confirmedPeople > 0) && (
            <span className="inline-flex items-center gap-1 text-xs font-black text-[#5F624F] tabular-nums">
              <Users className="w-3.5 h-3.5" />{bStats.confirmedPeople}
            </span>
          )}
          {hasPricing && <span className="text-[11px] font-black text-green-700">£{event.payment_amount!.toFixed(2)}</span>}
          {event.is_fully_booked && <span className="text-[9px] font-black uppercase tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Full</span>}
          <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40" />
        </div>
      </button>
    );
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;
  const selectedSubtype = subtypeById.get(Number(formSubtypeId));
  const selectedTypeForForm = typeById.get(Number(formTypeId));
  const formSubtypeOptions = subtypesByType.get(Number(formTypeId)) ?? [];

  return (
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl bg-[#F7F4EA]">

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

      {/* Header bar: search + date + compact New */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 h-11 px-3 flex-1 min-w-0 rounded-xl border border-[#E6DFC8] bg-white focus-within:border-[#5C4033] transition-colors">
          <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
          <input
            type="text"
            placeholder="Search title, date or host..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
          />
          {isSearching && (
            <button type="button" onClick={() => setSearchQuery("")} className="shrink-0 -mr-1 p-1 rounded-md hover:bg-[#E6DFC8] transition-colors" title="Clear search">
              <X className="w-3.5 h-3.5 text-[#5F624F]/50" />
            </button>
          )}
        </div>
        <DatePicker value={dateRange} onChange={setDateRange} />
        <button
          type="button"
          onClick={() => openAdd()}
          title="New Event"
          className="h-11 w-11 sm:w-auto sm:px-4 rounded-xl bg-[#5C4033] text-white hover:bg-[#5C4033]/85 transition-colors flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline text-[11px] font-black uppercase tracking-wide">New</span>
        </button>
      </div>

      {/* Filter bar: category chips + sort / quick filters */}
      <div className="pt-1 pb-1 space-y-2">
        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCatFilter("all")}
            className={cn(
              "shrink-0 h-7 px-3 rounded-full border text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 transition-colors",
              catFilter === "all" ? "bg-[#5C4033] text-white border-[#5C4033]" : "bg-white text-[#5F624F] border-[#E6DFC8]"
            )}
          >
            All <span className="opacity-70">{chipBase.length}</span>
          </button>
          {chipTypes.map(({ type, count }) => {
            const sel = catFilter === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setCatFilter(sel ? "all" : type.id)}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-full border text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 transition-colors",
                  sel ? "bg-[#5C4033] text-white border-[#5C4033]" : cn(badgeClassFromColor(type.color), "rounded-full")
                )}
              >
                {toTitleCase(type.name)} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Sort + quick filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setSortSoon((s) => !s)}
            className="shrink-0 h-7 px-2.5 rounded-lg border border-[#E6DFC8] bg-[#EFE8D4] text-[#5C4033] text-[9px] font-black uppercase tracking-wide inline-flex items-center gap-1.5"
          >
            <ArrowDownUp className="w-3 h-3" /> {sortSoon ? "Soonest" : "Latest"}
          </button>
          <span className="shrink-0 w-px h-4 bg-[#E6DFC8]" />
          {QUICK_FILTERS.map((q) => {
            const on = quickFilters.has(q.key);
            return (
              <button
                key={q.key}
                type="button"
                onClick={() => toggleQuickFilter(q.key)}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-full border text-[9px] font-black uppercase tracking-wide transition-colors",
                  on ? "bg-[#5C4033] text-white border-[#5C4033]" : "bg-white text-[#5F624F] border-[#E6DFC8]"
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result line */}
      {anyFilterActive && (
        <div className="flex items-center gap-1.5 px-1 text-xs text-[#5F624F] font-semibold">
          <b className="font-black text-[#1F1F1A] text-[13px]">{visibleEvents.length}</b>
          event{visibleEvents.length === 1 ? "" : "s"}
          {catFilter !== "all" && (
            <> in <span className="font-black text-[#5C4033]">{toTitleCase(typeById.get(catFilter)?.name)}</span></>
          )}
          <button type="button" onClick={clearAllFilters} className="ml-auto font-black text-[10px] uppercase tracking-wide text-[#5C4033] underline">
            Clear all
          </button>
        </div>
      )}

      {/* Flat event list */}
      {visibleEvents.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <CalendarDays className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">
            {filter === "quiz-incomplete" ? "No upcoming quizzes with incomplete questions" : "Nothing matches"}
          </p>
          <p className="text-[11px] text-[#5F624F] mt-1">
            {filter === "quiz-incomplete"
              ? "All quiz questions are complete"
              : anyFilterActive ? "No events with these filters" : "No events for the selected dates"}
          </p>
          {anyFilterActive && filter !== "quiz-incomplete" && (
            <button type="button" onClick={clearAllFilters} className="mt-3 text-[11px] font-black uppercase tracking-wide text-[#5C4033] underline">
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {dayGroups.map((group) => (
            <section key={group.date} className="space-y-1.5">
              {/* Sticky day separator */}
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-[#F7F4EA] py-1.5">
                <span className="text-[11px] font-black uppercase tracking-wide text-[#5C4033]">{relativeDayOf(group.date, todayStr)}</span>
                <span className="flex-1 h-px bg-[#E6DFC8]" />
                <span className="text-[10px] font-bold text-[#5F624F]">{weekdayOf(group.date)} {dayNumOf(group.date)} {monthAbbrOf(group.date)}</span>
              </div>
              {group.events.map((event) => renderEventRow(event))}
            </section>
          ))}
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
              // "View All" target: collapse this event the same way the nav/hub do
              // (honouring the category's booking_grouping), then drill into this
              // specific event via ?eventId for the grouped (general) routes.
              const viewAllGroup = buildAdminBookingGroups([{
                id: selected.id,
                title: selected.title,
                date: selected.date,
                event_types: type ? { name: type.name, color: type.color, booking_grouping: type.booking_grouping } : null,
                event_subtypes: sub ? { name: sub.name, color: sub.color } : null,
              }])[0];
              const baseViewAllHref = viewAllGroup
                ? (viewAllGroup.href.startsWith("/event-bookings/general/")
                    ? `${viewAllGroup.href}?eventId=${selected.id}`
                    : viewAllGroup.href)
                : `/event-bookings/event/${selected.id}`;
              // Carry the return target so the bookings page's Back button comes
              // back here with this event's sheet reopened in view mode.
              const returnHref = `/event-setups/events?open=${selected.id}`;
              const viewAllHref = `${baseViewAllHref}${baseViewAllHref.includes("?") ? "&" : "?"}from=${encodeURIComponent(returnHref)}`;
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
                        {(sub?.seating_required || selected.seating_required) && <DetailCell label="Seating" toggle={!!selected.seating_required} />}
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
                        <DetailCell label="Fully Booked" toggle={!!selected.is_fully_booked} />
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
                          <Link href={viewAllHref} className="w-full h-9 rounded-xl bg-[#5C4033] flex items-center justify-center text-white hover:bg-[#5C4033]/85 transition-colors gap-1.5">
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
                        <DetailCell label="Public Booking" toggle={!!selected.is_bookable} />

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

                        {/* Booking page config — shown whenever the event is bookable. */}
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
                {/* Boolean fields live in the collapsible Settings section; keep their
                    hidden inputs at the form root so they submit even when collapsed. */}
                <input type="hidden" name="seating_required" value={formSeating ? "on" : ""} />
                <input type="hidden" name="is_active" value={formActive ? "on" : ""} />
                <input type="hidden" name="is_fully_booked" value={formFullyBooked ? "on" : ""} />
                <input type="hidden" name="is_bookable" value={formIsBookable ? "on" : ""} />

                <FormSection title="Details" open={formDetailsOpen} onToggle={() => setFormDetailsOpen((o) => !o)}>
                  {/* Event Type */}
                  <FormRow label="Event Type" required>
                    <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                      <select
                        title="Event Type"
                        name="event_types_id"
                        value={formTypeId}
                        onChange={(e) => onSelectType(e.target.value)}
                        className="min-w-0 text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none appearance-none cursor-pointer text-right [text-align-last:right]"
                      >
                        {eventTypes.map((t) => (
                          <option key={t.id} value={t.id}>{toTitleCase(t.name)}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] shrink-0 pointer-events-none" />
                    </div>
                  </FormRow>

                  {/* Sub-Type */}
                  <FormRow label="Sub-Type" required>
                    <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                      <select
                        title="Sub-Type"
                        name="event_subtypes_id"
                        value={formSubtypeId}
                        onChange={(e) => onSelectSubtype(e.target.value)}
                        className="min-w-0 text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none appearance-none cursor-pointer text-right [text-align-last:right]"
                      >
                        <option value="" disabled>Select a sub-type...</option>
                        {formSubtypeOptions.map((s) => (
                          <option key={s.id} value={s.id}>{toTitleCase(s.name)}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] shrink-0 pointer-events-none" />
                    </div>
                  </FormRow>

                  {/* Title */}
                  <FormRow label="Title" required>
                    <input
                      name="title"
                      placeholder="e.g. Music Bingo"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  {/* Date */}
                  <FormRow label="Date" required>
                    <input title="Date" name="date" type="date" defaultValue={formDefault?.date ?? ""} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none" />
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
                      <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                        <select title="Host" name="host_employee_id" defaultValue={formDefault?.host_employee_id ?? ""} className="min-w-0 text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none appearance-none cursor-pointer text-right [text-align-last:right]">
                          <option value="">No host</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>{e.full_name}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] shrink-0 pointer-events-none" />
                      </div>
                    </FormRow>
                  )}

                  {/* Payment */}
                  <FormRow label="Payment (£)">
                    <input name="payment_amount" type="number" min="0" step="0.01" placeholder="0.00" value={formPayment} onChange={(e) => setFormPayment(e.target.value)} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                  </FormRow>

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

                </FormSection>

                <FormSection title="Settings" open={formSettingsOpen} onToggle={() => setFormSettingsOpen((o) => !o)}>
                  <FormRow label="Seating">
                    <span className="flex-1" />
                    <FormToggle label="Seating" on={formSeating} onToggle={() => setFormSeating((o) => !o)} />
                  </FormRow>
                  <FormRow label="Active">
                    <span className="flex-1" />
                    <FormToggle label="Active" on={formActive} onToggle={() => setFormActive((o) => !o)} />
                  </FormRow>
                </FormSection>

                <FormSection title="Public Booking Settings" open={formBookingSettingsOpen} onToggle={() => setFormBookingSettingsOpen((o) => !o)}>
                  <FormRow label="Public Booking">
                    <span className="flex-1" />
                    <FormToggle label="Public booking" on={formIsBookable} onToggle={() => setFormIsBookable((o) => !o)} />
                  </FormRow>

                  {/* fully booked, booking_url, linked booking & group name only apply to a publicly bookable event. */}
                  {formIsBookable && (
                    <>
                      <FormRow label="Fully Booked">
                        <span className="flex-1" />
                        <FormToggle label="Fully booked" on={formFullyBooked} onToggle={() => setFormFullyBooked((o) => !o)} danger />
                      </FormRow>

                      {/* Booking URL — optional manual override. Left blank, the URL is
                          auto-generated from the category's booking grouping on save. */}
                      <FormRow label="Booking URL">
                        <input name="booking_page_url" type="url" placeholder="Auto-generated on save" defaultValue="" className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                      </FormRow>

                      {/* Linked Booking & Group Name (games only) */}
                      {selectedTypeForForm?.name === "games" && (() => {
                        const eventBookings = formDefault ? bookings.filter(b => b.event_id === formDefault.id && b.status !== "cancelled") : [];
                        return (
                          <>
                            <FormRow label="Linked Booking">
                              <input type="hidden" name="booking_id" value={formBookingId} />
                              <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
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
                                  className="min-w-0 text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none appearance-none cursor-pointer text-right [text-align-last:right]"
                                >
                                  <option value="">No booking</option>
                                  {eventBookings.map(b => (
                                    <option key={b.id} value={b.id}>#{b.id} — {b.group_name || "Unnamed"}</option>
                                  ))}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] shrink-0 pointer-events-none" />
                              </div>
                            </FormRow>
                            <FormRow label="Group Name">
                              <input type="hidden" name="group_name" value={formGroupName} />
                              <input value={formGroupName} onChange={(e) => setFormGroupName(e.target.value)} placeholder="e.g. The Brainiacs" className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                            </FormRow>
                          </>
                        );
                      })()}
                    </>
                  )}
                </FormSection>

                {/* Booking page/form config — editable whenever the event is bookable.
                    Saved onto this event's own booking_config regardless of grouping. */}
                {formIsBookable && (
                  <>
                    <input type="hidden" name="booking_config" value={JSON.stringify(formBookingConfig)} />
                    <BookingConfigEditor value={formBookingConfig} onChange={setFormBookingConfig} />
                  </>
                )}

                {/* Booking card branding — only when this category owns the card (per_event) and it's bookable. */}
                {formIsBookable && selectedTypeForForm?.booking_grouping === "per_event" && (
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                    <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60">
                      <span className="text-[11px] font-black uppercase tracking-wide text-[#26300D]">Booking Card</span>
                    </div>
                    <div className="px-4 sm:px-5 pt-2.5">
                      <p className="text-[10px] text-[#5F624F] leading-relaxed">Shown on the public booking hub card. Blank fields fall back to the title, a calendar icon, and the auto badge.</p>
                    </div>
                    <FormRow label="Card Title">
                      <input name="booking_card_title" placeholder="e.g. Music Bingo" value={formCardTitle} onChange={(e) => setFormCardTitle(e.target.value)} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                    </FormRow>
                    <div className="px-4 sm:px-5 py-2.5 sm:py-4">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wide">Card Tagline</span>
                      </div>
                      <textarea name="booking_card_tagline" placeholder="Short line shown under the title..." rows={2} value={formCardTagline} onChange={(e) => setFormCardTagline(e.target.value)} className="w-full text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none placeholder:text-[#5F624F]/40 resize-none" />
                    </div>
                    <FormRow label="Card Badge">
                      <input name="booking_card_badge" placeholder="e.g. Thursdays, Book Now" value={formCardBadge} onChange={(e) => setFormCardBadge(e.target.value)} className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                    </FormRow>
                    <input type="hidden" name="booking_card_icon" value={formCardIcon ?? ""} />
                    <IconPicker label="Card Icon" value={formCardIcon} onChange={setFormCardIcon} />
                  </div>
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

function DetailCell({ label, value, icon, toggle, accent }: { label: string; value?: string; icon?: React.ReactNode; toggle?: boolean; accent?: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      {toggle !== undefined ? (
        <span className="flex-1 flex justify-end">
          <ToggleSlider on={toggle} />
        </span>
      ) : (
        <span className={cn("text-xs sm:text-sm font-black text-right flex-1 leading-snug", accent ?? "text-[#1F1F1A]")}>{value}</span>
      )}
    </div>
  );
}

/** Read-only iOS-style toggle for displaying boolean fields in the detail sheet. */
function ToggleSlider({ on, danger }: { on: boolean; danger?: boolean }) {
  return (
    <span
      role="img"
      aria-label={on ? "On" : "Off"}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors shrink-0",
        on ? (danger ? "bg-red-600" : "bg-green-600") : "bg-[#5F624F]/25"
      )}
    >
      <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", on ? "translate-x-4.5" : "translate-x-0.5")} />
    </span>
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

/** Collapsible section wrapper for the edit/new form. Body stays mounted (hidden
 * when collapsed) so field values — including uncontrolled inputs — survive a
 * collapse and remain submittable. */
function FormSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left">
        <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">{title}</span>
        <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div className={cn("divide-y divide-[#E6DFC8]/50", !open && "hidden")}>{children}</div>
    </div>
  );
}

/** Interactive iOS-style toggle for the edit/new form. */
function FormToggle({ on, onToggle, danger, label }: { on: boolean; onToggle: () => void; danger?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors shrink-0 border",
        on ? (danger ? "bg-red-600 border-red-700" : "bg-green-500 border-green-600") : "bg-[#5F624F]/20 border-[#5F624F]/30"
      )}
    >
      <span className={cn("absolute top-1/2 left-0 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow transition-transform", on ? "translate-x-5.25" : "translate-x-0.5")} />
    </button>
  );
}
