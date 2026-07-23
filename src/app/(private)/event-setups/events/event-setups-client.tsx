"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  QrCode,
  Upload,
} from "lucide-react";
import QRCode from "qrcode";
import { createBrowserClient } from "@supabase/ssr";
import { saveEventAction, deleteEventAction, setEventQr } from "./actions";
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

const storageClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EVENT_IMAGE_BUCKET = "booking-images";

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
  booking_qr_url: string | null;
  image_url: string | null;
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
  initialFrom,
  initialTo,
  initialQuick,
}: {
  initialEvents: EventRecord[];
  eventTypes: EventType[];
  eventSubtypes: EventSubtype[];
  employees: Employee[];
  quizCategories: QuizCategory[];
  quizQuestions: QuizQuestion[];
  bookings: BookingRecord[];
  filter?: string;
  initialFrom?: string;
  initialTo?: string;
  initialQuick?: string;
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [returnHref, setReturnHref] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<number | "all">("all");
  const [sortSoon, setSortSoon] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showFilters, setShowFilters] = useState(!!initialQuick);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [quickFilters, setQuickFilters] = useState<Set<string>>(
    () => new Set((initialQuick ?? "").split(",").map((s) => s.trim()).filter(Boolean))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(() => {
    if (initialFrom) return { start: initialFrom, end: initialTo ?? initialFrom };
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
  const [formCardTitle, setFormCardTitle] = useState("");
  const [formCardTagline, setFormCardTagline] = useState("");
  const [formCardIcon, setFormCardIcon] = useState<string | null>(null);
  const [formCardBadge, setFormCardBadge] = useState("");
  const [formTypeId, setFormTypeId] = useState<string>("");
  const [formSubtypeId, setFormSubtypeId] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formHostId, setFormHostId] = useState<string>("");
  const [formTagline, setFormTagline] = useState<string>("");
  const [formImageUrl, setFormImageUrl] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [formPayment, setFormPayment] = useState<string>("");
  const [formBookingPageUrl, setFormBookingPageUrl] = useState<string>("");
  const [bookingUrlManual, setBookingUrlManual] = useState(false);
  const [formKaraokeUrl, setFormKaraokeUrl] = useState<string>("");
  const [formSeating, setFormSeating] = useState<boolean>(true);
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formFullyBooked, setFormFullyBooked] = useState<boolean>(false);
  const [formDetailsOpen, setFormDetailsOpen] = useState(true);
  const [formSettingsOpen, setFormSettingsOpen] = useState(true);
  const [formBookingSettingsOpen, setFormBookingSettingsOpen] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [quizOpen, setQuizOpen] = useState(true);
  const [bookingsOpen, setBookingsOpen] = useState(true);
  const [bookingSettingsOpen, setBookingSettingsOpen] = useState(false);
  const [bookingPageOpen, setBookingPageOpen] = useState(false);

  const typeById = new Map(eventTypes.map((t) => [t.id, t]));
  const subtypeById = new Map(eventSubtypes.map((s) => [s.id, s]));
  const subtypesByType = new Map<number, EventSubtype[]>();
  for (const s of eventSubtypes) {
    if (!subtypesByType.has(s.event_types_id)) subtypesByType.set(s.event_types_id, []);
    subtypesByType.get(s.event_types_id)!.push(s);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const back = searchParams.get("back") || params.get("back");
    if (back && back.startsWith("/") && !back.startsWith("//") && !back.startsWith("/\\")) {
      setReturnHref(back);
    }
    const openId = searchParams.get("open") || params.get("open");
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
    if (!bookingUrlManual) {
      const eventId = isEditing ? (selected?.id ?? null) : null;
      setFormBookingPageUrl(bookable ? bookingUrlFor({ typeId: owner?.id ?? 0, subtypeId: sub?.id ?? 0, grouping: owner?.booking_grouping, eventId }) : "");
    }
  };

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setFormError(null);
    const ext = file.name.split(".").pop();
    const path = `events/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await storageClient.storage
      .from(EVENT_IMAGE_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) {
      setFormError(`Upload failed: ${error.message}`);
      setImageUploading(false);
      return;
    }
    setFormImageUrl(
      storageClient.storage.from(EVENT_IMAGE_BUCKET).getPublicUrl(data.path).data.publicUrl
    );
    setImageUploading(false);
  };

  const openView = (event: EventRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(event);
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
    setFormImageUrl("");
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
    setFormImageUrl(selected.image_url ?? "");
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
    if (returnHref) {
      router.push(returnHref);
      return;
    }
    window.history.replaceState(null, "", "/event-setups/events");
  };

  const bookingUrlOf = (ev: EventRecord) =>
    ev.booking_page_url ?? (typeof window !== "undefined" ? `${window.location.origin}/book/event/${ev.id}` : `/book/event/${ev.id}`);

  const makeQrDataUrl = (url: string) =>
    QRCode.toDataURL(url, { width: 512, margin: 1, errorCorrectionLevel: "M", color: { dark: "#26300D", light: "#ffffff" } });

  const generateQr = async () => {
    if (!selected) return;
    setQrBusy(true);
    try {
      const dataUrl = await makeQrDataUrl(bookingUrlOf(selected));
      const res = await setEventQr(selected.id, dataUrl);
      if (res?.error) { setFormError(res.error); return; }
      setSelected((cur) => (cur && cur.id === selected.id ? { ...cur, booking_qr_url: dataUrl } : cur));
    } finally {
      setQrBusy(false);
    }
  };

  const copyQr = async () => {
    if (!selected?.booking_qr_url) return;
    try {
      const blob = await (await fetch(selected.booking_qr_url)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    } catch {
    }
  };

  const reconcileQrAfterSave = async (saved: EventRecord, prevUrl: string | null, prevQr: string | null) => {
    if (!saved.is_bookable) return; // server already cleared any stored QR
    if (!prevQr || prevUrl === (saved.booking_page_url ?? null)) return;
    const ok = await confirm({
      title: "Booking link changed",
      description: "This event's booking link changed. Update the saved QR code to match the new link?",
      confirmLabel: "Update QR",
    });
    if (!ok) return;
    const dataUrl = await makeQrDataUrl(bookingUrlOf(saved));
    const res = await setEventQr(saved.id, dataUrl);
    if (!res?.error) setSelected((cur) => (cur && cur.id === saved.id ? { ...cur, booking_qr_url: dataUrl } : cur));
  };

  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    if (Object.keys(fieldErrors).length > 0) {
      setFormDetailsOpen(true);
      return;
    }

    if (!bookingUrlManual) formData.set("booking_page_url", "");

    startTransition(async () => {
      const result = await saveEventAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else if (isEditing && result?.event) {
        const saved = result.event as EventRecord;
        const prevUrl = selected?.booking_page_url ?? null;
        const prevQr = selected?.booking_qr_url ?? null;
        setSelected(saved);
        setIsEditing(false);
        setFormError(null);
        window.history.replaceState(null, "", "/event-setups/events");
        void reconcileQrAfterSave(saved, prevUrl, prevQr);
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

  const baseEvents = filter === "quiz-incomplete" && quizIncompleteBase ? quizIncompleteBase : initialEvents;

  const needsQuiz = (e: EventRecord) => {
    const sub = subtypeById.get(e.event_subtypes_id);
    if (sub?.behavior !== "quiz") return false;
    const { total, target } = getQuizStatus(e.id, quizCategories, quizQuestions);
    return total < target;
  };

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
  const activeFilterCount = (catFilter !== "all" ? 1 : 0) + quickFilters.size;
  const clearAllFilters = () => { setCatFilter("all"); setQuickFilters(new Set()); setSearchQuery(""); };

  const dayGroups: { date: string; events: EventRecord[] }[] = [];
  for (const e of visibleEvents) {
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === e.date) last.events.push(e);
    else dayGroups.push({ date: e.date, events: [e] });
  }

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
          "relative flex w-full items-center gap-3 rounded-2xl border bg-white py-3 pr-3 pl-4 text-left transition hover:shadow-md active:scale-[0.99] sm:gap-4 sm:py-4 sm:pr-4 sm:pl-5",
          isTonight ? "border-[#FF6B35] ring-1 ring-[#FF6B35]/40" : "border-[#E6DFC8]",
          inactive && "opacity-60"
        )}
      >
        <span className="absolute top-3 bottom-3 left-0 w-1 rounded-full bg-(--spine)" />

        {isTonight && (
          <span className="absolute -top-2 left-3 z-1 inline-flex h-4.75 items-center gap-1 rounded-full bg-[#FF6B35] px-2 font-black text-[9px] tracking-wide text-white uppercase shadow">
            <Flame className="h-2.5 w-2.5" /> Tonight
          </span>
        )}

        <div className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border sm:h-12 sm:w-12", badgeClass)}>
          <span className="font-black text-[9px] leading-none tracking-tighter uppercase">{monthAbbrOf(event.date)}</span>
          <span className="font-black text-base leading-none sm:text-lg">{dayNumOf(event.date)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {sub && <span className={cn("rounded px-1.5 py-0.5 font-black text-[9px] tracking-wide uppercase", badgeClass)}>{toTitleCase(sub.name)}</span>}
            {inactive && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-black text-[9px] tracking-wide text-gray-500 uppercase">Inactive</span>}
            {quizStat && !quizStat.allComplete && (
              <span className="inline-flex items-center gap-0.5">
                <span className="font-black text-[9px] text-[#5F624F]">Qz</span>
                {quizStat.someExist
                  ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  : <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
              </span>
            )}
          </div>
          <p className={cn("truncate font-black text-sm leading-tight sm:text-base lg:text-lg", inactive ? "text-[#5F624F]" : "text-[#1F1F1A]")}>
            {event.title || "Untitled Event"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] font-semibold text-[#5F624F] sm:text-[13px] lg:text-sm">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {formatTime(event.start_time)}{event.end_time ? `–${formatTime(event.end_time)}` : ""}
            </span>
            {host && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-grid h-4.25 w-4.25 place-items-center rounded-full bg-(--spine) font-black text-[8.5px] text-white">
                  {host.full_name[0]}
                </span>
                {shortHost(host.full_name)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {(event.is_bookable || bStats.confirmedPeople > 0) && (
            <span className="inline-flex items-center gap-1 font-black text-xs text-[#5F624F] tabular-nums sm:text-sm">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{bStats.confirmedPeople}
            </span>
          )}
          {hasPricing && <span className="font-black text-[11px] text-green-700 sm:text-xs lg:text-sm">£{event.payment_amount!.toFixed(2)}</span>}
          {event.is_fully_booked && <span className="rounded bg-red-50 px-1.5 py-0.5 font-black text-[9px] tracking-wide text-red-600 uppercase">Full</span>}
          <ChevronRight className="h-4 w-4 text-[#5F624F] opacity-40" />
        </div>
      </button>
    );
  };

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
          "flex w-full min-w-0 flex-col gap-0 overflow-hidden rounded-md border px-1 py-0.5 text-left transition hover:brightness-95 sm:flex-row sm:items-center sm:gap-1 lg:gap-1.5 lg:px-1.5",
          badgeClass,
          inactive && "line-through opacity-50",
        )}
      >
        {event.start_time && (
          <span className="shrink-0 font-black text-[8px] leading-tight tabular-nums sm:text-[10px] lg:text-[11px]">{formatTime(event.start_time)}</span>
        )}
        <span className="min-w-0 truncate text-[9px] leading-tight font-bold sm:text-[10px] lg:text-[11px]">{event.title || "Untitled"}</span>
      </button>
    );
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;
  const selectedSubtype = subtypeById.get(Number(formSubtypeId));
  const selectedTypeForForm = typeById.get(Number(formTypeId));
  const formSubtypeOptions = subtypesByType.get(Number(formTypeId)) ?? [];

  const fieldErrors: Record<string, string> = {};
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
      "mx-auto space-y-3 bg-[#F7F4EA] px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6",
      viewMode === "calendar"
        ? "sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-368 2xl:max-w-432"
        : "sm:max-w-2xl md:max-w-3xl lg:max-w-5xl"
    )}>

      {filter === "quiz-incomplete" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="font-black text-[11px] tracking-wide text-amber-700 uppercase">
            Upcoming quizzes with incomplete questions
          </p>
          <Link href="/event-setups/events" className="shrink-0 font-black text-[11px] tracking-wide text-amber-700 uppercase underline">
            Clear
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center rounded-xl border border-[#E6DFC8] bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            title="List view"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-black text-[10px] tracking-wide uppercase transition-colors sm:px-3",
              viewMode === "list" ? "bg-[#5C4033] text-white" : "text-[#5F624F] hover:text-[#5C4033]"
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            aria-pressed={viewMode === "calendar"}
            title="Calendar view"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-black text-[10px] tracking-wide uppercase transition-colors sm:px-3",
              viewMode === "calendar" ? "bg-[#5C4033] text-white" : "text-[#5F624F] hover:text-[#5C4033]"
            )}
          >
            <Grid2X2 className="h-3.5 w-3.5" /> Calendar
          </button>
        </div>

        <button
          type="button"
          onClick={() => openAdd()}
          title="New Event"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1B4332] px-3 text-white transition-colors hover:bg-[#1B4332]/85"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="font-black text-[10px] tracking-widest uppercase">New</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E6DFC8] bg-white px-3 transition-colors focus-within:border-[#5C4033]">
          <Search className="h-4 w-4 shrink-0 text-[#5F624F]/50" />
          <input
            type="text"
            placeholder="Search title, date or host..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
          />
          {isSearching && (
            <button type="button" onClick={() => setSearchQuery("")} className="-mr-1 shrink-0 rounded-md p-1 transition-colors hover:bg-[#E6DFC8]" title="Clear search">
              <X className="h-3.5 w-3.5 text-[#5F624F]/50" />
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
            "inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border font-black text-[11px] tracking-widest uppercase transition-colors sm:w-auto sm:px-4",
            showFilters || activeFilterCount > 0
              ? "border-[#5C4033] bg-[#5C4033] text-white"
              : "border-[#E6DFC8] bg-white text-[#5F624F] hover:text-[#5C4033]"
          )}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 font-black text-[9px] text-[#5C4033] tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
      <div className="space-y-2 pt-1 pb-1">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCatFilter("all")}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 font-black text-[10px] tracking-wide uppercase transition-colors",
              catFilter === "all" ? "border-[#5C4033] bg-[#5C4033] text-white" : "border-[#E6DFC8] bg-white text-[#5F624F]"
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
                  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 font-black text-[10px] tracking-wide uppercase transition-colors",
                  sel ? "border-[#5C4033] bg-[#5C4033] text-white" : cn(badgeClassFromColor(type.color), "rounded-full")
                )}
              >
                {toTitleCase(type.name)} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setSortSoon((s) => !s)}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-[#E6DFC8] bg-[#EFE8D4] px-2.5 font-black text-[9px] tracking-wide text-[#5C4033] uppercase"
          >
            <ArrowDownUp className="h-3 w-3" /> {sortSoon ? "Soonest" : "Latest"}
          </button>
          <span className="h-4 w-px shrink-0 bg-[#E6DFC8]" />
          {QUICK_FILTERS.map((q) => {
            const on = quickFilters.has(q.key);
            return (
              <button
                key={q.key}
                type="button"
                onClick={() => toggleQuickFilter(q.key)}
                className={cn(
                  "h-7 shrink-0 rounded-full border px-3 font-black text-[9px] tracking-wide uppercase transition-colors",
                  on ? "border-[#5C4033] bg-[#5C4033] text-white" : "border-[#E6DFC8] bg-white text-[#5F624F]"
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {viewMode === "list" && anyFilterActive && (
        <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-[#5F624F]">
          <b className="font-black text-[13px] text-[#1F1F1A]">{visibleEvents.length}</b>
          event{visibleEvents.length === 1 ? "" : "s"}
          {catFilter !== "all" && (
            <> in <span className="font-black text-[#5C4033]">{toTitleCase(typeById.get(catFilter)?.name)}</span></>
          )}
          <button type="button" onClick={clearAllFilters} className="ml-auto font-black text-[10px] tracking-wide text-[#5C4033] uppercase underline">
            Clear all
          </button>
        </div>
      )}

      {viewMode === "calendar" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} title="Previous month" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6DFC8] bg-white text-[#5C4033] transition-colors hover:bg-[#EFE8D4]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} title="Next month" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6DFC8] bg-white text-[#5C4033] transition-colors hover:bg-[#EFE8D4]">
              <ChevronRight className="h-4 w-4" />
            </button>
            <h3 className="font-black text-sm tracking-tight text-[#1F1F1A] uppercase sm:text-base">{calMonthLabel}</h3>
            <button type="button" onClick={goToday} className="ml-auto h-9 rounded-xl border border-[#E6DFC8] bg-[#EFE8D4] px-3 font-black text-[10px] tracking-wide text-[#5C4033] uppercase transition-colors hover:bg-[#E6DFC8]">
              Today
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 lg:gap-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-center font-black text-[9px] tracking-wide text-[#5F624F] uppercase sm:text-[11px] lg:text-xs">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 lg:gap-2">
            {calendarCells.map((dateStr, i) => {
              if (!dateStr) return <div key={`blank-${i}`} className="h-32 rounded-xl border border-transparent bg-[#F0EDE0]/50 sm:h-36 lg:h-44" />;
              const dayEvents = eventsByDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const MAX = 4;
              const laid = layoutDayByTime(dayEvents);
              const shown = laid.slice(0, MAX);
              const extra = laid.length - shown.length;
              return (
                <div key={dateStr} className={cn("relative h-32 overflow-hidden rounded-xl border bg-white sm:h-36 lg:h-44", isToday ? "border-[#FF6B35] ring-1 ring-[#FF6B35]/40" : "border-[#E6DFC8]")}>
                  <div className="flex items-center justify-between px-1 pt-1">
                    <span className={cn("font-black text-[10px] tabular-nums sm:text-xs lg:text-sm", isToday ? "text-[#FF6B35]" : "text-[#5F624F]")}>{Number(dateStr.slice(-2))}</span>
                    {dayEvents.length > 0 && <span className="font-black text-[8px] text-[#5F624F]/60 tabular-nums sm:text-[9px]">{dayEvents.length}</span>}
                  </div>
                  <div className="absolute inset-x-0 top-5 bottom-1 lg:top-6">
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
                      <button type="button" onClick={() => openView(laid[MAX].event)} className="absolute right-1 bottom-0 rounded bg-[#F7F4EA] px-1 font-black text-[8px] tracking-wide text-[#5C4033] uppercase sm:text-[9px] lg:text-[10px]">
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
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
          <p className="font-black text-sm text-[#1F1F1A]">
            {filter === "quiz-incomplete" ? "No upcoming quizzes with incomplete questions" : "Nothing matches"}
          </p>
          <p className="mt-1 text-[11px] text-[#5F624F]">
            {filter === "quiz-incomplete"
              ? "All quiz questions are complete"
              : anyFilterActive ? "No events with these filters" : "No events for the selected dates"}
          </p>
          {anyFilterActive && filter !== "quiz-incomplete" && (
            <button type="button" onClick={clearAllFilters} className="mt-3 font-black text-[11px] tracking-wide text-[#5C4033] uppercase underline">
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          {dayGroups.map((group) => (
            <section key={group.date} className="space-y-1.5 sm:space-y-2">
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-[#F7F4EA] py-1.5">
                <span className="font-black text-[11px] tracking-wide text-[#5C4033] uppercase sm:text-xs lg:text-sm">{relativeDayOf(group.date, todayStr)}</span>
                <span className="h-px flex-1 bg-[#E6DFC8]" />
                <span className="text-[10px] font-bold text-[#5F624F] sm:text-[11px] lg:text-xs">{weekdayOf(group.date)} {dayNumOf(group.date)} {monthAbbrOf(group.date)}</span>
              </div>
              {group.events.map((event) => renderEventRow(event))}
            </section>
          ))}
        </div>
      )}

      <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto
            sm:max-h-[80vh] sm:w-140 sm:-translate-x-1/2
            sm:rounded-4xl sm:border-2 lg:max-h-[90vh] lg:w-6xl xl:w-7xl"
        >
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#1F1F1A] uppercase">
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
                  <div className="mt-1 flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-[#5F624F]" />
                    <span className="font-black text-xs tracking-wide text-[#5F624F] uppercase tabular-nums">ID: {selected.id}</span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <span className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 font-black text-[10px]",
                  selected.is_active !== false ? "border-green-300 bg-green-100 text-green-700" : "border-red-300 bg-red-100 text-red-600"
                )}>
                  {selected.is_active !== false ? "Active" : "Inactive"}
                </span>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">

            {!showForm && selected && (() => {
              const sub = subtypeById.get(selected.event_subtypes_id);
              const type = typeById.get(selected.event_types_id);
              const hasPricing = !!selected.payment_amount && selected.payment_amount > 0;
              const host = employees.find((e) => e.id === selected.host_employee_id);
              const isQuiz = sub?.behavior === "quiz";
              const bk = getBookingStats(selected.id, bookings);
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
              const returnHref = `/event-setups/events?open=${selected.id}`;
              const viewAllHref = `${baseViewAllHref}${baseViewAllHref.includes("?") ? "&" : "?"}from=${encodeURIComponent(returnHref)}`;
              return (
                <div className="animate-in grid-cols-2 items-start gap-5 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid lg:space-y-0">
                  <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                    <button type="button" onClick={() => setDetailsOpen(o => !o)} className="flex w-full items-center justify-between bg-[#E6DFC8] px-4 py-3 text-left transition-colors hover:bg-[#DDD4B8] sm:px-5">
                      <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">Event Details</span>
                      <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", detailsOpen && "rotate-180")} />
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
                      <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                        <button type="button" onClick={() => setQuizOpen(o => !o)} className="flex w-full items-center justify-between bg-[#E6DFC8] px-4 py-3 text-left transition-colors hover:bg-[#DDD4B8] sm:px-5">
                          <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">Quiz Questions</span>
                          <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", quizOpen && "rotate-180")} />
                        </button>
                        {quizOpen && (
                          <>
                            <div className="space-y-2 px-4 py-2.5 sm:px-5">
                              {categoryCounts.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-[#1F1F1A] sm:text-sm">{cat.category_name}</span>
                                  <div className="flex items-center gap-1.5">
                                    {cat.count >= cat.question_count ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : cat.count > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                                    <span className="font-black text-xs text-[#5F624F] tabular-nums sm:text-sm">{cat.count} / {cat.question_count}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="border-t border-[#E6DFC8] px-4 py-2.5 sm:px-5">
                              <Link href={`/event-setups/events/${selected.id}`} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#5C4033] text-white transition-colors hover:bg-[#5C4033]/85" title="Manage Quiz">
                                <Brain className="h-3.5 w-3.5" />
                                <span className="font-black text-[9px] tracking-wide uppercase">Manage Quiz</span>
                              </Link>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {selected.is_bookable && <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                    <button type="button" onClick={() => setBookingsOpen(o => !o)} className="flex w-full items-center justify-between bg-[#E6DFC8] px-4 py-3 text-left transition-colors hover:bg-[#DDD4B8] sm:px-5">
                      <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">Bookings</span>
                      <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", bookingsOpen && "rotate-180")} />
                    </button>
                    {bookingsOpen && (
                      <>
                        <DetailCell label="Fully Booked" toggle={!!selected.is_fully_booked} />
                        {type?.name === "games" && (
                          <DetailCell label="Winning Team" value={selected.booking_id ? `#${selected.booking_id}: ${selected.group_name || "Unnamed"}` : "—"} />
                        )}
                        <div className="grid grid-cols-3 divide-x divide-[#E6DFC8]/50">
                          <div className="px-2 py-2 text-center sm:px-3">
                            <p className="font-black text-base leading-tight text-green-600 tabular-nums sm:text-lg">{bk.confirmedPeople}</p>
                            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase sm:text-[9px]">Confirmed</p>
                          </div>
                          <div className="px-2 py-2 text-center sm:px-3">
                            <p className="font-black text-base leading-tight text-amber-500 tabular-nums sm:text-lg">{bk.waitlistedPeople}</p>
                            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase sm:text-[9px]">Waitlisted</p>
                          </div>
                          <div className="px-2 py-2 text-center sm:px-3">
                            <p className="font-black text-base leading-tight text-red-500 tabular-nums sm:text-lg">{bk.cancelledPeople}</p>
                            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase sm:text-[9px]">Cancelled</p>
                          </div>
                        </div>
                        <div className="border-t border-[#E6DFC8] px-4 py-2.5 sm:px-5">
                          <Link href={viewAllHref} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#5C4033] text-white transition-colors hover:bg-[#5C4033]/85">
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-black text-[9px] tracking-wide uppercase">View All</span>
                          </Link>
                        </div>
                        {selected.seating_required && (
                          <div className="border-t border-[#E6DFC8] px-4 py-2.5 sm:px-5">
                            <Link href={`/settings/floor-plan/${selected.id}`} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[#E6DFC8] bg-white text-[#5C4033] transition-colors hover:bg-[#F7F4EA]">
                              <Grid2X2 className="h-3.5 w-3.5" />
                              <span className="font-black text-[9px] tracking-wide uppercase">Floor plan layout calculator</span>
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>}

                  <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                    <button type="button" onClick={() => setBookingSettingsOpen(o => !o)} className="flex w-full items-center justify-between bg-[#E6DFC8] px-4 py-3 text-left transition-colors hover:bg-[#DDD4B8] sm:px-5">
                      <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">Public Booking Settings</span>
                      <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", bookingSettingsOpen && "rotate-180")} />
                    </button>
                    {bookingSettingsOpen && (
                      <>
                        <DetailCell label="Public Booking" toggle={!!selected.is_bookable} />

                        {selected.is_bookable && (
                          <div className="border-t border-[#E6DFC8] px-4 py-3 sm:px-5">
                            <div className="mb-2 flex items-center gap-1.5">
                              <Link2 className="h-3.5 w-3.5 text-[#5F624F]" />
                              <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Shareable Booking Link</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 truncate rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-[11px] font-bold text-[#26300D]">
                                {selected.booking_page_url ?? (typeof window !== "undefined" ? `${window.location.origin}/book/event/${selected.id}` : `/book/event/${selected.id}`)}
                              </code>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                                const url = selected.booking_page_url ?? `${window.location.origin}/book/event/${selected.id}`;
                                navigator.clipboard.writeText(url);
                                setLinkCopied(true);
                                setTimeout(() => setLinkCopied(false), 2000);
                              }}>
                                {linkCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-[#5F624F]" />}
                              </Button>
                            </div>

                            <div className="mt-3 border-t border-[#E6DFC8] pt-3">
                              <div className="mb-2 flex items-center gap-1.5">
                                <QrCode className="h-3.5 w-3.5 text-[#5F624F]" />
                                <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Booking QR Code</span>
                              </div>
                              {selected.booking_qr_url ? (
                                <div className="flex items-start gap-3">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={selected.booking_qr_url} alt="Booking link QR code" className="h-28 w-28 shrink-0 rounded-lg border border-[#E6DFC8] bg-white p-1.5" />
                                  <div className="flex flex-col gap-2">
                                    <button type="button" onClick={copyQr} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6DFC8] bg-white px-3 font-black text-[10px] tracking-wide text-[#5C4033] uppercase transition-colors hover:bg-[#F0EDE0]">
                                      {qrCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                      {qrCopied ? "Copied" : "Copy QR"}
                                    </button>
                                    <button type="button" onClick={generateQr} disabled={qrBusy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6DFC8] bg-white px-3 font-black text-[10px] tracking-wide text-[#5C4033] uppercase transition-colors hover:bg-[#F0EDE0] disabled:opacity-50">
                                      {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                                      Regenerate
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" onClick={generateQr} disabled={qrBusy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1B4332] px-4 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85 disabled:opacity-50">
                                  {qrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                                  Generate QR Code
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {selected.is_bookable && (
                          <div className="border-t border-[#E6DFC8]">
                            <button type="button" onClick={() => setBookingPageOpen(o => !o)} className="flex w-full items-center justify-between bg-[#E6DFC8]/60 px-4 py-3 text-left transition-colors hover:bg-[#E6DFC8]/80 sm:px-5">
                              <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">Booking Page</span>
                              <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", bookingPageOpen && "rotate-180")} />
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

            {showForm && (
              <form id="event-form" action={handleSubmit} className="animate-in grid-cols-2 items-start gap-5 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid lg:space-y-0">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
                <input type="hidden" name="seating_required" value={formSeating ? "on" : ""} />
                <input type="hidden" name="is_active" value={formActive ? "on" : ""} />
                <input type="hidden" name="is_fully_booked" value={formFullyBooked ? "on" : ""} />
                <input type="hidden" name="is_bookable" value={formIsBookable ? "on" : ""} />

                <FormSection title="Details" open={formDetailsOpen} onToggle={() => setFormDetailsOpen((o) => !o)}>
                  <FormRow label="Event Type" required error={fieldErrors.event_types_id}>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                      <select
                        title="Event Type"
                        name="event_types_id"
                        value={formTypeId}
                        onChange={(e) => onSelectType(e.target.value)}
                        className="min-w-0 cursor-pointer appearance-none bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none [text-align-last:right] sm:text-sm"
                      >
                        {eventTypes.map((t) => (
                          <option key={t.id} value={t.id}>{toTitleCase(t.name)}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#5F624F]" />
                    </div>
                  </FormRow>

                  <FormRow label="Sub-Type" required error={fieldErrors.event_subtypes_id}>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                      <select
                        title="Sub-Type"
                        name="event_subtypes_id"
                        value={formSubtypeId}
                        onChange={(e) => onSelectSubtype(e.target.value)}
                        className="min-w-0 cursor-pointer appearance-none bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none [text-align-last:right] sm:text-sm"
                      >
                        <option value="" disabled>Select a sub-type...</option>
                        {formSubtypeOptions.map((s) => (
                          <option key={s.id} value={s.id}>{toTitleCase(s.name)}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#5F624F]" />
                    </div>
                  </FormRow>

                  <FormRow label="Title" required error={fieldErrors.title}>
                    <input
                      name="title"
                      placeholder="e.g. Music Bingo"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <FormRow label="Date" required error={fieldErrors.date}>
                    <div className="flex flex-1 items-center justify-end">
                      <input title="Date" name="date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="bg-transparent font-black text-xs text-[#1F1F1A] outline-none sm:text-sm" />
                    </div>
                  </FormRow>

                  <FormRow label="Time" required error={fieldErrors.time}>
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <input title="Start time" name="start_time" type="time" value={formStartTime} onChange={(e) => { const v = e.target.value; setFormStartTime(v); if (v && !formEndTime) { const end = addHoursToTime(v, 2); if (end) setFormEndTime(end); } }} className="w-22 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none sm:text-sm" />
                      <span className="text-xs text-[#5F624F]/50">-</span>
                      <input title="End time" name="end_time" type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="w-22 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none sm:text-sm" />
                    </div>
                  </FormRow>

                  {selectedSubtype?.host_required && (
                    <FormRow label="Host" warning={fieldWarnings.host_employee_id}>
                      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                        <select title="Host" name="host_employee_id" value={formHostId} onChange={(e) => setFormHostId(e.target.value)} className="min-w-0 cursor-pointer appearance-none bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none [text-align-last:right] sm:text-sm">
                          <option value="">No host</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>{e.full_name}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#5F624F]" />
                      </div>
                    </FormRow>
                  )}

                  <FormRow label="Payment (£)" warning={fieldWarnings.payment_amount}>
                    <input name="payment_amount" type="number" min="0" step="0.01" placeholder="0.00" value={formPayment} onChange={(e) => setFormPayment(e.target.value)} className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
                  </FormRow>

                  <div className="px-4 py-2.5 sm:px-5 sm:py-4">
                    <div className="mb-2 flex items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
                      <span className="font-black text-[10px] tracking-wide uppercase">Tagline</span>
                    </div>
                    <textarea name="tagline" placeholder="Brief tagline for the event..." rows={2} value={formTagline} onChange={(e) => setFormTagline(e.target.value)} className="w-full resize-none bg-transparent font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
                  </div>

                  <div className="px-4 py-2.5 sm:px-5 sm:py-4">
                    <div className="mb-2 flex items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
                      <span className="font-black text-[10px] tracking-wide uppercase">Poster Image</span>
                    </div>
                    <input type="hidden" name="image_url" value={formImageUrl} />
                    {formImageUrl ? (
                      <div className="relative overflow-hidden rounded-xl border border-[#E6DFC8]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={formImageUrl} alt="Event poster" className="max-h-50 w-full bg-[#F7F4EA] object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormImageUrl("")}
                          title="Remove poster image"
                          aria-label="Remove poster image"
                          className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E6DFC8] bg-[#F7F4EA] py-7 transition-colors hover:border-[#5C4033]">
                        {imageUploading ? <Loader2 className="h-7 w-7 animate-spin text-[#5F624F]" /> : <Upload className="h-7 w-7 text-[#5F624F] opacity-50" />}
                        <span className="font-black text-[11px] tracking-wide text-[#5C4033] uppercase">{imageUploading ? "Uploading…" : "Upload"}</span>
                        <span className="text-[10px] text-[#5F624F]">Shown on the public What&apos;s On card</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
                      </label>
                    )}
                  </div>

                  <FormRow label="External Link">
                    <input name="external_link" type="url" placeholder="https://instagram.com/..." defaultValue={formDefault?.external_link ?? ""} className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
                  </FormRow>

                  {selectedSubtype?.behavior === "karaoke" && (
                    <FormRow label="Singa Link" warning={fieldWarnings.karaoke_request_url}>
                      <input name="karaoke_request_url" type="url" placeholder="https://app.singa.com/..." value={formKaraokeUrl} onChange={(e) => setFormKaraokeUrl(e.target.value)} className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
                    </FormRow>
                  )}

                </FormSection>

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

                  {formIsBookable && (
                    <>
                      <FormRow label="Fully Booked">
                        <span className="flex-1" />
                        <FormToggle label="Fully booked" on={formFullyBooked} onToggle={() => setFormFullyBooked((o) => !o)} danger />
                      </FormRow>

                      <FormRow label="Booking URL" required error={fieldErrors.booking_page_url}>
                        <input name="booking_page_url" type="url" placeholder="https://..." value={formBookingPageUrl} onChange={(e) => { setFormBookingPageUrl(e.target.value); setBookingUrlManual(true); }} className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
                      </FormRow>

                      {selectedTypeForForm?.name === "games" && (() => {
                        const eventBookings = formDefault ? bookings.filter(b => b.event_id === formDefault.id && b.status !== "cancelled") : [];
                        return (
                          <>
                            <FormRow label="Linked Booking">
                              <input type="hidden" name="booking_id" value={formBookingId} />
                              <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
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
                                      setFormGroupName("");
                                    }
                                  }}
                                  className="min-w-0 cursor-pointer appearance-none bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none [text-align-last:right] sm:text-sm"
                                >
                                  <option value="">No booking</option>
                                  {eventBookings.map(b => (
                                    <option key={b.id} value={b.id}>#{b.id} — {b.group_name || "Unnamed"}</option>
                                  ))}
                                </select>
                                <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#5F624F]" />
                              </div>
                            </FormRow>
                            <FormRow label="Group Name">
                              <input type="hidden" name="group_name" value={formGroupName} />
                              <input value={formGroupName} onChange={(e) => setFormGroupName(e.target.value)} placeholder="e.g. The Brainiacs" className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
                            </FormRow>
                          </>
                        );
                      })()}
                    </>
                  )}
                </FormSection>
                </div>

                {formIsBookable && (
                  <div className="lg:col-span-2">
                    <input type="hidden" name="booking_config" value={JSON.stringify(formBookingConfig)} />
                    <BookingConfigEditor value={formBookingConfig} onChange={setFormBookingConfig} />
                  </div>
                )}

                {formIsBookable && selectedTypeForForm?.booking_grouping === "per_event" && (
                  <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white lg:col-span-2">
                    <div className="bg-[#E6DFC8]/60 px-4 py-2.5 sm:px-5 sm:py-3">
                      <span className="font-black text-[11px] tracking-wide text-[#26300D] uppercase">Booking Card</span>
                    </div>
                    <div className="px-4 pt-2.5 sm:px-5">
                      <p className="text-[10px] leading-relaxed text-[#5F624F]">Shown on the public booking hub card. Blank fields fall back to the title, a calendar icon, and the auto badge.</p>
                    </div>
                    <FormRow label="Card Title">
                      <input name="booking_card_title" placeholder="e.g. Music Bingo" value={formCardTitle} onChange={(e) => setFormCardTitle(e.target.value)} className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
                    </FormRow>
                    <div className="px-4 py-2.5 sm:px-5 sm:py-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
                        <span className="font-black text-[10px] tracking-wide uppercase">Card Tagline</span>
                      </div>
                      <textarea name="booking_card_tagline" placeholder="Short line shown under the title..." rows={2} value={formCardTagline} onChange={(e) => setFormCardTagline(e.target.value)} className="w-full resize-none bg-transparent font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
                    </div>
                    <FormRow label="Card Badge">
                      <input name="booking_card_badge" placeholder="e.g. Thursdays, Book Now" value={formCardBadge} onChange={(e) => setFormCardBadge(e.target.value)} className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm" />
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

          <div className="z-40 shrink-0 rounded-b-4xl border-t-2 border-[#E6DFC8] bg-white/80 px-6 py-5 pb-10 backdrop-blur-md sm:pb-5">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="ghost" onClick={handleDelete} disabled={isPending} className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 font-black text-[10px] tracking-wide text-red-500 uppercase hover:border-red-200 hover:bg-red-50">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
                <Button onClick={openEdit} className="h-14 flex-1 rounded-2xl bg-[#B45309] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#B45309]/85 active:scale-95">
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" onClick={() => { setFormError(null); if (isAdding) closeSheet(); else setIsEditing(false); }} disabled={isPending} className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  Cancel
                </Button>
                <Button type="button" disabled={isPending || hasFieldErrors || imageUploading} title={hasFieldErrors ? "Resolve the highlighted fields before saving" : undefined} onClick={() => { const form = document.getElementById('event-form') as HTMLFormElement | null; if (form) form.requestSubmit(); }} className="h-14 rounded-2xl bg-[#1B4332] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95 disabled:pointer-events-none disabled:opacity-50">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save</>}
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
  const message = error ?? warning;
  const isWarning = !error && !!warning;
  return (
    <div className="px-4 py-2.5 sm:px-5 sm:py-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={cn("flex shrink-0 items-center gap-1.5 sm:gap-2", error ? "text-red-600 opacity-100" : warning ? "text-amber-600 opacity-100" : "text-[#5F624F] opacity-60")}>
          <span className="font-black text-[10px] tracking-wide whitespace-nowrap uppercase">{label}</span>
          {required && <span className="font-black text-[10px] text-red-500">*</span>}
        </div>
        {children}
      </div>
      {message && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-[11px] leading-snug font-bold", isWarning ? "text-amber-600" : "text-red-600")}>
          {isWarning ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
          {message}
        </p>
      )}
    </div>
  );
}

function DetailCell({ label, value, icon, toggle, accent }: { label: string; value?: string; icon?: React.ReactNode; toggle?: boolean; accent?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#E6DFC8] px-4 py-2.5 last:border-0 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        {icon}
        <span className="font-black text-[10px] tracking-wide whitespace-nowrap uppercase">{label}</span>
      </div>
      {toggle !== undefined ? (
        <span className="flex flex-1 justify-end">
          <ToggleSlider on={toggle} />
        </span>
      ) : (
        <span className={cn("flex-1 text-right font-black text-xs leading-snug sm:text-sm", accent ?? "text-[#1F1F1A]")}>{value}</span>
      )}
    </div>
  );
}

function ToggleSlider({ on, danger }: { on: boolean; danger?: boolean }) {
  return (
    <span
      role="img"
      aria-label={on ? "On" : "Off"}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        on ? (danger ? "bg-red-600" : "bg-green-600") : "bg-[#5F624F]/25"
      )}
    >
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-4.5" : "translate-x-0.5")} />
    </span>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <p className="text-sm leading-snug font-bold text-red-700">{message}</p>
    </div>
  );
}

function FormSection({ title, open, onToggle, children, className }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white", className)}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between bg-[#E6DFC8] px-4 py-3 text-left transition-colors hover:bg-[#DDD4B8] sm:px-5">
        <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div className={cn("divide-y divide-[#E6DFC8]/50", !open && "hidden")}>{children}</div>
    </div>
  );
}

function FormToggle({ on, onToggle, danger, label }: { on: boolean; onToggle: () => void; danger?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        on ? (danger ? "border-red-700 bg-red-600" : "border-green-600 bg-green-500") : "border-[#5F624F]/30 bg-[#5F624F]/20"
      )}
    >
      <span className={cn("absolute top-1/2 left-0 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform", on ? "translate-x-5.25" : "translate-x-0.5")} />
    </button>
  );
}
