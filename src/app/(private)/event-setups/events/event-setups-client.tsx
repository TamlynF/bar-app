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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  List,
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
  Grid2X2,
  SlidersHorizontal,
} from "lucide-react";
import { saveEventAction, deleteEventAction } from "./actions";
import { DatePicker, type DateRange } from "./month-picker";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { badgeClassFromColor, swatchHexFromColor } from "@/lib/event-type-colors";
import { buildAdminBookingGroups } from "@/lib/admin-booking-groups";
import { findActiveEventClashes, isOvernightEnd } from "@/lib/event-form-validation";
import { parseTimeToMinutes, addHoursToTime } from "@/lib/event-clash";
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
  // List (flat, date-grouped) vs calendar (month grid). The month grid drives its
  // own navigation via calendarMonth and ignores the header's date-range filter.
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  // Category / sort / quick filters are collapsed behind the Filters button; the
  // search bar stays visible. Hidden by default.
  const [showFilters, setShowFilters] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
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
  const [formDate, setFormDate] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formHostId, setFormHostId] = useState<string>("");
  const [formTagline, setFormTagline] = useState<string>("");
  const [formPayment, setFormPayment] = useState<string>("");
  const [formBookingPageUrl, setFormBookingPageUrl] = useState<string>("");
  // True once the admin manually edits the booking URL. While false, the field is
  // kept in sync with the Public Booking toggle (auto-filled on / cleared off) and
  // is submitted blank so the server generates the canonical URL with the real id.
  const [bookingUrlManual, setBookingUrlManual] = useState(false);
  const [formKaraokeUrl, setFormKaraokeUrl] = useState<string>("");
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

  // Preview of the public booking URL for the current form context. The server
  // regenerates the canonical URL (with the real event id) on save; this value is
  // only shown in the field and only persisted if the admin manually edits it.
  const bookingUrlFor = (opts: { typeId: number; subtypeId: number; grouping: string | null | undefined; eventId: number | null }): string => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    const q = opts.eventId ? `?id=${opts.eventId}` : "";
    if (opts.grouping === "per_type") return `${origin}/book/group/type/${opts.typeId}${q}`;
    if (opts.grouping === "per_subtype" && opts.subtypeId) return `${origin}/book/group/subtype/${opts.subtypeId}${q}`;
    return `${origin}/book/event/${opts.eventId ?? ""}`;
  };

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
    let bookable = false;
    if (owner?.booking_grouping === "per_type") {
      bookable = owner.is_bookable ?? false;
      setFormBookingConfig(owner.booking_config ?? {});
    } else if (owner?.booking_grouping === "per_subtype") {
      bookable = sub?.is_bookable ?? false;
      setFormBookingConfig(sub?.booking_config ?? {});
    } else {
      setFormBookingConfig({});
    }
    setFormIsBookable(bookable);
    // Keep the booking URL in step with the toggle unless the admin has typed one.
    if (!bookingUrlManual) {
      const eventId = isEditing ? (selected?.id ?? null) : null;
      setFormBookingPageUrl(bookable ? bookingUrlFor({ typeId: owner?.id ?? 0, subtypeId: sub?.id ?? 0, grouping: owner?.booking_grouping, eventId }) : "");
    }
  };

  // Toggle handler for Public Booking: mirrors the on/off state into the URL field
  // (auto-fill / clear) while the admin hasn't manually overridden it.
  const toggleBookable = () => {
    setFormIsBookable((prev) => {
      const next = !prev;
      if (!bookingUrlManual) {
        const typeId = Number(formTypeId) || 0;
        const grouping = typeById.get(typeId)?.booking_grouping;
        const eventId = isEditing ? (selected?.id ?? null) : null;
        setFormBookingPageUrl(next ? bookingUrlFor({ typeId, subtypeId: Number(formSubtypeId) || 0, grouping, eventId }) : "");
      }
      return next;
    });
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
    setFormDate("");
    setFormStartTime("");
    setFormEndTime("");
    setFormHostId("");
    setFormBookingPageUrl("");
    setBookingUrlManual(false);
    setFormKaraokeUrl("");
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
    setFormDate(selected.date ?? "");
    setFormStartTime(selected.start_time ? formatTime(selected.start_time) : "");
    setFormEndTime(selected.end_time ? formatTime(selected.end_time) : "");
    setFormHostId(selected.host_employee_id ? String(selected.host_employee_id) : "");
    // A stored URL is treated as a manual override (preserved on save); if the event
    // is bookable but has no stored URL, auto-fill a preview from its grouping.
    if (selected.booking_page_url) {
      setFormBookingPageUrl(selected.booking_page_url);
      setBookingUrlManual(true);
    } else if (selected.is_bookable) {
      const grouping = typeById.get(selected.event_types_id)?.booking_grouping;
      setFormBookingPageUrl(bookingUrlFor({ typeId: selected.event_types_id, subtypeId: selected.event_subtypes_id, grouping, eventId: selected.id }));
      setBookingUrlManual(false);
    } else {
      setFormBookingPageUrl("");
      setBookingUrlManual(false);
    }
    setFormKaraokeUrl(selected.karaoke_request_url ?? "");
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
    // Validation errors are computed live (see `fieldErrors` below) and shown
    // inline under each field; the Save button is disabled while any exist. This
    // is a defensive guard in case a submit is triggered some other way.
    if (Object.keys(fieldErrors).length > 0) {
      setFormDetailsOpen(true);
      return;
    }

    // When the URL is the auto-derived preview (not manually overridden), send it
    // blank so the server generates the canonical URL with the real event id.
    if (!bookingUrlManual) formData.set("booking_page_url", "");

    startTransition(async () => {
      const result = await saveEventAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else if (isEditing && result?.event) {
        // Editing: drop back into the sheet's view mode showing the freshly
        // saved values (revalidatePath in the action refreshes the list too).
        setSelected(result.event as EventRecord);
        setIsEditing(false);
        setFormError(null);
        // Clear the ?open marker. The searchParams effect re-selects from
        // initialEvents on refresh; leaving ?open set lets it clobber the fresh
        // row above with a stale list entry after revalidation.
        window.history.replaceState(null, "", "/event-setups/events");
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

  // Mirrors the edit form's required-field validation (see `fieldErrors` /
  // `fieldWarnings` below): flags a saved event whose required or sub-type-driven
  // fields are still unset.
  const missingInfo = (e: EventRecord) => {
    const sub = subtypeById.get(e.event_subtypes_id);
    if (!e.title?.trim()) return true;
    if (!e.date) return true;
    if (!e.start_time || !e.end_time) return true;
    if (e.is_bookable && !e.booking_page_url?.trim()) return true;
    if (sub?.host_required && !e.host_employee_id) return true;
    if (sub?.payment_required && !(e.payment_amount != null && e.payment_amount > 0)) return true;
    if (sub?.behavior === "karaoke" && !e.karaoke_request_url?.trim()) return true;
    return false;
  };

  const QUICK_FILTERS: { key: string; label: string; test: (e: EventRecord) => boolean }[] = [
    { key: "bookable", label: "Requires bookings", test: (e) => e.is_bookable === true },
    { key: "bookings", label: "Has bookings", test: (e) => getBookingStats(e.id, bookings).confirmedPeople > 0 },
    { key: "under-10", label: "< 10 bookings", test: (e) => e.is_bookable === true && getBookingStats(e.id, bookings).confirmedPeople < 10 },
    { key: "quiz", label: "Needs quiz", test: needsQuiz },
    { key: "active", label: "Active only", test: (e) => e.is_active !== false },
    { key: "fully-booked", label: "Fully booked", test: (e) => e.is_fully_booked === true },
    { key: "missing-info", label: "Missing info", test: missingInfo },
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
  // Filters hidden behind the toggle button (category + quick filters, not search).
  const activeFilterCount = (catFilter !== "all" ? 1 : 0) + quickFilters.size;
  const clearAllFilters = () => { setCatFilter("all"); setQuickFilters(new Set()); setSearchQuery(""); };

  // Group the (already date-sorted) list into day buckets for sticky day headers.
  const dayGroups: { date: string; events: EventRecord[] }[] = [];
  for (const e of visibleEvents) {
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === e.date) last.events.push(e);
    else dayGroups.push({ date: e.date, events: [e] });
  }

  // --- Calendar (month grid) view ---
  // The grid honours search + category + quick filters, but not the header date
  // range (it has its own month navigation). Events are bucketed by date string.
  const matchesSearchOnly = (e: EventRecord) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const host = e.host_employee_id ? (hostById.get(e.host_employee_id) ?? "") : "";
    return `${e.title ?? ""} ${formatDate(e.date)} ${e.date ?? ""} ${host}`.toLowerCase().includes(q);
  };
  const eventsByDate = new Map<string, EventRecord[]>();
  for (const e of baseEvents) {
    if (!e.date) continue;
    if (!(matchesSearchOnly(e) && passesQuick(e) && (catFilter === "all" || e.event_types_id === catFilter))) continue;
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, []);
    eventsByDate.get(e.date)!.push(e);
  }
  for (const list of eventsByDate.values()) {
    list.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  }
  const calMonthStart = new Date(calendarMonth.year, calendarMonth.month, 1);
  const calMonthLabel = calMonthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const calDaysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
  const calendarCells: (string | null)[] = [];
  for (let i = 0; i < calMonthStart.getDay(); i++) calendarCells.push(null);
  for (let d = 1; d <= calDaysInMonth; d++) {
    const mm = String(calendarMonth.month + 1).padStart(2, "0");
    calendarCells.push(`${calendarMonth.year}-${mm}-${String(d).padStart(2, "0")}`);
  }
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);
  const shiftMonth = (delta: number) =>
    setCalendarMonth(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const goToday = () => {
    const n = new Date();
    setCalendarMonth({ year: n.getFullYear(), month: n.getMonth() });
  };

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
          "relative flex items-center gap-3 sm:gap-4 bg-white hover:shadow-md py-3 sm:py-4 pr-3 sm:pr-4 pl-4 sm:pl-5 border rounded-2xl w-full text-left active:scale-[0.99] transition",
          isTonight ? "border-[#FF6B35] ring-1 ring-[#FF6B35]/40" : "border-[#E6DFC8]",
          inactive && "opacity-60"
        )}
      >
        {/* colour spine */}
        <span className="absolute left-0 top-3 bottom-3 w-1 bg-(--spine) rounded-full" />

        {isTonight && (
          <span className="inline-flex -top-2 left-3 z-1 absolute items-center gap-1 bg-[#FF6B35] shadow px-2 rounded-full h-4.75 font-black text-[9px] text-white uppercase tracking-wide">
            <Flame className="w-2.5 h-2.5" /> Tonight
          </span>
        )}

        {/* date badge */}
        <div className={cn("flex flex-col justify-center items-center border rounded-xl w-11 sm:w-12 h-11 sm:h-12 shrink-0", badgeClass)}>
          <span className="font-black text-[9px] uppercase leading-none tracking-tighter">{monthAbbrOf(event.date)}</span>
          <span className="font-black text-base sm:text-lg leading-none">{dayNumOf(event.date)}</span>
        </div>

        {/* middle */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {sub && <span className={cn("px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wide", badgeClass)}>{toTitleCase(sub.name)}</span>}
            {inactive && <span className="bg-gray-100 px-1.5 py-0.5 rounded font-black text-[9px] text-gray-500 uppercase tracking-wide">Inactive</span>}
            {quizStat && !quizStat.allComplete && (
              <span className="inline-flex items-center gap-0.5">
                <span className="font-black text-[#5F624F] text-[9px]">Qz</span>
                {quizStat.someExist
                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
              </span>
            )}
          </div>
          <p className={cn("font-black text-sm sm:text-base lg:text-lg truncate leading-tight", inactive ? "text-[#5F624F]" : "text-[#1F1F1A]")}>
            {event.title || "Untitled Event"}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-1 font-semibold text-[#5F624F] text-[11px] sm:text-[13px] lg:text-sm">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              {formatTime(event.start_time)}{event.end_time ? `–${formatTime(event.end_time)}` : ""}
            </span>
            {host && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-grid place-items-center w-4.25 h-4.25 text-white text-[8.5px] font-black bg-(--spine) rounded-full">
                  {host.full_name[0]}
                </span>
                {shortHost(host.full_name)}
              </span>
            )}
          </div>
        </div>

        {/* right */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {(event.is_bookable || bStats.confirmedPeople > 0) && (
            <span className="inline-flex items-center gap-1 font-black tabular-nums text-[#5F624F] text-xs sm:text-sm">
              <Users className="w-3.5 sm:w-4 h-3.5 sm:h-4" />{bStats.confirmedPeople}
            </span>
          )}
          {hasPricing && <span className="font-black text-[11px] text-green-700 sm:text-xs lg:text-sm">£{event.payment_amount!.toFixed(2)}</span>}
          {event.is_fully_booked && <span className="bg-red-50 px-1.5 py-0.5 rounded font-black text-[9px] text-red-600 uppercase tracking-wide">Full</span>}
          <ChevronRight className="opacity-40 w-4 h-4 text-[#5F624F]" />
        </div>
      </button>
    );
  };

  // A calendar day cell reads as a mini day-timeline: the vertical axis is the time
  // of day, so an event sits lower in the cell the later it starts. The window runs
  // 08:00 (top) → 02:00 next-day (bottom), covering typical venue hours.
  const TL_START_MIN = 8 * 60;
  const TL_END_MIN = 26 * 60;
  const TL_MIN_GAP = 26; // % — keep stacked pills from overlapping (fits 2-line phone pills)
  const TL_MAX_TOP = 78; // % — keep the last pill inside the cell
  const timeTopPct = (startTime: string | null) => {
    const m = startTime ? parseTimeToMinutes(startTime.slice(0, 5)) : null;
    if (m == null) return 0;
    const mins = m < 6 * 60 ? m + 24 * 60 : m; // small hours read as after midnight
    const f = (mins - TL_START_MIN) / (TL_END_MIN - TL_START_MIN);
    return Math.min(1, Math.max(0, f)) * 100;
  };
  // Position each event by its time, then nudge later-but-clashing ones down so
  // they never overlap while staying in chronological order.
  const layoutDayByTime = (events: EventRecord[]) => {
    const sorted = [...events].sort((a, b) => timeTopPct(a.start_time) - timeTopPct(b.start_time));
    let last = -Infinity;
    return sorted.map((event) => {
      let top = Math.min(timeTopPct(event.start_time), TL_MAX_TOP);
      if (top < last + TL_MIN_GAP) top = Math.min(last + TL_MIN_GAP, TL_MAX_TOP);
      last = top;
      return { event, top };
    });
  };

  // Compact event pill for a calendar day cell — colour-coded by sub-type/type.
  // On phones it stacks time over title (two lines) so more of the event shows;
  // wider screens lay time + title on one line.
  const renderCalendarChip = (event: EventRecord) => {
    const sub = subtypeById.get(event.event_subtypes_id);
    const type = typeById.get(event.event_types_id);
    const badgeClass = badgeClassFromColor(sub?.color ?? type?.color ?? null);
    const inactive = event.is_active === false;
    return (
      <button
        type="button"
        onClick={() => openView(event)}
        title={`${event.title || "Untitled Event"}${event.start_time ? ` · ${formatTime(event.start_time)}` : ""}`}
        className={cn(
          "flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-1 lg:gap-1.5 hover:brightness-95 px-1 lg:px-1.5 py-0.5 border rounded-md w-full min-w-0 overflow-hidden text-left transition",
          badgeClass,
          inactive && "opacity-50 line-through",
        )}
      >
        {event.start_time && (
          <span className="font-black tabular-nums text-[8px] sm:text-[10px] lg:text-[11px] leading-tight shrink-0">{formatTime(event.start_time)}</span>
        )}
        <span className="min-w-0 font-bold text-[9px] sm:text-[10px] lg:text-[11px] leading-tight truncate">{event.title || "Untitled"}</span>
      </button>
    );
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;
  const selectedSubtype = subtypeById.get(Number(formSubtypeId));
  const selectedTypeForForm = typeById.get(Number(formTypeId));
  const formSubtypeOptions = subtypesByType.get(Number(formTypeId)) ?? [];

  // Live per-field validation for the edit/add form. Recomputed every render from
  // the controlled fields so messages appear as soon as the form opens (not only
  // on Save) and the Save button can be disabled while any error is present.
  // Keyed by field name (event_types_id, event_subtypes_id, title, date, time);
  // the clash helper is shared with the server action via @/lib/event-form-validation.
  const fieldErrors: Record<string, string> = {};
  // Non-blocking warnings (amber). These flag likely-missing details based on the
  // selected sub-type's requirements but never prevent saving.
  const fieldWarnings: Record<string, string> = {};
  if (showForm) {
    if (!formTypeId) fieldErrors.event_types_id = "Choose an event type.";
    if (!formSubtypeId) fieldErrors.event_subtypes_id = "Choose a sub-type.";
    if (!formTitle.trim()) fieldErrors.title = "Give the event a title.";
    if (!formDate) fieldErrors.date = "Pick a date.";
    if (!formStartTime || !formEndTime) {
      fieldErrors.time = !formStartTime && !formEndTime
        ? "Set a start and end time."
        : !formStartTime ? "Set a start time." : "Set an end time.";
    } else {
      const start = parseTimeToMinutes(formStartTime);
      const end = parseTimeToMinutes(formEndTime);
      if (start == null || end == null || (end <= start && !isOvernightEnd(end))) {
        fieldErrors.time = "End time must be after the start time.";
      } else if (formDate) {
        const clashes = findActiveEventClashes(
          { id: formDefault?.id ?? null, date: formDate, start: formStartTime, end: formEndTime },
          initialEvents
        );
        if (clashes.length > 0) {
          const c = clashes[0];
          fieldErrors.time = `Clashes with ${c.title} (${c.start}${c.end ? ` - ${c.end}` : ""}) on ${formatDate(formDate)}.`;
        }
      }
    }

    // Sub-type-driven warnings + the bookable-URL error.
    if (selectedSubtype?.host_required && (!formHostId || Number(formHostId) === 0)) {
      fieldWarnings.host_employee_id = "This sub-type usually has a host, but none is assigned.";
    }
    if (selectedSubtype?.payment_required && (!formPayment.trim() || !(Number(formPayment) > 0))) {
      fieldWarnings.payment_amount = "This sub-type usually takes payment, but no amount is set.";
    }
    if (selectedSubtype?.behavior === "karaoke" && !formKaraokeUrl.trim()) {
      fieldWarnings.karaoke_request_url = "Add a karaoke request link so guests can pick songs.";
    }
    if (formIsBookable && !formBookingPageUrl.trim()) {
      fieldErrors.booking_page_url = "Set a booking URL for this bookable event.";
    }
  }
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return (
    <div className={cn(
      "space-y-3 sm:space-y-4 bg-[#F7F4EA] mx-auto sm:px-4 sm:py-0 md:px-6 px-2 py-3",
      // The calendar grid needs the full screen width to breathe; the list stays a
      // comfortable reading column.
      viewMode === "calendar"
        ? "sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-368 2xl:max-w-432"
        : "sm:max-w-2xl md:max-w-3xl lg:max-w-5xl"
    )}>

      {/* Filter notice */}
      {filter === "quiz-incomplete" && (
        <div className="flex justify-between items-center gap-3 bg-amber-50 px-4 py-2.5 border border-amber-200 rounded-2xl">
          <p className="font-black text-[11px] text-amber-700 uppercase tracking-wide">
            Upcoming quizzes with incomplete questions
          </p>
          <Link href="/event-setups/events" className="font-black text-[11px] text-amber-700 underline uppercase tracking-wide shrink-0">
            Clear
          </Link>
        </div>
      )}

      {/* View toggle (top-left) + Filters toggle (right) */}
      <div className="flex justify-between items-center gap-2">
        <div className="inline-flex items-center bg-white p-0.5 border border-[#E6DFC8] rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            title="List view"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg h-8 font-black text-[10px] uppercase tracking-wide transition-colors",
              viewMode === "list" ? "bg-[#5C4033] text-white" : "text-[#5F624F] hover:text-[#5C4033]"
            )}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            aria-pressed={viewMode === "calendar"}
            title="Calendar view"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg h-8 font-black text-[10px] uppercase tracking-wide transition-colors",
              viewMode === "calendar" ? "bg-[#5C4033] text-white" : "text-[#5F624F] hover:text-[#5C4033]"
            )}
          >
            <Grid2X2 className="w-3.5 h-3.5" /> Calendar
          </button>
        </div>

        <button
          type="button"
          onClick={() => openAdd()}
          title="New Event"
          className="inline-flex justify-center items-center gap-1.5 bg-[#1B4332] hover:bg-[#1B4332]/85 px-3 rounded-xl h-9 text-white transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="font-black text-[10px] uppercase tracking-widest">New</span>
        </button>
      </div>

      {/* Header bar: search + date + compact Filters */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 bg-white px-3 border border-[#E6DFC8] focus-within:border-[#5C4033] rounded-xl min-w-0 h-11 transition-colors">
          <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
          <input
            type="text"
            placeholder="Search title, date or host..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none min-w-0 text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-sm"
          />
          {isSearching && (
            <button type="button" onClick={() => setSearchQuery("")} className="hover:bg-[#E6DFC8] -mr-1 p-1 rounded-md transition-colors shrink-0" title="Clear search">
              <X className="w-3.5 h-3.5 text-[#5F624F]/50" />
            </button>
          )}
        </div>
        {viewMode === "list" && <DatePicker value={dateRange} onChange={setDateRange} />}
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          aria-pressed={showFilters}
          aria-expanded={showFilters}
          title={showFilters ? "Hide filters" : "Show filters"}
          className={cn(
            "inline-flex justify-center items-center gap-1.5 sm:px-4 border rounded-xl w-11 sm:w-auto h-11 font-black text-[11px] uppercase tracking-widest transition-colors shrink-0",
            showFilters || activeFilterCount > 0
              ? "bg-[#5C4033] text-white border-[#5C4033]"
              : "bg-white text-[#5F624F] border-[#E6DFC8] hover:text-[#5C4033]"
          )}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex justify-center items-center bg-white px-1 rounded-full min-w-4 h-4 font-black tabular-nums text-[#5C4033] text-[9px]">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter bar: category chips + sort / quick filters (collapsed behind Filters) */}
      {showFilters && (
      <div className="space-y-2 pt-1 pb-1">
        {/* Category chips */}
        <div className="[&::-webkit-scrollbar]:hidden flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setCatFilter("all")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 border rounded-full h-7 font-black text-[10px] uppercase tracking-wide transition-colors shrink-0",
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
                  "inline-flex items-center gap-1.5 px-3 border rounded-full h-7 font-black text-[10px] uppercase tracking-wide transition-colors shrink-0",
                  sel ? "bg-[#5C4033] text-white border-[#5C4033]" : cn(badgeClassFromColor(type.color), "rounded-full")
                )}
              >
                {toTitleCase(type.name)} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Sort + quick filters */}
        <div className="[&::-webkit-scrollbar]:hidden flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setSortSoon((s) => !s)}
            className="inline-flex items-center gap-1.5 bg-[#EFE8D4] px-2.5 border border-[#E6DFC8] rounded-lg h-7 font-black text-[#5C4033] text-[9px] uppercase tracking-wide shrink-0"
          >
            <ArrowDownUp className="w-3 h-3" /> {sortSoon ? "Soonest" : "Latest"}
          </button>
          <span className="bg-[#E6DFC8] w-px h-4 shrink-0" />
          {QUICK_FILTERS.map((q) => {
            const on = quickFilters.has(q.key);
            return (
              <button
                key={q.key}
                type="button"
                onClick={() => toggleQuickFilter(q.key)}
                className={cn(
                  "px-3 border rounded-full h-7 font-black text-[9px] uppercase tracking-wide transition-colors shrink-0",
                  on ? "bg-[#5C4033] text-white border-[#5C4033]" : "bg-white text-[#5F624F] border-[#E6DFC8]"
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Result line */}
      {viewMode === "list" && anyFilterActive && (
        <div className="flex items-center gap-1.5 px-1 font-semibold text-[#5F624F] text-xs">
          <b className="font-black text-[#1F1F1A] text-[13px]">{visibleEvents.length}</b>
          event{visibleEvents.length === 1 ? "" : "s"}
          {catFilter !== "all" && (
            <> in <span className="font-black text-[#5C4033]">{toTitleCase(typeById.get(catFilter)?.name)}</span></>
          )}
          <button type="button" onClick={clearAllFilters} className="ml-auto font-black text-[#5C4033] text-[10px] underline uppercase tracking-wide">
            Clear all
          </button>
        </div>
      )}

      {/* Calendar grid or flat event list */}
      {viewMode === "calendar" ? (
        <div className="space-y-3">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} title="Previous month" className="inline-flex justify-center items-center bg-white hover:bg-[#EFE8D4] border border-[#E6DFC8] rounded-xl w-9 h-9 text-[#5C4033] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} title="Next month" className="inline-flex justify-center items-center bg-white hover:bg-[#EFE8D4] border border-[#E6DFC8] rounded-xl w-9 h-9 text-[#5C4033] transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <h3 className="font-black text-[#1F1F1A] text-sm sm:text-base uppercase tracking-tight">{calMonthLabel}</h3>
            <button type="button" onClick={goToday} className="bg-[#EFE8D4] hover:bg-[#E6DFC8] ml-auto px-3 border border-[#E6DFC8] rounded-xl h-9 font-black text-[#5C4033] text-[10px] uppercase tracking-wide transition-colors">
              Today
            </button>
          </div>

          {/* Weekday header */}
          <div className="gap-1 sm:gap-1.5 lg:gap-2 grid grid-cols-7">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 font-black text-[#5F624F] text-[9px] sm:text-[11px] lg:text-xs text-center uppercase tracking-wide">{w}</div>
            ))}
          </div>

          {/* Day cells — every cell the same fixed width (grid-cols-7) and height;
              inside each, events are positioned vertically by their start time. */}
          <div className="gap-1 sm:gap-1.5 lg:gap-2 grid grid-cols-7">
            {calendarCells.map((dateStr, i) => {
              if (!dateStr) return <div key={`blank-${i}`} className="bg-[#F0EDE0]/50 border border-transparent rounded-xl h-32 sm:h-36 lg:h-44" />;
              const dayEvents = eventsByDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const MAX = 4;
              const laid = layoutDayByTime(dayEvents);
              const shown = laid.slice(0, MAX);
              const extra = laid.length - shown.length;
              return (
                <div key={dateStr} className={cn("relative bg-white border rounded-xl h-32 sm:h-36 lg:h-44 overflow-hidden", isToday ? "border-[#FF6B35] ring-1 ring-[#FF6B35]/40" : "border-[#E6DFC8]")}>
                  {/* day number + event count */}
                  <div className="flex justify-between items-center px-1 pt-1">
                    <span className={cn("font-black tabular-nums text-[10px] sm:text-xs lg:text-sm", isToday ? "text-[#FF6B35]" : "text-[#5F624F]")}>{Number(dateStr.slice(-2))}</span>
                    {dayEvents.length > 0 && <span className="font-black tabular-nums text-[#5F624F]/60 text-[8px] sm:text-[9px]">{dayEvents.length}</span>}
                  </div>
                  {/* timeline area below the day number — top = earlier, bottom = later */}
                  <div className="absolute inset-x-0 top-5 lg:top-6 bottom-1">
                    {shown.map(({ event, top }) => (
                      <div
                        key={event.id}
                        style={{ "--top": `${top}%` } as React.CSSProperties}
                        className="absolute inset-x-1 top-(--top)"
                      >
                        {renderCalendarChip(event)}
                      </div>
                    ))}
                    {extra > 0 && (
                      <button type="button" onClick={() => openView(laid[MAX].event)} className="right-1 bottom-0 absolute bg-[#F7F4EA] px-1 rounded font-black text-[#5C4033] text-[8px] sm:text-[9px] lg:text-[10px] uppercase tracking-wide">
                        +{extra} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="py-14 border border-[#E6DFC8] border-dashed rounded-2xl text-center">
          <CalendarDays className="opacity-30 mx-auto mb-3 w-8 h-8 text-[#5F624F]" />
          <p className="font-black text-[#1F1F1A] text-sm">
            {filter === "quiz-incomplete" ? "No upcoming quizzes with incomplete questions" : "Nothing matches"}
          </p>
          <p className="mt-1 text-[#5F624F] text-[11px]">
            {filter === "quiz-incomplete"
              ? "All quiz questions are complete"
              : anyFilterActive ? "No events with these filters" : "No events for the selected dates"}
          </p>
          {anyFilterActive && filter !== "quiz-incomplete" && (
            <button type="button" onClick={clearAllFilters} className="mt-3 font-black text-[#5C4033] text-[11px] underline uppercase tracking-wide">
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          {dayGroups.map((group) => (
            <section key={group.date} className="space-y-1.5 sm:space-y-2">
              {/* Sticky day separator */}
              <div className="top-0 z-10 sticky flex items-center gap-2 bg-[#F7F4EA] py-1.5">
                <span className="font-black text-[#5C4033] text-[11px] sm:text-xs lg:text-sm uppercase tracking-wide">{relativeDayOf(group.date, todayStr)}</span>
                <span className="flex-1 bg-[#E6DFC8] h-px" />
                <span className="font-bold text-[#5F624F] text-[10px] sm:text-[11px] lg:text-xs">{weekdayOf(group.date)} {dayNumOf(group.date)} {monthAbbrOf(group.date)}</span>
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
          className="flex flex-col bg-[#F7F4EA] shadow-2xl p-0 border-[#E6DFC8] border-t-2 rounded-t-[2.5rem] outline-none h-[85vh]
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2
            sm:w-140 lg:w-6xl xl:w-7xl
            sm:h-auto sm:max-h-[80vh] lg:max-h-[90vh] sm:border-2 sm:rounded-4xl"
        >
          {/* Sheet header */}
          <div className="top-0 z-30 sticky bg-white/80 backdrop-blur-md p-4 pb-3 border-[#E6DFC8] border-b sm:rounded-t-4xl shrink-0">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <SheetTitle className="font-black text-[#1F1F1A] text-xl truncate uppercase leading-tight tracking-tighter">
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
                    <span className="font-black tabular-nums text-[#5F624F] text-xs uppercase tracking-wide">ID: {selected.id}</span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <span className={cn(
                  "px-3 py-1.5 border rounded-full font-black text-[10px] shrink-0",
                  selected.is_active !== false ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-600 border-red-300"
                )}>
                  {selected.is_active !== false ? "Active" : "Inactive"}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 space-y-4 sm:space-y-5 px-4 sm:px-6 py-4 sm:py-6 min-h-0 overflow-y-auto touch-pan-y">

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
                <div className="items-start gap-5 space-y-4 sm:space-y-5 lg:space-y-0 lg:grid grid-cols-2 animate-in duration-200 fade-in">
                  <div className="bg-white border-[#E6DFC8] border-2 rounded-3xl overflow-hidden">
                    <button type="button" onClick={() => setDetailsOpen(o => !o)} className="flex justify-between items-center bg-[#F7F4EA] hover:bg-[#F0EDE0] px-4 sm:px-5 py-3 w-full text-left transition-colors">
                      <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">Event Details</span>
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
                      <div className="bg-white border-[#E6DFC8] border-2 rounded-3xl overflow-hidden">
                        <button type="button" onClick={() => setQuizOpen(o => !o)} className="flex justify-between items-center bg-[#F7F4EA] hover:bg-[#F0EDE0] px-4 sm:px-5 py-3 w-full text-left transition-colors">
                          <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">Quiz Questions</span>
                          <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", quizOpen && "rotate-180")} />
                        </button>
                        {quizOpen && (
                          <>
                            <div className="space-y-2 px-4 sm:px-5 py-2.5">
                              {categoryCounts.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center gap-2">
                                  <span className="font-bold text-[#1F1F1A] text-xs sm:text-sm">{cat.category_name}</span>
                                  <div className="flex items-center gap-1.5">
                                    {cat.count >= cat.question_count ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : cat.count > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                                    <span className="font-black tabular-nums text-[#5F624F] text-xs sm:text-sm">{cat.count} / {cat.question_count}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="px-4 sm:px-5 py-2.5 border-[#E6DFC8] border-t">
                              <Link href={`/event-setups/events/${selected.id}`} className="flex justify-center items-center gap-1.5 bg-[#5C4033] hover:bg-[#5C4033]/85 rounded-xl w-full h-9 text-white transition-colors" title="Manage Quiz">
                                <Brain className="w-3.5 h-3.5" />
                                <span className="font-black text-[9px] uppercase tracking-wide">Manage Quiz</span>
                              </Link>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {selected.is_bookable && <div className="bg-white border-[#E6DFC8] border-2 rounded-3xl overflow-hidden">
                    <button type="button" onClick={() => setBookingsOpen(o => !o)} className="flex justify-between items-center bg-[#F7F4EA] hover:bg-[#F0EDE0] px-4 sm:px-5 py-3 w-full text-left transition-colors">
                      <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">Bookings</span>
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
                            <p className="font-black tabular-nums text-green-600 text-base sm:text-lg leading-tight">{bk.confirmedPeople}</p>
                            <p className="font-black text-[#5F624F] text-[10px] sm:text-[9px] uppercase tracking-wide">Confirmed</p>
                          </div>
                          <div className="px-2 sm:px-3 py-2 text-center">
                            <p className="font-black tabular-nums text-amber-500 text-base sm:text-lg leading-tight">{bk.waitlistedPeople}</p>
                            <p className="font-black text-[#5F624F] text-[10px] sm:text-[9px] uppercase tracking-wide">Waitlisted</p>
                          </div>
                          <div className="px-2 sm:px-3 py-2 text-center">
                            <p className="font-black tabular-nums text-red-500 text-base sm:text-lg leading-tight">{bk.cancelledPeople}</p>
                            <p className="font-black text-[#5F624F] text-[10px] sm:text-[9px] uppercase tracking-wide">Cancelled</p>
                          </div>
                        </div>
                        <div className="px-4 sm:px-5 py-2.5 border-[#E6DFC8] border-t">
                          <Link href={viewAllHref} className="flex justify-center items-center gap-1.5 bg-[#5C4033] hover:bg-[#5C4033]/85 rounded-xl w-full h-9 text-white transition-colors">
                            <Users className="w-3.5 h-3.5" />
                            <span className="font-black text-[9px] uppercase tracking-wide">View All</span>
                          </Link>
                        </div>
                        {selected.seating_required && (
                          <div className="px-4 sm:px-5 py-2.5 border-[#E6DFC8] border-t">
                            <Link href={`/settings/floor-plan/${selected.id}`} className="flex justify-center items-center gap-1.5 bg-white hover:bg-[#F7F4EA] border-[#E6DFC8] border-2 rounded-xl w-full h-9 text-[#5C4033] transition-colors">
                              <Grid2X2 className="w-3.5 h-3.5" />
                              <span className="font-black text-[9px] uppercase tracking-wide">Floor plan layout calculator</span>
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>}

                  <div className="bg-white border-[#E6DFC8] border-2 rounded-3xl overflow-hidden">
                    <button type="button" onClick={() => setBookingSettingsOpen(o => !o)} className="flex justify-between items-center bg-[#F7F4EA] hover:bg-[#F0EDE0] px-4 sm:px-5 py-3 w-full text-left transition-colors">
                      <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">Public Booking Settings</span>
                      <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", bookingSettingsOpen && "rotate-180")} />
                    </button>
                    {bookingSettingsOpen && (
                      <>
                        <DetailCell label="Public Booking" toggle={!!selected.is_bookable} />

                        {selected.is_bookable && (
                          <div className="px-4 sm:px-5 py-3 border-[#E6DFC8] border-t">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Link2 className="w-3.5 h-3.5 text-[#5F624F]" />
                              <span className="font-bold text-[#5F624F] text-[10px] uppercase tracking-wide">Shareable Booking Link</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-[#F7F4EA] px-3 py-2 border border-[#E6DFC8] rounded-lg font-bold text-[#26300D] text-[11px] truncate">
                                {selected.booking_page_url ?? (typeof window !== "undefined" ? `${window.location.origin}/book/event/${selected.id}` : `/book/event/${selected.id}`)}
                              </code>
                              <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={() => {
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
                          <div className="border-[#E6DFC8] border-t">
                            <button type="button" onClick={() => setBookingPageOpen(o => !o)} className="flex justify-between items-center bg-[#E6DFC8]/60 hover:bg-[#E6DFC8]/80 px-4 sm:px-5 py-3 w-full text-left transition-colors">
                              <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">Booking Page</span>
                              <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", bookingPageOpen && "rotate-180")} />
                            </button>
                            {bookingPageOpen && (
                              <div className="bg-[#F7F4EA]/40 p-3 sm:p-4">
                                <BookingConfigEditor value={selected.booking_config ?? {}} readOnly />
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {formError && <div className="lg:col-span-2"><ErrorBox message={formError} /></div>}
                </div>
              );
            })()}

            {/* Edit / Add form */}
            {showForm && (
              <form id="event-form" action={handleSubmit} className="items-start gap-5 space-y-4 sm:space-y-5 lg:space-y-0 lg:grid grid-cols-2 animate-in duration-200 fade-in">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
                {/* Boolean fields live in the collapsible Settings section; keep their
                    hidden inputs at the form root so they submit even when collapsed. */}
                <input type="hidden" name="seating_required" value={formSeating ? "on" : ""} />
                <input type="hidden" name="is_active" value={formActive ? "on" : ""} />
                <input type="hidden" name="is_fully_booked" value={formFullyBooked ? "on" : ""} />
                <input type="hidden" name="is_bookable" value={formIsBookable ? "on" : ""} />

                <FormSection title="Details" open={formDetailsOpen} onToggle={() => setFormDetailsOpen((o) => !o)}>
                  {/* Event Type */}
                  <FormRow label="Event Type" required error={fieldErrors.event_types_id}>
                    <div className="flex flex-1 justify-end items-center gap-1.5 min-w-0">
                      <select
                        title="Event Type"
                        name="event_types_id"
                        value={formTypeId}
                        onChange={(e) => onSelectType(e.target.value)}
                        className="bg-transparent outline-none min-w-0 font-black text-[#1F1F1A] text-xs sm:text-sm text-right appearance-none cursor-pointer [text-align-last:right]"
                      >
                        {eventTypes.map((t) => (
                          <option key={t.id} value={t.id}>{toTitleCase(t.name)}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] pointer-events-none shrink-0" />
                    </div>
                  </FormRow>

                  {/* Sub-Type */}
                  <FormRow label="Sub-Type" required error={fieldErrors.event_subtypes_id}>
                    <div className="flex flex-1 justify-end items-center gap-1.5 min-w-0">
                      <select
                        title="Sub-Type"
                        name="event_subtypes_id"
                        value={formSubtypeId}
                        onChange={(e) => onSelectSubtype(e.target.value)}
                        className="bg-transparent outline-none min-w-0 font-black text-[#1F1F1A] text-xs sm:text-sm text-right appearance-none cursor-pointer [text-align-last:right]"
                      >
                        <option value="" disabled>Select a sub-type...</option>
                        {formSubtypeOptions.map((s) => (
                          <option key={s.id} value={s.id}>{toTitleCase(s.name)}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] pointer-events-none shrink-0" />
                    </div>
                  </FormRow>

                  {/* Title */}
                  <FormRow label="Title" required error={fieldErrors.title}>
                    <input
                      name="title"
                      placeholder="e.g. Music Bingo"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="flex-1 bg-transparent outline-none font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm text-right"
                    />
                  </FormRow>

                  {/* Date */}
                  <FormRow label="Date" required error={fieldErrors.date}>
                    <div className="flex flex-1 justify-end items-center">
                      <input title="Date" name="date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="bg-transparent outline-none font-black text-[#1F1F1A] text-xs sm:text-sm" />
                    </div>
                  </FormRow>

                  {/* Time */}
                  <FormRow label="Time" required error={fieldErrors.time}>
                    <div className="flex flex-1 justify-end items-center gap-2">
                      <input title="Start time" name="start_time" type="time" value={formStartTime} onChange={(e) => { const v = e.target.value; setFormStartTime(v); if (v && !formEndTime) { const end = addHoursToTime(v, 2); if (end) setFormEndTime(end); } }} className="bg-transparent outline-none w-22 font-black text-[#1F1F1A] text-xs sm:text-sm text-right" />
                      <span className="text-[#5F624F]/50 text-xs">-</span>
                      <input title="End time" name="end_time" type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="bg-transparent outline-none w-22 font-black text-[#1F1F1A] text-xs sm:text-sm text-right" />
                    </div>
                  </FormRow>

                  {/* Host — only when subtype requires a host */}
                  {selectedSubtype?.host_required && (
                    <FormRow label="Host" warning={fieldWarnings.host_employee_id}>
                      <div className="flex flex-1 justify-end items-center gap-1.5 min-w-0">
                        <select title="Host" name="host_employee_id" value={formHostId} onChange={(e) => setFormHostId(e.target.value)} className="bg-transparent outline-none min-w-0 font-black text-[#1F1F1A] text-xs sm:text-sm text-right appearance-none cursor-pointer [text-align-last:right]">
                          <option value="">No host</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>{e.full_name}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] pointer-events-none shrink-0" />
                      </div>
                    </FormRow>
                  )}

                  {/* Payment */}
                  <FormRow label="Payment (£)" warning={fieldWarnings.payment_amount}>
                    <input name="payment_amount" type="number" min="0" step="0.01" placeholder="0.00" value={formPayment} onChange={(e) => setFormPayment(e.target.value)} className="flex-1 bg-transparent outline-none font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm text-right" />
                  </FormRow>

                  {/* Tagline */}
                  <div className="px-4 sm:px-5 py-2.5 sm:py-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 opacity-60 mb-2 text-[#5F624F]">
                      <span className="font-black text-[10px] uppercase tracking-wide">Tagline</span>
                    </div>
                    <textarea name="tagline" placeholder="Brief tagline for the event..." rows={2} value={formTagline} onChange={(e) => setFormTagline(e.target.value)} className="bg-transparent outline-none w-full font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm resize-none" />
                  </div>

                  {/* External Link */}
                  <FormRow label="External Link">
                    <input name="external_link" type="url" placeholder="https://instagram.com/..." defaultValue={formDefault?.external_link ?? ""} className="flex-1 bg-transparent outline-none font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm text-right" />
                  </FormRow>

                  {/* Karaoke Song Request Link — only when subtype is karaoke */}
                  {selectedSubtype?.behavior === "karaoke" && (
                    <FormRow label="Singa Link" warning={fieldWarnings.karaoke_request_url}>
                      <input name="karaoke_request_url" type="url" placeholder="https://app.singa.com/..." value={formKaraokeUrl} onChange={(e) => setFormKaraokeUrl(e.target.value)} className="flex-1 bg-transparent outline-none font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm text-right" />
                    </FormRow>
                  )}

                </FormSection>

                {/* Right column on desktop: the two shorter sections stacked beside Details. */}
                <div className="space-y-4 sm:space-y-5">
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
                    <FormToggle label="Public booking" on={formIsBookable} onToggle={toggleBookable} />
                  </FormRow>

                  {/* fully booked, booking_url, linked booking & group name only apply to a publicly bookable event. */}
                  {formIsBookable && (
                    <>
                      <FormRow label="Fully Booked">
                        <span className="flex-1" />
                        <FormToggle label="Fully booked" on={formFullyBooked} onToggle={() => setFormFullyBooked((o) => !o)} danger />
                      </FormRow>

                      {/* Booking URL — required for a bookable event. Seeded from the
                          saved value when editing; blocks save while empty. */}
                      <FormRow label="Booking URL" required error={fieldErrors.booking_page_url}>
                        <input name="booking_page_url" type="url" placeholder="https://..." value={formBookingPageUrl} onChange={(e) => { setFormBookingPageUrl(e.target.value); setBookingUrlManual(true); }} className="flex-1 bg-transparent outline-none font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm text-right" />
                      </FormRow>

                      {/* Linked Booking & Group Name (games only) */}
                      {selectedTypeForForm?.name === "games" && (() => {
                        const eventBookings = formDefault ? bookings.filter(b => b.event_id === formDefault.id && b.status !== "cancelled") : [];
                        return (
                          <>
                            <FormRow label="Linked Booking">
                              <input type="hidden" name="booking_id" value={formBookingId} />
                              <div className="flex flex-1 justify-end items-center gap-1.5 min-w-0">
                                <select
                                  title="Linked Booking"
                                  value={formBookingId}
                                  onChange={(e) => {
                                    const bId = e.target.value;
                                    setFormBookingId(bId);
                                    if (bId) {
                                      const bk = eventBookings.find(b => String(b.id) === bId);
                                      if (bk?.group_name) setFormGroupName(bk.group_name);
                                    } else {
                                      // "No booking" selected — clear the linked group name.
                                      setFormGroupName("");
                                    }
                                  }}
                                  className="bg-transparent outline-none min-w-0 font-black text-[#1F1F1A] text-xs sm:text-sm text-right appearance-none cursor-pointer [text-align-last:right]"
                                >
                                  <option value="">No booking</option>
                                  {eventBookings.map(b => (
                                    <option key={b.id} value={b.id}>#{b.id} — {b.group_name || "Unnamed"}</option>
                                  ))}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] pointer-events-none shrink-0" />
                              </div>
                            </FormRow>
                            <FormRow label="Group Name">
                              <input type="hidden" name="group_name" value={formGroupName} />
                              <input value={formGroupName} onChange={(e) => setFormGroupName(e.target.value)} placeholder="e.g. The Brainiacs" className="flex-1 bg-transparent outline-none font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm text-right" />
                            </FormRow>
                          </>
                        );
                      })()}
                    </>
                  )}
                </FormSection>
                </div>

                {/* Booking page/form config — editable whenever the event is bookable.
                    Saved onto this event's own booking_config regardless of grouping. */}
                {formIsBookable && (
                  <div className="lg:col-span-2">
                    <input type="hidden" name="booking_config" value={JSON.stringify(formBookingConfig)} />
                    <BookingConfigEditor value={formBookingConfig} onChange={setFormBookingConfig} />
                  </div>
                )}

                {/* Booking card branding — only when this category owns the card (per_event) and it's bookable. */}
                {formIsBookable && selectedTypeForForm?.booking_grouping === "per_event" && (
                  <div className="lg:col-span-2 bg-white border-[#E6DFC8] border-2 rounded-3xl divide-y divide-[#E6DFC8]/50 overflow-hidden">
                    <div className="bg-[#E6DFC8]/60 px-4 sm:px-5 py-2.5 sm:py-3">
                      <span className="font-black text-[#26300D] text-[11px] uppercase tracking-wide">Booking Card</span>
                    </div>
                    <div className="px-4 sm:px-5 pt-2.5">
                      <p className="text-[#5F624F] text-[10px] leading-relaxed">Shown on the public booking hub card. Blank fields fall back to the title, a calendar icon, and the auto badge.</p>
                    </div>
                    <FormRow label="Card Title">
                      <input name="booking_card_title" placeholder="e.g. Music Bingo" value={formCardTitle} onChange={(e) => setFormCardTitle(e.target.value)} className="flex-1 bg-transparent outline-none font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm text-right" />
                    </FormRow>
                    <div className="px-4 sm:px-5 py-2.5 sm:py-4">
                      <div className="flex items-center gap-1.5 sm:gap-2 opacity-60 mb-2 text-[#5F624F]">
                        <span className="font-black text-[10px] uppercase tracking-wide">Card Tagline</span>
                      </div>
                      <textarea name="booking_card_tagline" placeholder="Short line shown under the title..." rows={2} value={formCardTagline} onChange={(e) => setFormCardTagline(e.target.value)} className="bg-transparent outline-none w-full font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm resize-none" />
                    </div>
                    <FormRow label="Card Badge">
                      <input name="booking_card_badge" placeholder="e.g. Thursdays, Book Now" value={formCardBadge} onChange={(e) => setFormCardBadge(e.target.value)} className="flex-1 bg-transparent outline-none font-black text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-xs sm:text-sm text-right" />
                    </FormRow>
                    <input type="hidden" name="booking_card_icon" value={formCardIcon ?? ""} />
                    <IconPicker label="Card Icon" value={formCardIcon} onChange={setFormCardIcon} />
                  </div>
                )}

                {formError && <div className="lg:col-span-2"><ErrorBox message={formError} /></div>}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="z-40 bg-white/80 backdrop-blur-md px-6 py-5 pb-10 sm:pb-5 border-[#E6DFC8] border-t-2 rounded-b-4xl shrink-0">
            {!showForm && selected && (
              <div className="gap-3 grid grid-cols-2">
                <Button variant="ghost" onClick={handleDelete} disabled={isPending} className="bg-white hover:bg-red-50 px-4 border-[#E6DFC8] border-2 hover:border-red-200 rounded-2xl h-14 font-black text-[10px] text-red-500 uppercase tracking-wide">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="mr-2 w-4 h-4" />}
                  Delete
                </Button>
                <Button onClick={openEdit} className="flex-1 bg-[#B45309] hover:bg-[#B45309]/85 shadow-lg rounded-2xl h-14 font-black text-[10px] text-white uppercase tracking-widest active:scale-95">
                  <Pencil className="mr-2 w-4 h-4" />Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="gap-3 grid grid-cols-2">
                <Button type="button" variant="outline" onClick={() => { setFormError(null); if (isAdding) closeSheet(); else setIsEditing(false); }} disabled={isPending} className="bg-white border-[#E6DFC8] border-2 rounded-2xl h-14 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
                  Cancel
                </Button>
                <Button type="button" disabled={isPending || hasFieldErrors} title={hasFieldErrors ? "Resolve the highlighted fields before saving" : undefined} onClick={() => { const form = document.getElementById('event-form') as HTMLFormElement | null; if (form) form.requestSubmit(); }} className="bg-[#1B4332] hover:bg-[#1B4332]/85 disabled:opacity-50 shadow-lg rounded-2xl h-14 font-black text-[10px] text-white uppercase tracking-widest active:scale-95 disabled:pointer-events-none">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="mr-2 w-4 h-4" />Save</>}
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

function FormRow({ label, required, error, warning, children }: { label: string; required?: boolean; error?: string; warning?: string; children: React.ReactNode }) {
  // Errors (red) take precedence over warnings (amber); both render underneath.
  const message = error ?? warning;
  const isWarning = !error && !!warning;
  return (
    <div className="px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={cn("flex items-center gap-1.5 sm:gap-2 shrink-0", error ? "text-red-600 opacity-100" : warning ? "text-amber-600 opacity-100" : "text-[#5F624F] opacity-60")}>
          <span className="font-black text-[10px] uppercase tracking-wide whitespace-nowrap">{label}</span>
          {required && <span className="font-black text-[10px] text-red-500">*</span>}
        </div>
        {children}
      </div>
      {message && (
        <p className={cn("flex items-center gap-1 mt-1.5 font-bold text-[11px] leading-snug", isWarning ? "text-amber-600" : "text-red-600")}>
          {isWarning ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
          {message}
        </p>
      )}
    </div>
  );
}

function DetailCell({ label, value, icon, toggle, accent }: { label: string; value?: string; icon?: React.ReactNode; toggle?: boolean; accent?: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-[#E6DFC8] last:border-0 border-b">
      <div className="flex items-center gap-1.5 sm:gap-2 opacity-60 text-[#5F624F] shrink-0">
        {icon}
        <span className="font-black text-[10px] uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      {toggle !== undefined ? (
        <span className="flex flex-1 justify-end">
          <ToggleSlider on={toggle} />
        </span>
      ) : (
        <span className={cn("flex-1 font-black text-xs sm:text-sm text-right leading-snug", accent ?? "text-[#1F1F1A]")}>{value}</span>
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
        "relative rounded-full w-9 h-5 transition-colors shrink-0",
        on ? (danger ? "bg-red-600" : "bg-green-600") : "bg-[#5F624F]/25"
      )}
    >
      <span className={cn("top-0.5 absolute bg-white shadow rounded-full w-4 h-4 transition-transform", on ? "translate-x-4.5" : "translate-x-0.5")} />
    </span>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-red-50 p-4 border border-red-200 rounded-2xl">
      <AlertCircle className="mt-0.5 w-5 h-5 text-red-500 shrink-0" />
      <p className="font-bold text-red-700 text-sm leading-snug">{message}</p>
    </div>
  );
}

/** Collapsible section wrapper for the edit/new form. Body stays mounted (hidden
 * when collapsed) so field values — including uncontrolled inputs — survive a
 * collapse and remain submittable. */
function FormSection({ title, open, onToggle, children, className }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border-[#E6DFC8] border-2 rounded-3xl overflow-hidden", className)}>
      <button type="button" onClick={onToggle} className="flex justify-between items-center bg-[#F7F4EA] hover:bg-[#F0EDE0] px-4 sm:px-5 py-3 w-full text-left transition-colors">
        <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">{title}</span>
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
        "relative border rounded-full w-11 h-6 transition-colors shrink-0",
        on ? (danger ? "bg-red-600 border-red-700" : "bg-green-500 border-green-600") : "bg-[#5F624F]/20 border-[#5F624F]/30"
      )}
    >
      <span className={cn("top-1/2 left-0 absolute bg-white shadow rounded-full w-5 h-5 transition-transform -translate-y-1/2", on ? "translate-x-5.25" : "translate-x-0.5")} />
    </button>
  );
}
