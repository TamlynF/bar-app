"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
  Flame,
  ArrowDownUp,
  Grid2X2,
  SlidersHorizontal,
  QrCode,
  Upload,
  Info,
  ExternalLink,
  CopyPlus,
  CornerDownRight,
  HelpCircle,
  Undo2,
  MoreVertical,
  Ban,
  Trophy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import QRCode from "qrcode";
import { createBrowserClient } from "@supabase/ssr";
import { saveEventAction, deleteEventAction, setEventQr, setEventActiveAction } from "./actions";
import { setEventWinner } from "../quiz-leaderboards/actions";
import { DatePicker, dateRangeLabel, type DateRange } from "./month-picker";
import { cn } from "@/lib/utils";
import { resolveEventImage, type EventImageSource } from "@/lib/event-image";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { badgeClassFromColor, badgeSelectedClassFromColor, swatchHexFromColor } from "@/lib/event-type-colors";
import { findActiveEventClashes, isOvernightEnd } from "@/lib/event-form-validation";
import { parseTimeToMinutes, addHoursToTime } from "@/lib/event-clash";
import { BookingConfigEditor } from "@/components/booking-config-editor";
import { IconPicker } from "@/components/icon-picker";
import type { BookingConfig } from "@/lib/booking-config";
import type { EventBehavior } from "@/lib/event-behavior";
import {
  eventCreationMethodLabel,
  eventCreationSourceHref,
  eventCreationSourceLabel,
} from "@/lib/event-creation";

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
  default_image_url: string | null;
};

export type LinkedRequest = { kind: "band" | "private"; id: string };

export type EventRecord = {
  id: number;
  created_at?: string;
  created_by?: number | null;
  updated_at?: string | null;
  updated_by?: number | null;
  creation_method?: string | null;
  creation_source_id?: string | null;
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
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "-";
  return timeStr.substring(0, 5);
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function SheetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 pt-0.5 font-bold text-[12px] text-[#5E6654]">
        {label}
      </span>
      <span className="text-right text-[13px] font-semibold text-[#20231A]">{value || "-"}</span>
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* Month cells render at most this many chips before falling back to "+n more". */
const DAY_CHIP_LIMIT = 4;

const SHEET_PILL =
  "inline-flex h-6.5 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold tracking-wide sm:h-8 sm:gap-2 sm:px-3.5 sm:text-[12px]";

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

/* "Saturday 8 August", or Today/Tomorrow/Yesterday with the date appended. */
function fullDayLabel(dateStr: string, todayStr: string) {
  const d = parseDate(dateStr);
  const dated = `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
  const relative = relativeDayOf(dateStr, todayStr);
  return relative === "Today" || relative === "Tomorrow" || relative === "Yesterday"
    ? `${relative} · ${dated}`
    : dated;
}

function shortHost(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0].length > 6 ? parts[0].slice(0, 6) : parts[0];
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0]}.` : first;
}

export type Employee = { id: number; full_name: string };

type EventLinkOrigin = "sheet" | "list";
type QuizCategory = { id: number; category_name: string; question_count: number; short_name?: string; order_no: number };
type QuizQuestion = { id: string; events_id: number; quiz_category_configs_id: number | null };
type BookingRecord = { id: number; event_id: number; status: string; group_size: number; group_name: string | null };

/* These are read once per row and the list can run to hundreds of rows, so they
   take a pre-grouped slice rather than re-scanning every booking and every quiz
   question for each event - see bookingStatsByEvent / quizStatusByEvent below. */
type BookingStats = ReturnType<typeof computeBookingStats>;
type QuizStatus = ReturnType<typeof computeQuizStatus>;

function computeBookingStats(eventBookings: BookingRecord[]) {
  let confirmedCount = 0;
  let confirmedPeople = 0;
  let waitlistedCount = 0;
  let waitlistedPeople = 0;
  let cancelledCount = 0;
  let cancelledPeople = 0;

  for (const b of eventBookings) {
    const size = b.group_size ?? 0;
    if (b.status === "confirmed") {
      confirmedCount++;
      confirmedPeople += size;
    } else if (b.status === "waitlisted") {
      waitlistedCount++;
      waitlistedPeople += size;
    } else if (b.status === "cancelled") {
      cancelledCount++;
      cancelledPeople += size;
    }
  }

  return {
    confirmedCount,
    confirmedPeople,
    waitlistedCount,
    waitlistedPeople,
    cancelledCount,
    cancelledPeople,
    totalPeople: confirmedPeople,
  };
}

const EMPTY_BOOKING_STATS: BookingStats = computeBookingStats([]);

function computeQuizStatus(
  quizCategories: QuizCategory[],
  countsByCategory?: Map<number, number>
) {
  const categoryCounts = quizCategories.map((cat) => ({
    ...cat,
    count: countsByCategory?.get(cat.id) ?? 0,
  }));
  const total = categoryCounts.reduce((s, c) => s + c.count, 0);
  const target = categoryCounts.reduce((s, c) => s + c.question_count, 0);
  const allComplete = categoryCounts.every((c) => c.count >= c.question_count);
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
  actCoverByEvent = {},
  linkedRequestByEvent = {},
  winnerByEvent = {},
  venueCapacity = null,
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
  actCoverByEvent?: Record<number, string>;
  linkedRequestByEvent?: Record<number, LinkedRequest>;
  /** Winning booking per event, from the recorded quiz results. */
  winnerByEvent?: Record<number, number>;
  /** Venue-wide seat count from company_information; null when it isn't configured. */
  venueCapacity?: number | null;
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
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [catFilters, setCatFilters] = useState<Set<number>>(new Set());
  const [subFilters, setSubFilters] = useState<Set<number>>(new Set());
  const [issuesEvent, setIssuesEvent] = useState<EventRecord | null>(null);
  const [sortSoon, setSortSoon] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showFilters, setShowFilters] = useState(!!initialQuick);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
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
  const [formDateOpen, setFormDateOpen] = useState(false);
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formHostId, setFormHostId] = useState<string>("");
  const [formTagline, setFormTagline] = useState<string>("");
  const [formExternalLink, setFormExternalLink] = useState<string>("");
  const [copySourceId, setCopySourceId] = useState<number | null>(null);
  const [sysInfoOpen, setSysInfoOpen] = useState(false);
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

  /* Grouped once per data change instead of per row. Every row used to filter
     the whole bookings array four times and the whole questions array once more
     per category, so any state change - opening the detail sheet included - had
     to re-scan the entire dataset before the page could paint again. */
  const bookingStatsByEvent = useMemo(() => {
    const grouped = new Map<number, BookingRecord[]>();
    for (const b of bookings) {
      const list = grouped.get(b.event_id);
      if (list) list.push(b);
      else grouped.set(b.event_id, [b]);
    }
    const stats = new Map<number, BookingStats>();
    for (const [eventId, list] of grouped) stats.set(eventId, computeBookingStats(list));
    return stats;
  }, [bookings]);

  const quizStatusByEvent = useMemo(() => {
    const counts = new Map<number, Map<number, number>>();
    for (const q of quizQuestions) {
      if (q.quiz_category_configs_id == null) continue;
      let byCategory = counts.get(q.events_id);
      if (!byCategory) {
        byCategory = new Map();
        counts.set(q.events_id, byCategory);
      }
      byCategory.set(
        q.quiz_category_configs_id,
        (byCategory.get(q.quiz_category_configs_id) ?? 0) + 1
      );
    }
    const status = new Map<number, QuizStatus>();
    for (const [eventId, byCategory] of counts) {
      status.set(eventId, computeQuizStatus(quizCategories, byCategory));
    }
    return status;
  }, [quizQuestions, quizCategories]);

  const emptyQuizStatus = useMemo(() => computeQuizStatus(quizCategories), [quizCategories]);

  const bookingStatsFor = (eventId: number) =>
    bookingStatsByEvent.get(eventId) ?? EMPTY_BOOKING_STATS;
  const quizStatusFor = (eventId: number) => quizStatusByEvent.get(eventId) ?? emptyQuizStatus;

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
    // "open" and "focus" stay in the URL for as long as they describe what you
    // are looking at, so the browser's back button restores the same view.
    const focusId = searchParams.get("focus") || params.get("focus");
    if (focusId) {
      const focusEvent = initialEvents.find((e) => String(e.id) === focusId);
      if (focusEvent) setFocusedId(focusEvent.id);
    }
    const openId = searchParams.get("open") || params.get("open");
    if (!openId) return;
    const event = initialEvents.find((e) => String(e.id) === openId);
    if (event) {
      setSelected(event);
      setIsEditing(false);
      setIsAdding(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (focusedId == null) return;
    document
      .querySelector(`[data-event-row="${focusedId}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusedId]);

  // Dropping a category takes its subtypes with it, so a subtype can never be
  // left filtering for a category that is no longer chosen.
  const toggleCatFilter = (id: number) =>
    setCatFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSubFilters((subs) => {
          const kept = new Set(
            [...subs].filter((subId) => {
              const sub = eventSubtypes.find((s) => s.id === subId);
              return sub ? next.has(sub.event_types_id) : false;
            })
          );
          return kept;
        });
      } else {
        next.add(id);
      }
      return next;
    });

  const toggleSubFilter = (id: number) =>
    setSubFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

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
    setCopySourceId(null);
    setFocusedId(null);
    setSelected(event);
    window.history.replaceState(null, "", `/event-setups/events?open=${event.id}`);
  };

  const openAdd = (subtypeId?: number, date?: string) => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setCopySourceId(null);
    const sub = subtypeId ? subtypeById.get(subtypeId) : undefined;
    const ownerType = sub ? typeById.get(sub.event_types_id) : (eventTypes[0] ? typeById.get(eventTypes[0].id) : undefined);
    setFormTypeId(sub ? String(sub.event_types_id) : (eventTypes[0]?.id ? String(eventTypes[0].id) : ""));
    setFormSubtypeId(sub ? String(sub.id) : "");
    setFormDate(date ?? "");
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
    setFormExternalLink("");
    setFormActive(true);
    setFormFullyBooked(false);
    setFormDetailsOpen(true);
    setFormSettingsOpen(true);
    applySubtypeDefaults(sub, ownerType);
    setIsAdding(true);
  };

  const openCopy = (source: EventRecord) => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setCopySourceId(source.id);
    const ownerType = typeById.get(source.event_types_id);
    setFormTypeId(String(source.event_types_id));
    setFormSubtypeId(String(source.event_subtypes_id));
    setFormTitle(source.title ?? "");
    setFormTagline(source.tagline ?? "");
    setFormSeating(source.seating_required ?? true);
    setFormPayment(source.payment_amount != null ? String(source.payment_amount) : "");
    setFormHostId(source.host_employee_id ? String(source.host_employee_id) : "");
    setFormExternalLink(source.external_link ?? "");
    setFormImageUrl(source.image_url ?? "");
    setFormIsBookable(!!source.is_bookable);
    setFormBookingConfig(source.booking_config ?? {});
    setFormCardTitle(source.booking_card_title ?? "");
    setFormCardTagline(source.booking_card_tagline ?? "");
    setFormCardIcon(source.booking_card_icon ?? null);
    setFormCardBadge(source.booking_card_badge ?? "");
    setFormBookingPageUrl(
      source.is_bookable
        ? bookingUrlFor({
            typeId: source.event_types_id,
            subtypeId: source.event_subtypes_id,
            grouping: ownerType?.booking_grouping,
            eventId: null,
          })
        : ""
    );
    setBookingUrlManual(false);
    setFormDate("");
    setFormStartTime("");
    setFormEndTime("");
    setFormKaraokeUrl("");
    setFormBookingId("");
    setFormGroupName("");
    setFormActive(true);
    setFormFullyBooked(false);
    setFormDetailsOpen(true);
    setFormSettingsOpen(true);
    setIsAdding(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setFormError(null);
    setCopySourceId(null);
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
    setFormExternalLink(selected.external_link ?? "");
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
    setCopySourceId(null);
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
        window.history.replaceState(null, "", `/event-setups/events?open=${saved.id}`);
        void reconcileQrAfterSave(saved, prevUrl, prevQr);
      } else {
        closeSheet();
      }
    });
  };

  const deleteEvent = async (
    event: EventRecord,
    onError: (message: string) => void,
    onDeleted?: () => void,
  ) => {
    const ok = await confirm({
      title: "Delete event",
      description: `Delete "${event.title || "Untitled Event"}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteEventAction(event.id);
      if (result?.error) {
        onError(result.error);
      } else {
        onDeleted?.();
      }
    });
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteEvent(selected, setFormError, closeSheet);
  };

  const handleRowDelete = (event: EventRecord) =>
    void deleteEvent(event, (message) => toast.error(message), () => {
      toast.success("Event deleted");
      if (selected?.id === event.id) closeSheet();
    });

  const toggleEventActive = (event: EventRecord) => {
    const nextActive = event.is_active === false;
    startTransition(async () => {
      const result = await setEventActiveAction(event.id, nextActive);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(nextActive ? "Event activated" : "Event deactivated");
        setSelected((cur) => (cur && cur.id === event.id ? { ...cur, is_active: nextActive } : cur));
      }
    });
  };

  // Where the breadcrumb and the back arrow land you: the sheet you came from,
  // or the list row you came from.
  const listReturnHref = (eventId: number, origin: EventLinkOrigin) =>
    origin === "sheet" ? `/event-setups/events?open=${eventId}` : `/event-setups/events?focus=${eventId}`;

  // Leaving the list from a row menu stamps that row on the current history
  // entry, so browser-back lands on the list with the row still highlighted.
  const navigateFromRow = (event: EventRecord, href: string) => {
    window.history.replaceState(null, "", listReturnHref(event.id, "list"));
    router.push(href);
  };

  const quizHrefFor = (event: EventRecord, origin: EventLinkOrigin) =>
    `/event-setups/events/${event.id}?back=${encodeURIComponent(listReturnHref(event.id, origin))}`;

  const bookingsHrefFor = (event: EventRecord, origin: EventLinkOrigin) => {
    const params = new URLSearchParams({ back: listReturnHref(event.id, origin) });
    if (event.title) params.set("title", event.title);
    return `/event-bookings/event/${event.id}?${params.toString()}`;
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const employeeById = new Map(employees.map((e) => [e.id, e.full_name]));

  const canCopy = (e: EventRecord) => !linkedRequestByEvent[e.id];

  const matchesFilters = (e: EventRecord) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const host = e.host_employee_id ? (employeeById.get(e.host_employee_id) ?? "") : "";
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
        const { total, target } = quizStatusFor(e.id);
        return total < target;
      })
    : null;

  const baseEvents = filter === "quiz-incomplete" && quizIncompleteBase ? quizIncompleteBase : initialEvents;

  const needsQuiz = (e: EventRecord) => {
    const sub = subtypeById.get(e.event_subtypes_id);
    if (sub?.behavior !== "quiz") return false;
    const { total, target } = quizStatusFor(e.id);
    return total < target;
  };

  // A quiz can only have a winner once it has been played, so tonight's quiz is
  // pickable but not yet overdue.
  const isPlayedQuiz = (e: EventRecord) =>
    subtypeById.get(e.event_subtypes_id)?.behavior === "quiz" && !!e.date && e.date <= todayStr;

  const needsWinner = (e: EventRecord) =>
    isPlayedQuiz(e) && !!e.date && e.date < todayStr && !winnerByEvent[e.id];

  const confirmedTeams = (eventId: number) =>
    bookings.filter((b) => b.event_id === eventId && b.status === "confirmed");

  const teamLabel = (bookingId: number) =>
    bookings.find((b) => b.id === bookingId)?.group_name?.trim() || `#${bookingId}`;

  const chooseWinner = (event: EventRecord, bookingId: number | null) => {
    startTransition(async () => {
      const result = await setEventWinner(String(event.id), bookingId ? String(bookingId) : null);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(bookingId ? "Winner saved" : "Winner cleared");
      router.refresh();
    });
  };

  // Everything wrong with one event, in the words you would use to fix it. The
  // same list drives the row's warning icon, its count and the dialog.
  const eventIssues = (e: EventRecord): string[] => {
    const sub = subtypeById.get(e.event_subtypes_id);
    const past = !!e.date && e.date < todayStr;
    const issues: string[] = [];

    if (!e.title?.trim()) issues.push("No title has been set.");
    if (!e.date) issues.push("No date has been set.");
    if (!e.start_time || !e.end_time) issues.push("The start or end time is missing.");
    if (e.is_bookable && !e.booking_page_url?.trim()) {
      issues.push("Public booking is switched on but there is no booking URL.");
    }
    if (sub?.payment_required && !(e.payment_amount != null && e.payment_amount > 0)) {
      issues.push("This event type takes payment but no amount has been set.");
    }
    if (sub?.host_required && !e.host_employee_id) {
      issues.push("This event type needs a host and none has been chosen.");
    }
    if (sub?.behavior === "karaoke" && !e.karaoke_request_url?.trim()) {
      issues.push("Karaoke night with no Singa request link.");
    }
    if (!past && needsQuiz(e)) {
      const { total, target } = quizStatusFor(e.id);
      issues.push(`Quiz questions are incomplete - ${total} of ${target} written.`);
    }
    if (needsWinner(e)) {
      issues.push("No winning team has been recorded for this quiz.");
    }
    if (past && e.is_active !== false) {
      issues.push("This event has already happened but is still marked active.");
    }

    return issues;
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
    { key: "bookings", label: "Has bookings", test: (e) => bookingStatsFor(e.id).confirmedPeople > 0 },
    { key: "under-10", label: "< 10 bookings", test: (e) => e.is_bookable === true && bookingStatsFor(e.id).confirmedPeople < 10 },
    { key: "quiz", label: "Needs quiz", test: needsQuiz },
    { key: "needs-winner", label: "Needs winner", test: needsWinner },
    { key: "active", label: "Active only", test: (e) => e.is_active !== false },
    { key: "fully-booked", label: "Fully booked", test: (e) => e.is_fully_booked === true },
    { key: "missing-info", label: "Missing info", test: missingInfo },
    { key: "upcoming", label: "Upcoming", test: (e) => e.date >= todayStr },
    { key: "historic", label: "Historic", test: (e) => e.date < todayStr },
  ];

  const passesQuick = (e: EventRecord) =>
    [...quickFilters].every((k) => QUICK_FILTERS.find((q) => q.key === k)!.test(e));

  const chipBase = baseEvents.filter((e) => matchesFilters(e) && passesQuick(e));
  const typeCounts = new Map<number, number>();
  for (const e of chipBase) typeCounts.set(e.event_types_id, (typeCounts.get(e.event_types_id) ?? 0) + 1);
  const chipTypes = [...eventTypes]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ type: t, count: typeCounts.get(t.id) ?? 0 }));

  const passesCat = (e: EventRecord) => {
    if (catFilters.size > 0 && !catFilters.has(e.event_types_id)) return false;
    if (subFilters.size > 0 && !subFilters.has(e.event_subtypes_id)) return false;
    return true;
  };

  // Only the chosen categories offer their subtypes, and the counts come from
  // the same pool the category chips are counted against.
  const subChips = eventSubtypes
    .filter((s) => catFilters.has(s.event_types_id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const subCounts = new Map<number, number>();
  for (const e of chipBase) {
    if (!catFilters.has(e.event_types_id)) continue;
    subCounts.set(e.event_subtypes_id, (subCounts.get(e.event_subtypes_id) ?? 0) + 1);
  }
  const subChipTotal = [...subCounts.values()].reduce((sum, n) => sum + n, 0);

  const visibleEvents = baseEvents
    .filter((e) => matchesFilters(e) && passesQuick(e) && passesCat(e))
    .sort((a, b) => {
      const cmp = (a.date ?? "").localeCompare(b.date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? "");
      return sortSoon ? cmp : -cmp;
    });

  const anyFilterActive = isSearching || catFilters.size > 0 || subFilters.size > 0 || quickFilters.size > 0;
  const activeFilterCount = catFilters.size + subFilters.size + quickFilters.size;
  const clearAllFilters = () => {
    setCatFilters(new Set());
    setSubFilters(new Set());
    setQuickFilters(new Set());
    setSearchQuery("");
  };

  const dayGroups: { date: string; events: EventRecord[] }[] = [];
  for (const e of visibleEvents) {
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === e.date) last.events.push(e);
    else dayGroups.push({ date: e.date, events: [e] });
  }

  const matchesSearchOnly = (e: EventRecord) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const host = e.host_employee_id ? (employeeById.get(e.host_employee_id) ?? "") : "";
    return `${e.title ?? ""} ${formatDate(e.date)} ${e.date ?? ""} ${host}`.toLowerCase().includes(q);
  };
  const eventsByDate = new Map<string, EventRecord[]>();
  for (const e of baseEvents) {
    if (!e.date) continue;
    if (!(matchesSearchOnly(e) && passesQuick(e) && passesCat(e))) continue;
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
  const weekCells: string[] = (() => {
    const start = parseDate(selectedCalendarDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return format(d, "yyyy-MM-dd");
    });
  })();
  const isWeekView = calendarView === "week";
  const gridCells: (string | null)[] = isWeekView ? weekCells : calendarCells;
  const gridRowCount = isWeekView ? 1 : calendarCells.length / 7;
  const weekLabel = (() => {
    const first = weekCells[0];
    const last = weekCells[6];
    const sameMonth = first.slice(0, 7) === last.slice(0, 7);
    const head = `${dayNumOf(first)}${sameMonth ? "" : ` ${monthAbbrOf(first)}`}`;
    return `${head} – ${dayNumOf(last)} ${monthAbbrOf(last)} ${last.slice(0, 4)}`;
  })();
  const periodLabel = isWeekView ? weekLabel : calMonthLabel;
  const shiftMonth = (delta: number) => {
    const d = new Date(calendarMonth.year, calendarMonth.month + delta, 1);
    setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedCalendarDate(format(d, "yyyy-MM-dd"));
  };
  const shiftWeek = (delta: number) => {
    const d = parseDate(selectedCalendarDate);
    d.setDate(d.getDate() + delta * 7);
    setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedCalendarDate(format(d, "yyyy-MM-dd"));
  };
  const shiftPeriod = (delta: number) => (isWeekView ? shiftWeek(delta) : shiftMonth(delta));
  const goToday = () => {
    const n = new Date();
    setCalendarMonth({ year: n.getFullYear(), month: n.getMonth() });
    setSelectedCalendarDate(format(n, "yyyy-MM-dd"));
  };
  // What the filter bar is currently showing, spelled out. The calendar counts
  // the period on screen; the list counts everything the filters let through.
  const calendarPeriodCount = gridCells.reduce(
    (total, date) => total + (date ? (eventsByDate.get(date)?.length ?? 0) : 0),
    0
  );
  const filterSummaryCount = viewMode === "calendar" ? calendarPeriodCount : visibleEvents.length;

  const filterSummaryParts: { prefix: string; label: string }[] = [];
  if (catFilters.size > 0) {
    filterSummaryParts.push({
      prefix: "in",
      label: chipTypes
        .filter(({ type }) => catFilters.has(type.id))
        .map(({ type }) => toTitleCase(type.name))
        .join(", "),
    });
  }
  if (isSearching) filterSummaryParts.push({ prefix: "matching", label: `"${searchQuery.trim()}"` });
  if (viewMode === "list" && dateRange?.start) {
    filterSummaryParts.push({ prefix: "", label: dateRangeLabel(dateRange) });
  }
  if (quickFilters.size > 0) {
    filterSummaryParts.push({
      prefix: "",
      label: QUICK_FILTERS.filter((q) => quickFilters.has(q.key)).map((q) => q.label).join(", "),
    });
  }
  if (viewMode === "list") {
    filterSummaryParts.push({ prefix: "sorted", label: sortSoon ? "soonest first" : "latest first" });
  }

  const selectedCalendarEvents = eventsByDate.get(selectedCalendarDate) ?? [];
  const selectedCalendarLabel = parseDate(selectedCalendarDate).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const renderEventRow = (event: EventRecord) => {
    const sub = subtypeById.get(event.event_subtypes_id);
    const type = typeById.get(event.event_types_id);
    const colorKey = sub?.color ?? type?.color ?? null;
    const accentHex = swatchHexFromColor(colorKey) ?? "#34451F";
    const badgeClass = badgeClassFromColor(colorKey);
    const host = employees.find((emp) => emp.id === event.host_employee_id);
    const isQuiz = sub?.behavior === "quiz";
    const quizStat = isQuiz ? quizStatusFor(event.id) : null;
    const canPickWinner = isPlayedQuiz(event);
    const winnerBookingId = winnerByEvent[event.id] ?? null;
    const eventTeams = canPickWinner ? confirmedTeams(event.id) : [];
    const bStats = bookingStatsFor(event.id);
    const inactive = event.is_active === false;
    const hasPricing = !!event.payment_amount && event.payment_amount > 0;
    const isTonight = event.date === todayStr && !inactive;

    const timeLabel = `${formatTime(event.start_time)}${event.end_time ? `–${formatTime(event.end_time)}` : ""}`;
    const showBooked = event.is_bookable || bStats.confirmedPeople > 0;
    const bookedNode = venueCapacity ? (
      <>
        <span className="font-semibold text-admin-ink">{bStats.confirmedPeople}</span>
        <span aria-hidden="true"> / </span>
        <span>{venueCapacity}</span> booked
      </>
    ) : (
      <>{bStats.confirmedPeople === 1 ? "1 booked" : `${bStats.confirmedPeople} booked`}</>
    );
    const bookedAria = venueCapacity
      ? `${bStats.confirmedPeople} of ${venueCapacity} booked`
      : `${bStats.confirmedPeople} booked`;
    const priceLabel = hasPricing ? `£${event.payment_amount!.toFixed(2)}` : null;

    // An event that has been and gone is a record, not a state to act on, so
    // its whole trailing group reads back in grey.
    const isPast = event.date < todayStr;
    const PILL = "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-semibold";
    const GREY = "bg-admin-surface text-admin-muted";

    // Warnings and the sold-out flag ride together in one column; whether the
    // event is on at all reads at the end of the row, next to its actions.
    // Once the night has passed there is no point writing its questions, so
    // only the winner is still worth chasing.
    const rowFlags = (
      <>
        {!isPast && quizStat && !quizStat.allComplete && (
          <span
            title={quizStat.someExist ? "Quiz questions incomplete" : "No quiz questions yet"}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-semibold",
              quizStat.someExist ? "bg-admin-warning-bg text-admin-warning" : "bg-admin-error-bg text-admin-error"
            )}
          >
            {quizStat.someExist ? <AlertTriangle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            Quiz
          </span>
        )}
        {needsWinner(event) && (
          <span
            title="No winning team recorded for this quiz"
            className="inline-flex shrink-0 items-center gap-1 rounded bg-admin-warning-bg px-1.5 py-0.5 text-[12px] font-semibold text-admin-warning"
          >
            <Trophy className="h-3 w-3" />
            Needs winner
          </span>
        )}
        {canPickWinner && winnerBookingId && (
          <span
            title={`Winner: ${teamLabel(winnerBookingId)}`}
            className="inline-flex max-w-24 shrink-0 items-center gap-1 rounded bg-admin-success-bg px-1.5 py-0.5 text-[12px] font-semibold text-admin-success"
          >
            <Trophy className="h-3 w-3 shrink-0" />
            <span className="truncate">{teamLabel(winnerBookingId)}</span>
          </span>
        )}
      </>
    );

    // Sold out is a problem whether or not the event is switched on, so it
    // pulls the status pill red with it.
    const activePill = (
      <span
        className={cn(
          PILL,
          isPast
            ? GREY
            : inactive || event.is_fully_booked
              ? "bg-admin-error-bg text-admin-error"
              : "bg-admin-success-bg text-admin-success"
        )}
      >
        {inactive ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
        {/* The tick or cross says it on its own where the card is one column
            wide; the word stays for screen readers and returns from sm up. */}
        <span className="max-sm:sr-only">{inactive ? "Inactive" : "Active"}</span>
      </span>
    );

    const fullPill = event.is_fully_booked && (
      <span
        title="This event is sold out"
        className={cn(PILL, isPast ? GREY : "bg-admin-error-bg text-admin-error")}
      >
        Full
      </span>
    );

    const historicPill = isPast && (
      <span title="This event has already taken place" className={cn(PILL, GREY)}>
        Historic
      </span>
    );

    const statusFlags = (
      <>
        {rowFlags}
        {activePill}
        {historicPill}
        {fullPill}
      </>
    );

    const issues = eventIssues(event);
    const issueLabel = `${issues.length} issue${issues.length === 1 ? "" : "s"}`;

    const rowMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={`More actions for ${event.title || "Untitled Event"}`}
            aria-label={`More actions for ${event.title || "Untitled Event"}`}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {issues.length > 0 && (
            <>
              <DropdownMenuItem onClick={() => setIssuesEvent(event)}>
                <HelpCircle className="h-4 w-4" />
                View {issueLabel}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {isQuiz && (
            <DropdownMenuItem onClick={() => navigateFromRow(event, quizHrefFor(event, "list"))}>
              <Brain className="h-4 w-4" />
              View quiz
            </DropdownMenuItem>
          )}
          {canPickWinner && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Trophy className="h-4 w-4" />
                {winnerBookingId ? "Change winner" : "Set winner"}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 w-56 overflow-y-auto">
                {eventTeams.length === 0 ? (
                  <DropdownMenuItem disabled>No confirmed teams</DropdownMenuItem>
                ) : (
                  eventTeams.map((team) => (
                    <DropdownMenuItem
                      key={team.id}
                      disabled={isPending}
                      onClick={() => chooseWinner(event, team.id)}
                    >
                      {team.id === winnerBookingId ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">{team.group_name?.trim() || `#${team.id}`}</span>
                    </DropdownMenuItem>
                  ))
                )}
                {winnerBookingId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isPending}
                      onClick={() => chooseWinner(event, null)}
                    >
                      <X className="h-4 w-4" />
                      Clear winner
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {event.is_bookable && (
            <DropdownMenuItem onClick={() => navigateFromRow(event, bookingsHrefFor(event, "list"))}>
              <Users className="h-4 w-4" />
              View bookings
            </DropdownMenuItem>
          )}
          {(isQuiz || event.is_bookable) && <DropdownMenuSeparator />}
          {canCopy(event) && (
            <DropdownMenuItem onClick={() => openCopy(event)}>
              <CopyPlus className="h-4 w-4" />
              Copy event
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={isPending} onClick={() => toggleEventActive(event)}>
            {inactive ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            {inactive ? "Activate event" : "Deactivate event"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => handleRowDelete(event)}>
            <Trash2 className="h-4 w-4" />
            Delete event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    return (
      <div
        key={event.id}
        data-event-row={event.id}
        style={{ "--spine": accentHex } as React.CSSProperties}
        className={cn(
          "group relative w-full rounded-xl border bg-admin-card text-left transition-colors",
          "pointer-fine:transition-shadow pointer-fine:hover:shadow-md",
          isTonight ? "border-[#FF6B35] ring-1 ring-[#FF6B35]/40" : "border-admin-line hover:border-admin-primary/40",
          inactive && "opacity-60",
          !inactive && isPast && "border-admin-line bg-admin-line",
          focusedId === event.id && "border-admin-primary bg-admin-primary-soft/40 ring-2 ring-admin-primary/30"
        )}
      >
        <button
          type="button"
          onClick={() => openView(event)}
          aria-label={`Open ${event.title || "Untitled Event"}`}
          className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none"
        />

        <span className="absolute top-2.5 bottom-2.5 left-0 w-1 rounded-full bg-(--spine)" aria-hidden="true" />

        {isTonight && (
          <span className="absolute -top-2 left-3 z-1 inline-flex h-4.75 items-center gap-1 rounded-full bg-[#FF6B35] px-2 text-[12px] font-semibold text-white shadow">
            <Flame className="h-2.5 w-2.5" /> Tonight
          </span>
        )}

        {/* Mobile: badge + status, title over two lines, then time / bookings / price */}
        <div className="flex items-start gap-2 py-2.5 pr-2 pl-4 sm:hidden">
          <div className="pointer-events-none min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
              {sub && <span className={cn("rounded px-1.5 py-0.5 text-[12px] font-semibold tracking-wide uppercase", badgeClass)}>{toTitleCase(sub.name)}</span>}
              {statusFlags}
            </div>
            <p className={cn("line-clamp-2 text-[15px] leading-snug font-bold", inactive ? "text-admin-muted" : "text-admin-ink")}>
              {event.title || "Untitled Event"}
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-admin-muted tabular-nums">{timeLabel}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] font-medium text-admin-muted">
              {showBooked && <span className="tabular-nums" aria-label={bookedAria}>{bookedNode}</span>}
              {showBooked && priceLabel && <span aria-hidden="true">·</span>}
              {priceLabel && <span className="tabular-nums">{priceLabel}</span>}
              {host && (showBooked || priceLabel) && <span aria-hidden="true">·</span>}
              {host && <span>{shortHost(host.full_name)}</span>}
            </p>
          </div>
          <ChevronRight className="pointer-events-none mt-8 h-4 w-4 shrink-0 text-admin-muted" />
        </div>

        {/* Anything above a phone gets one line: tag, title, status, host, time,
            bookings, price, menu, chevron. Fixed tracks rather than
            content-sized ones, so each column starts in the same place on every
            row - only the title gives up width. */}
        <div className="hidden min-h-12 grid-cols-[128px_minmax(0,1fr)_150px_96px_88px_96px_56px_196px_100px_72px] items-center gap-2.5 px-3 sm:grid">
          <div className="pointer-events-none min-w-0">
            {sub && (
              <span className={cn("inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[12px] font-semibold tracking-wide uppercase", badgeClass)}>
                {toTitleCase(sub.name)}
              </span>
            )}
          </div>

          <p className={cn("pointer-events-none min-w-0 truncate text-[15px] leading-snug font-bold", inactive ? "text-admin-muted" : "text-admin-ink")}>
            {event.title || "Untitled Event"}
          </p>

          {/* A fixed track, not a content-sized one - an "auto" column takes its
              width from that row's own pills, which is what left every warning
              starting somewhere different. */}
          <div className="pointer-events-none flex min-w-0 flex-wrap items-center gap-1.5">
            {rowFlags}
          </div>

          <div className="pointer-events-none min-w-0 text-[12px] font-medium text-admin-muted">
            {host && (
              <p className="flex items-center gap-1.5">
                <span className="inline-grid h-4.25 w-4.25 shrink-0 place-items-center rounded-full bg-(--spine) text-[12px] font-semibold text-white">
                  {host.full_name[0]}
                </span>
                <span className="truncate">{shortHost(host.full_name)}</span>
              </p>
            )}
          </div>

          <p className="pointer-events-none text-[12px] font-medium text-admin-muted tabular-nums">
            {timeLabel}
          </p>

          <p className="pointer-events-none text-[12px] font-medium text-admin-muted tabular-nums" aria-label={showBooked ? bookedAria : undefined}>
            {showBooked ? bookedNode : ""}
          </p>

          <p className="pointer-events-none text-[12px] font-medium text-admin-muted tabular-nums">
            {priceLabel ?? ""}
          </p>

          <div className="pointer-events-none flex min-w-0 items-center gap-1.5">
            {activePill}
            {historicPill}
            {fullPill}
          </div>

          <div className="relative z-2 flex min-w-0 items-center">
            {issues.length > 0 && (
              <button
                type="button"
                onClick={() => setIssuesEvent(event)}
                title={`${issueLabel} on this event`}
                aria-label={`View ${issueLabel} on ${event.title || "this event"}`}
                className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 text-admin-error transition-colors hover:bg-admin-error-bg"
              >
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="truncate text-[12px] font-semibold whitespace-nowrap">{issueLabel}</span>
              </button>
            )}
          </div>

          <div className="relative z-2 flex items-center justify-end gap-0.5">
            {rowMenu}
            <ChevronRight className="pointer-events-none h-4 w-4 shrink-0 text-admin-muted transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    );
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
          "flex w-full min-w-0 items-center gap-1 overflow-hidden rounded border px-1 py-px text-left transition hover:brightness-95",
          badgeClass,
          inactive && "line-through opacity-50",
        )}
      >
        {event.start_time && (
          <span className="shrink-0 font-bold text-[12px] leading-snug tabular-nums lg:text-[12px]">{formatTime(event.start_time)}</span>
        )}
        <span className="min-w-0 truncate text-[12px] leading-snug font-bold lg:text-[12px]">{event.title || "Untitled"}</span>
      </button>
    );
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;
  const selectedSubtype = subtypeById.get(Number(formSubtypeId));
  const sheetSubtypeLabel = toTitleCase(
    (isEditing ? selectedSubtype : selected ? subtypeById.get(selected.event_subtypes_id) : undefined)?.name
  );
  const sheetTitle = isAdding
    ? copySourceId ? "Copy Event" : "New Event"
    : `${isEditing ? "Edit" : "View"} ${sheetSubtypeLabel ? `${sheetSubtypeLabel} ` : ""}Event`;
  const selectedTypeForForm = typeById.get(Number(formTypeId));
  const formSubtypeOptions = subtypesByType.get(Number(formTypeId)) ?? [];

  const inheritedForForm = resolveEventImage({
    actCoverUrl: formDefault ? actCoverByEvent[formDefault.id] : undefined,
    subtypeDefaultUrl: selectedSubtype?.default_image_url,
  });

  const imageSourceLabel = (source: EventImageSource, subtypeName?: string | null) => {
    if (source === "act") return "Using the booked act's cover image";
    if (source === "subtype") return `Using the ${subtypeName ?? "sub-category"} default image`;
    return null;
  };

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

  const viewSubtype = !showForm && selected ? subtypeById.get(selected.event_subtypes_id) : undefined;
  const viewQuiz = !showForm && selected && viewSubtype?.behavior === "quiz"
    ? quizStatusFor(selected.id)
    : null;
  const viewQuizPct = viewQuiz && viewQuiz.target > 0 ? Math.round((viewQuiz.total / viewQuiz.target) * 100) : 0;

  return (
    <div className={cn(
      "mx-auto w-full max-w-352 space-y-3 bg-[#F4F1E8] px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6",
      viewMode === "calendar" &&
        "sm:flex sm:h-[calc(100dvh-7rem)] sm:flex-col md:h-[calc(100dvh-8.5rem)]"
    )}>

      {filter === "quiz-incomplete" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="font-bold text-[13px] text-amber-700">
            Upcoming quizzes with incomplete questions
          </p>
          <Link href="/event-setups/events" className="shrink-0 font-bold text-[13px] text-amber-700 underline">
            Clear
          </Link>
        </div>
      )}

      {/* Pinned, so the search, the date range and the filters stay reachable
          however far down the list you are. */}
      <div className="sticky top-0 z-30 shrink-0 rounded-2xl border border-[#D8D5C8] bg-admin-card/95 p-1.5 shadow-sm backdrop-blur sm:p-3">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Labels step aside on a phone - the toolbar is pinned, so it has to
            cost as little of the screen as it can. */}
        <div className="inline-flex items-center rounded-xl border border-admin-line bg-admin-surface p-0.5 sm:p-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            title="List view"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-all sm:px-3",
              viewMode === "list"
                ? "bg-admin-card text-admin-primary shadow-sm"
                : "text-admin-muted hover:bg-admin-card/60 hover:text-admin-ink"
            )}
          >
            <List className="h-4 w-4" /> <span className="hidden sm:inline">List</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            aria-pressed={viewMode === "calendar"}
            title="Calendar view"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-all sm:px-3",
              viewMode === "calendar"
                ? "bg-admin-card text-admin-primary shadow-sm"
                : "text-admin-muted hover:bg-admin-card/60 hover:text-admin-ink"
            )}
          >
            <Grid2X2 className="h-4 w-4" /> <span className="hidden sm:inline">Calendar</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => openAdd()}
          title="Add event"
          aria-label="Add event"
          className="order-2 ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#34451F] text-white shadow-sm transition-colors hover:bg-[#283719] sm:h-10 sm:w-auto sm:px-3 lg:order-3 lg:ml-0"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden text-[13px] font-semibold sm:inline">Add event</span>
        </button>

      <div className="order-3 flex w-full items-center gap-1.5 sm:gap-2 lg:order-2 lg:min-w-0 lg:flex-1">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-admin-line bg-admin-card px-2.5 transition-colors focus-within:border-admin-primary focus-within:ring-2 focus-within:ring-admin-gold/30 sm:h-11 sm:px-3">
          <Search className="h-4 w-4 shrink-0 text-[#5E6654]/50" />
          <input
            type="text"
            placeholder="Search events by title, date or host"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
          />
          {isSearching && (
            <button type="button" onClick={() => setSearchQuery("")} className="-mr-1 shrink-0 rounded-md p-1 transition-colors hover:bg-[#D8D5C8]" title="Clear search">
              <X className="h-3.5 w-3.5 text-[#5E6654]/50" />
            </button>
          )}
        </div>
        {viewMode === "list" && (
          <DatePicker value={dateRange} onChange={setDateRange} appearance="secondary" />
        )}
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          aria-pressed={showFilters}
          aria-expanded={showFilters}
          title={showFilters ? "Hide filters" : "Show filters"}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold transition-colors sm:h-11 sm:w-auto sm:px-4",
            showFilters || activeFilterCount > 0
              ? "border-admin-primary/30 bg-admin-primary-soft text-admin-primary"
              : "border-admin-line bg-admin-card text-admin-muted hover:border-admin-primary/40 hover:bg-admin-surface hover:text-admin-ink"
          )}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-admin-primary px-1.5 text-[11px] font-semibold text-white tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
      <div className="order-4 w-full space-y-1.5 border-t border-[#D8D5C8] pt-2 pb-0.5 sm:space-y-2 sm:pt-3">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCatFilters(new Set())}
            aria-pressed={catFilters.size === 0}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors sm:h-9 sm:px-3.5",
              catFilters.size === 0
                ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
                : "border-admin-line bg-admin-card text-admin-muted hover:bg-admin-surface hover:text-admin-ink"
            )}
          >
            {catFilters.size === 0 && <Check className="h-3.5 w-3.5" />}
            All <span className="opacity-70">{chipBase.length}</span>
          </button>
          {chipTypes.map(({ type, count }) => {
            const sel = catFilters.has(type.id);
            return (
              <button
                key={type.id}
                type="button"
                aria-pressed={sel}
                onClick={() => toggleCatFilter(type.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors sm:h-9 sm:px-3.5",
                  sel ? badgeSelectedClassFromColor(type.color) : badgeClassFromColor(type.color),
                  "rounded-full"
                )}
              >
                {sel && <Check className="h-3.5 w-3.5" />}
                {toTitleCase(type.name)} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Subtypes only appear once a category is chosen - "All" keeps every
            subtype of that category, or pick the ones you want. */}
        {subChips.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-admin-muted/60" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setSubFilters(new Set())}
              aria-pressed={subFilters.size === 0}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors sm:h-9 sm:px-3.5",
                subFilters.size === 0
                  ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
                  : "border-admin-line bg-admin-card text-admin-muted hover:bg-admin-surface hover:text-admin-ink"
              )}
            >
              {subFilters.size === 0 && <Check className="h-3.5 w-3.5" />}
              All subtypes <span className="opacity-70">{subChipTotal}</span>
            </button>
            {subChips.map((subtype) => {
              const sel = subFilters.has(subtype.id);
              return (
                <button
                  key={subtype.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => toggleSubFilter(subtype.id)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors sm:h-9 sm:px-3.5",
                    sel ? badgeSelectedClassFromColor(subtype.color) : badgeClassFromColor(subtype.color)
                  )}
                >
                  {sel && <Check className="h-3.5 w-3.5" />}
                  {toTitleCase(subtype.name)}{" "}
                  <span className="opacity-70">{subCounts.get(subtype.id) ?? 0}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* The calendar is laid out by date, so sorting has nothing to act on. */}
          {viewMode === "list" && (
            <>
              <button
                type="button"
                onClick={() => setSortSoon((s) => !s)}
                title={sortSoon ? "Sorted soonest first" : "Sorted latest first"}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-admin-line bg-admin-surface px-3 text-[12px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft sm:h-9"
              >
                <ArrowDownUp className="h-3.5 w-3.5" /> {sortSoon ? "Soonest" : "Latest"}
              </button>
              <span className="h-4 w-px shrink-0 bg-admin-line" />
            </>
          )}
          {QUICK_FILTERS.map((q) => {
            const on = quickFilters.has(q.key);
            return (
              <button
                key={q.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleQuickFilter(q.key)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors sm:h-9 sm:px-3.5",
                  on
                    ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
                    : "border-admin-line bg-admin-card text-admin-muted hover:bg-admin-surface hover:text-admin-ink"
                )}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {q.label}
              </button>
            );
          })}
        </div>
      </div>
      )}
      </div>
      </div>

      {anyFilterActive && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1 text-xs font-semibold text-[#5E6654]">
          <b className="font-bold text-[13px] text-[#20231A]">{filterSummaryCount}</b>
          event{filterSummaryCount === 1 ? "" : "s"}
          {filterSummaryParts.map((part) => (
            <span key={part.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-[#5E6654]/40">·</span>
              <span className="text-[#5E6654]">{part.prefix}</span>
              <span className="font-bold text-[#34451F]">{part.label}</span>
            </span>
          ))}
          <button type="button" onClick={clearAllFilters} className="ml-auto font-bold text-[12px] text-[#34451F] underline">
            Clear all
          </button>
        </div>
      )}

      {viewMode === "calendar" ? (
        <div className="space-y-3 sm:flex sm:min-h-0 sm:flex-1 sm:flex-col sm:space-y-2">
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-[#D8D5C8] bg-white px-3 py-2.5 shadow-sm">
            <button type="button" onClick={() => shiftPeriod(-1)} title={isWeekView ? "Previous week" : "Previous month"} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#34451F] transition-colors hover:bg-[#EFE8D4]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="min-w-0 flex-1 text-center font-bold text-sm tracking-tight text-[#20231A] sm:text-base">{periodLabel}</h3>
            <button type="button" onClick={() => shiftPeriod(1)} title={isWeekView ? "Next week" : "Next month"} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#34451F] transition-colors hover:bg-[#EFE8D4]">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="inline-flex shrink-0 items-center rounded-xl border border-[#D8D5C8] bg-white p-0.5">
              {(["month", "week"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCalendarView(v)}
                  aria-pressed={calendarView === v}
                  title={v === "month" ? "Month view" : "Week view"}
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg px-2.5 font-bold text-[12px] transition-colors sm:px-3 sm:text-[12px]",
                    calendarView === v ? "bg-[#34451F] text-white" : "text-[#5E6654] hover:text-[#34451F]"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <button type="button" onClick={goToday} className="h-9 shrink-0 rounded-xl border border-[#D8D5C8] bg-[#EFE8D4] px-2.5 font-bold text-[12px] text-[#34451F] transition-colors hover:bg-[#D8D5C8] sm:px-3 sm:text-[12px]">
              Today
            </button>
          </div>

          <div className="rounded-2xl border border-[#D8D5C8] bg-white p-2 shadow-sm sm:flex sm:min-h-0 sm:flex-1 sm:flex-col">
            <div className="grid shrink-0 grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-center font-bold text-[12px] text-[#5E6654] sm:text-[12px]">{w}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:hidden">
              {gridCells.map((dateStr, i) => {
                if (!dateStr) return <div key={`mobile-blank-${i}`} className="aspect-square" />;
                const dayEvents = eventsByDate.get(dateStr) ?? [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedCalendarDate;
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedCalendarDate(dateStr)}
                    aria-label={`${formatDate(dateStr)}, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl border text-xs font-bold tabular-nums transition-colors",
                      isSelected
                        ? "border-[#34451F] bg-[#34451F] text-white"
                        : isToday
                          ? "border-[#FF6B35] bg-[#FFF4EF] text-[#FF6B35]"
                          : "border-transparent text-[#20231A] hover:bg-[#F4F1E8]"
                    )}
                  >
                    {Number(dateStr.slice(-2))}
                    {dayEvents.length > 0 && (
                      <span className={cn("absolute bottom-1.5 h-1 w-1 rounded-full", isSelected ? "bg-white" : "bg-[#34451F]")} />
                    )}
                  </button>
                );
              })}
            </div>

            <div
              style={{ "--cal-rows": gridRowCount, "--cal-row-min": isWeekView ? "0px" : "5rem" } as React.CSSProperties}
              className="no-scrollbar mt-0.5 hidden min-h-0 flex-1 grid-cols-7 grid-rows-[repeat(var(--cal-rows),minmax(var(--cal-row-min),1fr))] gap-1 overflow-y-auto sm:grid"
            >
              {gridCells.map((dateStr, i) => {
                if (!dateStr) return <div key={`blank-${i}`} className="rounded-lg bg-[#F4F1E8]/70" />;
                const dayEvents = eventsByDate.get(dateStr) ?? [];
                const isToday = dateStr === todayStr;
                const isWeekend = [0, 6].includes(parseDate(dateStr).getDay());
                const shown = isWeekView ? dayEvents : dayEvents.slice(0, DAY_CHIP_LIMIT);
                const extra = dayEvents.length - shown.length;
                return (
                  <div key={dateStr} className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border p-1", isToday ? "border-[#FF6B35] bg-[#FFF9F6] ring-1 ring-[#FF6B35]/30" : isWeekend ? "border-[#D8D5C8] bg-[#FCFAF4]" : "border-[#D8D5C8] bg-white")}>
                    <div className="mb-0.5 flex shrink-0 items-center justify-between gap-1">
                      <span className={cn("inline-grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 font-bold text-[13px] tabular-nums", isToday ? "bg-[#FF6B35] text-white" : "text-[#5E6654]")}>{Number(dateStr.slice(-2))}</span>
                      {dayEvents.length > 0 && <span className="font-bold text-[12px] text-[#5E6654]/60 tabular-nums">{dayEvents.length}</span>}
                    </div>
                    <div className="no-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                      {shown.map((event) => <div key={event.id}>{renderCalendarChip(event)}</div>)}
                    </div>
                    {extra > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title={`Show all ${dayEvents.length} events on ${formatDate(dateStr)}`}
                            className="mt-0.5 shrink-0 rounded px-1 py-px text-left font-bold text-[12px] text-[#34451F] transition-colors hover:bg-[#E5EBD8]"
                          >
                            +{extra} more
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-60 rounded-xl border border-[#D8D5C8] bg-white p-2">
                          <p className="mb-1.5 px-1 font-bold text-[12px] text-[#5E6654]">{formatDate(dateStr)}</p>
                          <div className="max-h-72 space-y-0.5 overflow-y-auto">
                            {dayEvents.map((event) => <div key={event.id}>{renderCalendarChip(event)}</div>)}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <section className="space-y-2 sm:hidden">
            <div className="flex items-center gap-2 px-1 py-1">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-[#20231A]">{selectedCalendarLabel}</p>
                <p className="text-[13px] font-semibold text-[#5E6654]">{selectedCalendarEvents.length} event{selectedCalendarEvents.length === 1 ? "" : "s"}</p>
              </div>
              <button type="button" onClick={() => openAdd(undefined, selectedCalendarDate)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#D8D5C8] bg-white px-3 font-bold text-[12px] text-[#34451F]">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {selectedCalendarEvents.length > 0 ? (
              selectedCalendarEvents.map((event) => renderEventRow(event))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#D8D5C8] bg-white/40 px-4 py-8 text-center">
                <CalendarDays className="mx-auto mb-2 h-6 w-6 text-[#5E6654]/35" />
                <p className="text-xs font-bold text-[#5E6654]">No events scheduled for this day</p>
              </div>
            )}
          </section>
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D5C8] py-14 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[#5E6654] opacity-30" />
          <p className="font-bold text-sm text-[#20231A]">
            {filter === "quiz-incomplete" ? "No upcoming quizzes with incomplete questions" : "Nothing matches"}
          </p>
          <p className="mt-1 text-[13px] text-[#5E6654]">
            {filter === "quiz-incomplete"
              ? "All quiz questions are complete"
              : anyFilterActive ? "No events with these filters" : "No events for the selected dates"}
          </p>
          {anyFilterActive && filter !== "quiz-incomplete" && (
            <button type="button" onClick={clearAllFilters} className="mt-3 font-bold text-[13px] text-[#34451F] underline">
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1 sm:space-y-1.5">
          {dayGroups.map((group) => (
            <section key={group.date} className="space-y-1">
              {/* The date rides in a chip rather than a banded header, so a day
                  costs one line; today's chip picks up the Tonight colour so
                  the eye lands on it. */}
              <div className="flex items-center gap-2 pt-2 pb-0.5">
                <h2
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
                    group.date === todayStr
                      ? "border-[#FF6B35]/40 bg-[#FF6B35]/10 text-[#FF6B35]"
                      : "border-admin-line bg-admin-card text-admin-primary"
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  {fullDayLabel(group.date, todayStr)}
                </h2>
                <span className="h-px flex-1 bg-admin-line" aria-hidden="true" />
                <span className="shrink-0 rounded-full bg-admin-surface px-2 py-0.5 text-[11px] font-medium text-admin-muted tabular-nums">
                  {group.events.length} event{group.events.length === 1 ? "" : "s"}
                </span>
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
          className={cn(
            "flex h-[92vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#D8D5C8] bg-[#F4F1E8] p-0 shadow-2xl outline-none sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto sm:max-h-[92vh] sm:w-3xl sm:max-w-[96vw] sm:-translate-x-1/2 sm:rounded-4xl sm:border-2 md:w-4xl lg:max-h-[94vh] lg:w-5xl xl:w-6xl",
            showForm && "lg:w-7xl xl:w-352"
          )}
        >
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#D8D5C8] bg-white/80 px-4 pt-3 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {!showForm && selected ? (
                  <>
                    <p className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                      {sheetSubtypeLabel ? `${sheetSubtypeLabel} event` : "Event"}
                      <span className="normal-case tabular-nums"> · #{selected.id}</span>
                    </p>
                    <SheetTitle className="mt-1 truncate text-xl leading-tight font-bold tracking-tight text-admin-ink">
                      {selected.title || "Untitled Event"}
                    </SheetTitle>
                    <p className="mt-1 text-[13px] leading-relaxed font-medium text-admin-muted sm:truncate">
                      {formatDate(selected.date)}
                      {(selected.start_time || selected.end_time) && (
                        <span className="tabular-nums"> · {formatTime(selected.start_time)} – {formatTime(selected.end_time)}</span>
                      )}
                    </p>
                  </>
                ) : (
                  <SheetTitle className="truncate font-bold text-lg leading-tight tracking-tighter text-[#20231A]">
                    {sheetTitle}
                    {selected && (
                      <span className="ml-1.5 text-[13px] font-semibold tracking-wide text-[#5E6654] normal-case italic tabular-nums">
                        (#ID : {selected.id})
                      </span>
                    )}
                  </SheetTitle>
                )}
                <SheetDescription className="sr-only">
                  {isAdding
                    ? copySourceId ? "Create a new event from a copy." : "Create a new event."
                    : isEditing ? "Edit this event's details." : "View this event's details."}
                </SheetDescription>
                {isAdding && copySourceId && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <CopyPlus className="h-3 w-3 text-[#5E6654]" />
                    <span className="text-[13px] font-medium text-[#5E6654] tabular-nums">Copied from #{copySourceId}</span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <div className="flex shrink-0 items-center gap-2">
                  <Popover open={sysInfoOpen} onOpenChange={setSysInfoOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Details"
                        title="Creation and modification details"
                        className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-admin-line bg-admin-surface px-2.5 text-admin-ink transition-colors hover:bg-admin-line sm:px-3"
                      >
                        <Info className="h-4.5 w-4.5 shrink-0" />
                        <span className="hidden font-bold text-[13px] sm:inline">System</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white p-0">
                      <span className="block border-b border-[#D8D5C8] bg-[#D8D5C8] px-4 py-2.5 font-bold text-[12px] text-[#34451F]">
                        System Information
                      </span>
                      <SheetRow label="Event ID" value={<span className="tabular-nums">#{selected.id}</span>} />
                      <SheetRow label="Creation Method" value={eventCreationMethodLabel(selected.creation_method)} />
                      {selected.creation_method && selected.creation_method !== "manual" && (
                        <SheetRow
                          label="Creation Source"
                          value={(() => {
                            const href = eventCreationSourceHref(selected.creation_method, selected.creation_source_id);
                            const label = eventCreationSourceLabel(selected.creation_method, selected.creation_source_id);
                            if (!href || !label) return null;
                            return (
                              <Link
                                href={href}
                                title={selected.creation_source_id ?? undefined}
                                className="group inline-flex items-center gap-1.5 font-bold text-[#34451F] tabular-nums hover:underline"
                              >
                                <Hash className="h-3 w-3 shrink-0" />
                                <span>{label}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                              </Link>
                            );
                          })()}
                        />
                      )}
                      <SheetRow label="Created" value={formatDateTime(selected.created_at)} />
                      <SheetRow label="Created By" value={selected.created_by ? (employeeById.get(selected.created_by) ?? "-") : "-"} />
                      <SheetRow label="Last Modified" value={formatDateTime(selected.updated_at)} />
                      <SheetRow label="Modified By" value={selected.updated_by ? (employeeById.get(selected.updated_by) ?? "-") : "-"} />
                    </PopoverContent>
                  </Popover>

                  {canCopy(selected) && (
                    <button
                      type="button"
                      onClick={() => openCopy(selected)}
                      aria-label="Copy this event"
                      title="Copy this event"
                      className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-admin-line bg-admin-card text-admin-primary transition-colors hover:border-admin-primary hover:bg-admin-primary-soft focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none sm:w-auto sm:px-3"
                    >
                      <CopyPlus className="h-4 w-4 shrink-0" />
                      <span className="hidden text-[13px] font-semibold sm:inline">Copy</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {selected && !isAdding && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={cn(
                  SHEET_PILL,
                  selected.is_active !== false
                    ? "border-admin-success/30 bg-admin-success-bg text-admin-success"
                    : "border-admin-error/30 bg-admin-error-bg text-admin-error"
                )}>
                  {selected.is_active !== false
                    ? <Check className="h-3.5 w-3.5 shrink-0" />
                    : <X className="h-3.5 w-3.5 shrink-0" />}
                  {selected.is_active !== false ? "Active" : "Inactive"}
                </span>
                {selected.is_bookable && (
                  <span className={cn(
                    SHEET_PILL,
                    selected.is_fully_booked
                      ? "border-admin-success/30 bg-admin-success-bg text-admin-success"
                      : "border-admin-line bg-admin-surface text-admin-muted"
                  )}>
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2", selected.is_fully_booked ? "bg-admin-success" : "bg-admin-muted/50")} />
                    {/* "Not sold out" is the longest label on the row and the
                        one saying nothing is wrong, so a phone gets the venue's
                        own shorthand for the same two states. */}
                    <span className="sm:hidden">{selected.is_fully_booked ? "Full" : "Open"}</span>
                    <span className="hidden sm:inline">
                      {selected.is_fully_booked ? "Sold out" : "Not sold out"}
                    </span>
                  </span>
                )}
                {!showForm && viewQuiz && viewQuiz.target > 0 && (
                  <Link
                    href={quizHrefFor(selected, "sheet")}
                    title="Go to the quiz questions"
                    className={cn(
                      SHEET_PILL,
                      "pr-1.5 transition-colors active:scale-[0.98] sm:hidden",
                      viewQuiz.allComplete
                        ? "border-admin-success/30 bg-admin-success-bg text-admin-success hover:bg-admin-success/15"
                        : "border-admin-warning/30 bg-admin-warning-bg text-admin-warning hover:bg-admin-warning/15"
                    )}
                  >
                    {viewQuiz.allComplete
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                    <span>Quiz</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  </Link>
                )}
                {/* Rides the status row at every width - a chip like the quiz
                    one, pushed hard right once there is room for it. */}
                {!showForm && (() => {
                  const issues = eventIssues(selected);
                  if (issues.length === 0) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => setIssuesEvent(selected)}
                      title={`View ${issues.length} issue${issues.length === 1 ? "" : "s"} on this event`}
                      className={cn(
                        SHEET_PILL,
                        "border-admin-error/30 bg-admin-error-bg pr-1.5 text-admin-error transition-colors hover:bg-admin-error/15 active:scale-[0.98] sm:ml-auto"
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {issues.length} {issues.length === 1 ? "Issue" : "Issues"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    </button>
                  );
                })()}
              </div>
            )}

            {!showForm && selected && viewQuiz && viewQuiz.target > 0 && (
              viewQuiz.allComplete ? (
                <div role="status" className="mt-2 hidden items-center gap-2.5 rounded-2xl border border-green-300 bg-green-50 px-3.5 py-2.5 sm:flex">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-green-600" />
                  <p className="min-w-0 text-[13px] leading-snug font-semibold text-green-700">
                    Quiz ready - all {viewQuiz.target} questions are written.
                  </p>
                </div>
              ) : (
                <div role="status" className="mt-2 hidden rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 sm:block">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 sm:flex-nowrap">
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-bold text-amber-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{viewQuiz.someExist ? "Quiz not finished" : "Quiz not started"}</span>
                        <span className="font-semibold text-amber-700/80 tabular-nums">
                          {viewQuiz.total} of {viewQuiz.target} questions
                        </span>
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-200/70">
                        <div
                          style={{ "--quiz-progress": `${viewQuizPct}%` } as React.CSSProperties}
                          className="h-full w-(--quiz-progress) rounded-full bg-amber-500 transition-all"
                        />
                      </div>
                    </div>
                    <Link
                      href={quizHrefFor(selected, "sheet")}
                      className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#34451F] px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#283719] sm:h-10 sm:w-auto"
                    >
                      <Brain className="h-4 w-4 shrink-0" />
                      {viewQuiz.someExist ? "Continue quiz" : "Start quiz"}
                    </Link>
                  </div>
                </div>
              )
            )}

          </div>

          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">

            {!showForm && selected && (() => {
              const sub = subtypeById.get(selected.event_subtypes_id);
              const type = typeById.get(selected.event_types_id);
              const hasPricing = !!selected.payment_amount && selected.payment_amount > 0;
              const host = employees.find((e) => e.id === selected.host_employee_id);
              const isQuiz = sub?.behavior === "quiz";
              const bk = bookingStatsFor(selected.id);
              const viewAllHref = bookingsHrefFor(selected, "sheet");
              const poster = resolveEventImage({
                eventImageUrl: selected.image_url,
                actCoverUrl: actCoverByEvent[selected.id],
                subtypeDefaultUrl: sub?.default_image_url,
              });
              const posterNote = imageSourceLabel(poster.source, sub?.name);
              const eventEndStamp = `${selected.date}T${(selected.end_time ?? selected.start_time ?? "23:59").slice(0, 5)}`;
              const eventHasPassed = new Date(eventEndStamp).getTime() < Date.now();
              const showWinningTeam = type?.name === "games" && (selected.booking_id != null || eventHasPassed);
              const bookingUrl = selected.booking_page_url ?? (typeof window !== "undefined" ? `${window.location.origin}/book/event/${selected.id}` : `/book/event/${selected.id}`);
              return (
                <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                  <div className="flex flex-col gap-4 sm:gap-5 md:flex-row md:items-start">
                    <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5 md:order-2">
                      {selected.is_bookable && (
                        <ViewSection
                          title="Bookings"
                          className="order-2 sm:order-none"
                          open={bookingsOpen}
                          onToggle={() => setBookingsOpen(o => !o)}
                          headerRight={
                            <span className="mr-2 shrink-0 font-bold text-[12px] text-[#5E6654] tabular-nums">
                              {bk.confirmedCount} {bk.confirmedCount === 1 ? "group" : "groups"}
                            </span>
                          }
                        >
                          <div className="grid grid-cols-3 divide-x divide-[#D8D5C8]/50 border-b border-[#D8D5C8]">
                            <div className="px-2 py-2 text-center sm:px-3">
                              <p className="font-bold text-base leading-tight text-green-600 tabular-nums sm:text-lg">{bk.confirmedPeople}</p>
                              <p className="font-bold text-[12px] text-[#5E6654]">Confirmed</p>
                            </div>
                            <div className="px-2 py-2 text-center sm:px-3">
                              <p className="font-bold text-base leading-tight text-amber-500 tabular-nums sm:text-lg">{bk.waitlistedPeople}</p>
                              <p className="font-bold text-[12px] text-[#5E6654]">Waitlisted</p>
                            </div>
                            <div className="px-2 py-2 text-center sm:px-3">
                              <p className="font-bold text-base leading-tight text-red-500 tabular-nums sm:text-lg">{bk.cancelledPeople}</p>
                              <p className="font-bold text-[12px] text-[#5E6654]">Cancelled</p>
                            </div>
                          </div>
                          {showWinningTeam && (
                            <DetailCell label="Winning Team" value={selected.booking_id ? `#${selected.booking_id}: ${selected.group_name || "Unnamed"}` : "-"} />
                          )}
                          <div className={cn("grid gap-2.5 p-3 sm:p-4", selected.seating_required ? "grid-cols-2" : "grid-cols-1")}>
                            <Link
                              href={viewAllHref}
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-admin-primary bg-admin-card px-3 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft hover:text-admin-primary focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none active:scale-[0.98]"
                            >
                              <Users className="h-4 w-4 shrink-0" />
                              View bookings
                            </Link>
                            {selected.seating_required && (
                              <Link
                                href={`/settings/floor-plan/${selected.id}`}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-admin-line bg-admin-card px-3 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none"
                              >
                                <Grid2X2 className="h-4 w-4 shrink-0" />
                                Floor plan
                              </Link>
                            )}
                          </div>
                        </ViewSection>
                      )}

                      {isQuiz && (() => {
                        const { categoryCounts } = quizStatusFor(selected.id);
                        const savedQuestionCount = categoryCounts.reduce((total, category) => total + category.count, 0);
                        const targetQuestionCount = categoryCounts.reduce((total, category) => total + category.question_count, 0);
                        const quizIsComplete = categoryCounts.length > 0 && categoryCounts.every(category => category.count >= category.question_count);
                        const quizHref = quizHrefFor(selected, "sheet");
                        const quizAction = quizIsComplete ? (
                          <Link
                            href={quizHref}
                            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-green-300 bg-green-50 text-[13px] font-semibold text-green-700 transition-colors hover:bg-green-100"
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            All rounds complete - review quiz
                          </Link>
                        ) : (
                          <Link
                            href={quizHref}
                            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#34451F] text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#283719]"
                          >
                            <Brain className="h-4 w-4 shrink-0" />
                            {savedQuestionCount === 0 ? "Start quiz" : `Continue quiz - ${targetQuestionCount - savedQuestionCount} to go`}
                          </Link>
                        );
                        return (
                          <ViewSection
                            title="Quiz Rounds"
                            className="order-1 sm:order-none"
                            open={quizOpen}
                            onToggle={() => setQuizOpen(o => !o)}
                            headerRight={
                              <span className={cn(
                                "mr-2 inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 font-bold text-[12px] tabular-nums",
                                quizIsComplete ? "border-green-300 bg-green-100 text-green-700" : "border-amber-300 bg-amber-100 text-amber-700"
                              )}>
                                {savedQuestionCount} / {targetQuestionCount}
                              </span>
                            }
                          >
                            {/* On a phone the rounds list is long enough to push
                                the action off screen, so the button leads the
                                section instead of closing it. */}
                            <div className="border-b border-[#D8D5C8] p-3 sm:hidden">{quizAction}</div>
                            {categoryCounts.map(cat => {
                              const remaining = cat.question_count - cat.count;
                              const done = cat.count >= cat.question_count;
                              return (
                                <div key={cat.id} className="flex items-center justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 sm:px-5">
                                  <span className="min-w-0 truncate font-bold text-[12px] text-[#5E6654]">{cat.category_name}</span>
                                  <span className={cn(
                                    "inline-flex min-w-32 shrink-0 items-center justify-center rounded-full border px-2 py-1 font-bold text-[12px] tabular-nums",
                                    done ? "border-green-300 bg-green-100 text-green-700" : cat.count > 0 ? "border-amber-300 bg-amber-100 text-amber-700" : "border-red-200 bg-red-50 text-red-600"
                                  )}>
                                    {cat.count} / {cat.question_count} · {done ? "Ready" : cat.count > 0 ? `${remaining} more` : "Not started"}
                                  </span>
                                </div>
                              );
                            })}
                            <div className="hidden p-3 sm:block sm:p-4">{quizAction}</div>
                          </ViewSection>
                        );
                      })()}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5 md:order-1">
                      <ViewSection title="Event Details" open={detailsOpen} onToggle={() => setDetailsOpen(o => !o)}>
                        {poster.url && (
                          <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
                            <span className="shrink-0 pt-0.5 font-bold text-[12px] text-[#5E6654]">Poster</span>
                            <div className="flex min-w-0 flex-col items-end gap-1">
                              <a
                                href={poster.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open the full-size poster"
                                className="hidden shrink-0 overflow-hidden rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] transition-colors hover:border-[#34451F] sm:block"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={poster.url} alt={`Poster for ${selected.title || "event"}`} className="h-16 w-28 object-contain" />
                              </a>
                              <a
                                href={poster.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#34451F] underline underline-offset-2 sm:hidden"
                              >
                                View poster
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              </a>
                              {posterNote && (
                                <span className="text-right text-[12px] leading-snug font-bold text-[#5E6654]">{posterNote}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <DetailCell
                          label="Type / Subtype"
                          value={
                            <>
                              {toTitleCase(type?.name) || "-"}
                              <span className="mx-1.5 font-normal text-[#5E6654]/50">/</span>
                              {toTitleCase(sub?.name) || "-"}
                            </>
                          }
                        />
                        <DetailCell label="Title" value={selected?.title || "Untitled Event"} />
                        {(() => {
                          const timeLabel = selected.start_time || selected.end_time
                            ? `${formatTime(selected.start_time)} - ${formatTime(selected.end_time)}`
                            : null;
                          return (
                            <>
                              <DetailCell
                                className="sm:hidden"
                                label="Date & Time"
                                value={timeLabel ? `${formatDate(selected.date)} · ${timeLabel}` : formatDate(selected.date)}
                              />
                              <DetailCell className="hidden sm:flex" label="Date" value={formatDate(selected.date)} />
                              <DetailCell className="hidden sm:flex" label="Time" value={timeLabel ?? "-"} />
                            </>
                          );
                        })()}
                        {(sub?.host_required || selected.host_employee_id != null) && <DetailCell label="Host" value={host?.full_name ?? "-"} />}
                        {(sub?.payment_required || hasPricing) && (
                          <DetailCell label="Payment" value={hasPricing ? `£${selected.payment_amount!.toFixed(2)} / person` : "Free"} />
                        )}
                        {(sub?.seating_required || selected.seating_required) && (
                          <DetailCell label="Seating" value={selected.seating_required ? "Required" : "Not required"} />
                        )}
                        {selected.tagline && (
                          <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
                            <span className="shrink-0 pt-0.5 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">Tagline</span>
                            <ExpandableValue text={selected.tagline} />
                          </div>
                        )}
                        {selected.external_link && <DetailCell label="External Link" value={selected.external_link} />}
                        {sub?.behavior === "karaoke" && <DetailCell label="Singa Link" value={selected.karaoke_request_url} />}
                      </ViewSection>

                      <ViewSection title="Public Booking Settings" open={bookingSettingsOpen} onToggle={() => setBookingSettingsOpen(o => !o)}>
                        <DetailCell
                          label="Public Booking"
                          value={selected.is_bookable
                            ? <span className="font-bold text-green-700">Enabled</span>
                            : "Disabled - guests can't book this event"}
                        />

                        {selected.is_bookable && (
                          <div className="bg-[#F4F1E8]/40 p-3 sm:p-4">
                            <BookingConfigEditor
                              value={selected.booking_config ?? {}}
                              readOnly
                              bookingPageExtra={
                                <>
                                  <div className="flex items-center justify-between gap-3 border-t border-[#D8D5C8] px-4 py-2">
                                    <span className="flex shrink-0 items-center gap-1.5 font-bold text-[12px] text-[#5E6654]">
                                      <Link2 className="h-3.5 w-3.5" />
                                      Booking Link
                                    </span>
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="truncate text-right text-[13px] font-semibold text-[#20231A]">{bookingUrl}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(bookingUrl);
                                          setLinkCopied(true);
                                          setTimeout(() => setLinkCopied(false), 2000);
                                        }}
                                        aria-label="Copy the booking link"
                                        title="Copy the booking link"
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] text-[#34451F] transition-colors hover:bg-[#34451F] hover:text-white"
                                      >
                                        {linkCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-start justify-between gap-4 border-t border-[#D8D5C8] px-4 py-2">
                                    <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-bold text-[12px] text-[#5E6654]">
                                      <QrCode className="h-3.5 w-3.5" />
                                      Booking QR
                                    </span>
                                    {selected.booking_qr_url ? (
                                      <div className="flex items-start gap-2">
                                        <div className="flex flex-col items-end gap-1.5">
                                          <button type="button" onClick={copyQr} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] px-2.5 font-semibold text-[12px] tracking-wider text-[#34451F] transition-colors hover:bg-[#34451F] hover:text-white">
                                            {qrCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                            {qrCopied ? "Copied" : "Copy QR"}
                                          </button>
                                          <button type="button" onClick={generateQr} disabled={qrBusy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] px-2.5 font-semibold text-[12px] tracking-wider text-[#34451F] transition-colors hover:bg-[#34451F] hover:text-white disabled:opacity-50">
                                            {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                                            Regenerate
                                          </button>
                                        </div>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={selected.booking_qr_url} alt="Booking link QR code" className="h-20 w-20 shrink-0 rounded-lg border border-[#D8D5C8] bg-white p-1" />
                                      </div>
                                    ) : (
                                      <button type="button" onClick={generateQr} disabled={qrBusy} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#34451F] px-2.5 font-semibold text-[12px] tracking-wider text-white transition-colors hover:bg-[#283719] disabled:opacity-50">
                                        {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                                        Generate QR
                                      </button>
                                    )}
                                  </div>
                                </>
                              }
                            />
                          </div>
                        )}
                      </ViewSection>
                    </div>
                  </div>

                  {formError && <ErrorBox message={formError} />}

                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isPending}
                      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold text-[#B33A32] transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete this event
                    </button>
                    <p className="mt-0.5 text-[12px] font-medium text-[#5E6654]">You&apos;ll be asked to confirm first.</p>
                  </div>
                </div>
              );
            })()}

            {showForm && (
              <form id="event-form" action={handleSubmit} className="animate-in grid-cols-2 items-start gap-5 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid lg:space-y-0">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
                <input type="hidden" name="creation_method" value={copySourceId ? "copy" : "manual"} />
                <input type="hidden" name="creation_source_id" value={copySourceId ? String(copySourceId) : ""} />
                <input type="hidden" name="seating_required" value={formSeating ? "on" : ""} />
                <input type="hidden" name="is_active" value={formActive ? "on" : ""} />
                <input type="hidden" name="is_fully_booked" value={formFullyBooked ? "on" : ""} />
                <input type="hidden" name="is_bookable" value={formIsBookable ? "on" : ""} />

                <FormSection title="Event Details" open={formDetailsOpen} onToggle={() => setFormDetailsOpen((o) => !o)}>
                  <div className="border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
                    <span className="mb-2 block font-bold text-[12px] text-[#5E6654]">Poster Image</span>
                    <input type="hidden" name="image_url" value={formImageUrl} />
                    {formImageUrl ? (
                      <div className="relative overflow-hidden rounded-xl border border-[#D8D5C8]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={formImageUrl} alt="Event poster" className="max-h-32 w-full bg-[#F4F1E8] object-contain" />
                        <button
                          type="button"
                          onClick={() => setFormImageUrl("")}
                          title={inheritedForForm.url ? "Clear and use the default image" : "Clear poster image"}
                          aria-label={inheritedForForm.url ? "Clear and use the default image" : "Clear poster image"}
                          className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : inheritedForForm.url ? (
                      <div className="space-y-2">
                        <div className="relative overflow-hidden rounded-xl border border-dashed border-[#D8D5C8]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={inheritedForForm.url} alt="Inherited poster" className="max-h-32 w-full bg-[#F4F1E8] object-contain opacity-75" />
                        </div>
                        <p className="text-[12px] text-[#5E6654]">
                          {imageSourceLabel(inheritedForForm.source, selectedSubtype?.name)}. It updates automatically when that image changes.
                        </p>
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#D8D5C8] bg-[#F4F1E8] py-3 transition-colors hover:border-[#34451F]">
                          {imageUploading ? <Loader2 className="h-4 w-4 animate-spin text-[#5E6654]" /> : <Upload className="h-4 w-4 text-[#5E6654] opacity-50" />}
                          <span className="font-bold text-[13px] text-[#34451F]">{imageUploading ? "Uploading…" : "Use a different image"}</span>
                          <input type="file" accept="image/*" aria-label="Upload a different poster image" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D8D5C8] bg-[#F4F1E8] py-7 transition-colors hover:border-[#34451F]">
                        {imageUploading ? <Loader2 className="h-7 w-7 animate-spin text-[#5E6654]" /> : <Upload className="h-7 w-7 text-[#5E6654] opacity-50" />}
                        <span className="font-bold text-[13px] text-[#34451F]">{imageUploading ? "Uploading…" : "Upload"}</span>
                        <span className="text-[12px] text-[#5E6654]">Shown on the public What&apos;s On card</span>
                        <input type="file" accept="image/*" aria-label="Upload poster image" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
                      </label>
                    )}
                  </div>

                  <FormRow label="Type / Sub-Type" required error={fieldErrors.event_types_id ?? fieldErrors.event_subtypes_id}>
                    <div className="flex min-w-0 items-center justify-end gap-1.5">
                      <select
                        title="Event Type"
                        name="event_types_id"
                        value={formTypeId}
                        onChange={(e) => onSelectType(e.target.value)}
                        className="field-sizing-content min-w-0 cursor-pointer appearance-none bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none [text-align-last:right]"
                      >
                        {eventTypes.map((t) => (
                          <option key={t.id} value={t.id}>{toTitleCase(t.name)}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#5E6654]" />
                      <span className="shrink-0 text-[#5E6654]/50">/</span>
                      <select
                        title="Sub-Type"
                        name="event_subtypes_id"
                        value={formSubtypeId}
                        onChange={(e) => onSelectSubtype(e.target.value)}
                        className="field-sizing-content min-w-0 cursor-pointer appearance-none bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none [text-align-last:right]"
                      >
                        <option value="" disabled>Select a sub-type...</option>
                        {formSubtypeOptions.map((s) => (
                          <option key={s.id} value={s.id}>{toTitleCase(s.name)}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#5E6654]" />
                    </div>
                  </FormRow>

                  <FormRow label="Title" required error={fieldErrors.title}>
                    <input
                      name="title"
                      placeholder="e.g. Music Bingo"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
                    />
                  </FormRow>

                  <FormRow label="Date" required error={fieldErrors.date}>
                    <input type="hidden" name="date" value={formDate} />
                    <Popover open={formDateOpen} onOpenChange={setFormDateOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex cursor-pointer items-center gap-2 bg-transparent text-[13px] font-semibold text-[#20231A] transition-colors hover:text-[#34451F]"
                        >
                          {formDate ? format(new Date(formDate + "T00:00:00"), "EEE, d MMM yyyy") : "Pick a date"}
                          <CalendarDays className="h-4 w-4 shrink-0 text-[#5E6654]/60" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-auto rounded-2xl border-2 border-[#D8D5C8] bg-white p-0">
                        <Calendar
                          mode="single"
                          selected={formDate ? new Date(formDate + "T00:00:00") : undefined}
                          onSelect={(d) => {
                            if (d) setFormDate(format(d, "yyyy-MM-dd"));
                            setFormDateOpen(false);
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormRow>

                  <FormRow label="Time" required error={fieldErrors.time}>
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <input title="Start time" name="start_time" type="time" value={formStartTime} onChange={(e) => { const v = e.target.value; setFormStartTime(v); if (v && !formEndTime) { const end = addHoursToTime(v, 2); if (end) setFormEndTime(end); } }} className="bg-transparent text-[13px] font-semibold text-[#20231A] outline-none" />
                      <span className="text-xs text-[#5E6654]/50">-</span>
                      <input title="End time" name="end_time" type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="bg-transparent text-[13px] font-semibold text-[#20231A] outline-none" />
                    </div>
                  </FormRow>

                  {selectedSubtype?.host_required && (
                    <FormRow label="Host" warning={fieldWarnings.host_employee_id}>
                      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                        <select title="Host" name="host_employee_id" value={formHostId} onChange={(e) => setFormHostId(e.target.value)} className="min-w-0 cursor-pointer appearance-none bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none [text-align-last:right]">
                          <option value="">No host</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>{e.full_name}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#5E6654]" />
                      </div>
                    </FormRow>
                  )}

                  <FormRow label="Payment (£)" warning={fieldWarnings.payment_amount}>
                    <input name="payment_amount" type="number" min="0" step="0.01" placeholder="0.00" value={formPayment} onChange={(e) => setFormPayment(e.target.value)} className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>

                  <FormRow label="Tagline">
                    <textarea name="tagline" placeholder="Brief tagline for the event..." rows={1} value={formTagline} onChange={(e) => setFormTagline(e.target.value)} className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-right text-[13px] leading-relaxed font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>

                  <FormRow label="External Link">
                    <input name="external_link" type="url" placeholder="https://instagram.com/..." value={formExternalLink} onChange={(e) => setFormExternalLink(e.target.value)} className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>

                  {selectedSubtype?.behavior === "karaoke" && (
                    <FormRow label="Singa Link" warning={fieldWarnings.karaoke_request_url}>
                      <input name="karaoke_request_url" type="url" placeholder="https://app.singa.com/..." value={formKaraokeUrl} onChange={(e) => setFormKaraokeUrl(e.target.value)} className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                    </FormRow>
                  )}

                </FormSection>

                <div className="space-y-4 sm:space-y-5">
                <FormSection title="Settings" open={formSettingsOpen} onToggle={() => setFormSettingsOpen((o) => !o)}>
                  <FormRow label="Seating">
                    <FormToggle label="Seating" on={formSeating} onToggle={() => setFormSeating((o) => !o)} />
                  </FormRow>
                  <FormRow label="Active">
                    <FormToggle label="Active" on={formActive} onToggle={() => setFormActive((o) => !o)} />
                  </FormRow>
                </FormSection>

                <FormSection title="Public Booking Settings" open={formBookingSettingsOpen} onToggle={() => setFormBookingSettingsOpen((o) => !o)}>
                  <FormRow label="Public Booking">
                    <FormToggle label="Public booking" on={formIsBookable} onToggle={toggleBookable} />
                  </FormRow>

                  {formIsBookable && (
                    <>
                      <FormRow label="Fully Booked">
                        <FormToggle label="Fully booked" on={formFullyBooked} onToggle={() => setFormFullyBooked((o) => !o)} danger />
                      </FormRow>

                      <FormRow label="Booking URL" required error={fieldErrors.booking_page_url}>
                        <input name="booking_page_url" type="url" placeholder="https://..." value={formBookingPageUrl} onChange={(e) => { setFormBookingPageUrl(e.target.value); setBookingUrlManual(true); }} className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
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
                                  className="min-w-0 cursor-pointer appearance-none bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none [text-align-last:right]"
                                >
                                  <option value="">No booking</option>
                                  {eventBookings.map(b => (
                                    <option key={b.id} value={b.id}>#{b.id} - {b.group_name || "Unnamed"}</option>
                                  ))}
                                </select>
                                <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[#5E6654]" />
                              </div>
                            </FormRow>
                            <FormRow label="Group Name">
                              <input type="hidden" name="group_name" value={formGroupName} />
                              <input value={formGroupName} onChange={(e) => setFormGroupName(e.target.value)} placeholder="e.g. The Brainiacs" className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                            </FormRow>
                          </>
                        );
                      })()}

                      <div className="bg-[#F4F1E8]/40 p-3 sm:p-4">
                        <input type="hidden" name="booking_config" value={JSON.stringify(formBookingConfig)} />
                        <BookingConfigEditor value={formBookingConfig} onChange={setFormBookingConfig} />
                      </div>
                    </>
                  )}
                </FormSection>
                </div>

                {formIsBookable && selectedTypeForForm?.booking_grouping === "per_event" && (
                  <div className="overflow-hidden rounded-3xl border-2 border-[#D8D5C8] bg-white lg:col-span-2">
                    <div className="flex min-h-14 w-full items-center gap-3 border-b border-[#D8D5C8] bg-[#D8D5C8] px-4 py-3 sm:px-5">
                      <span className="font-bold text-[12px] text-[#34451F]">Booking Card</span>
                    </div>
                    <div className="border-b border-[#D8D5C8] px-4 py-2 sm:px-5">
                      <p className="text-[12px] leading-relaxed text-[#5E6654]">Shown on the public booking hub card. Blank fields fall back to the title, a calendar icon, and the auto badge.</p>
                    </div>
                    <FormRow label="Card Title">
                      <input name="booking_card_title" placeholder="e.g. Music Bingo" value={formCardTitle} onChange={(e) => setFormCardTitle(e.target.value)} className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                    </FormRow>
                    <FormRow label="Card Tagline">
                      <textarea name="booking_card_tagline" placeholder="Short line shown under the title..." rows={1} value={formCardTagline} onChange={(e) => setFormCardTagline(e.target.value)} className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-right text-[13px] leading-relaxed font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                    </FormRow>
                    <FormRow label="Card Note">
                      <input name="booking_card_badge" placeholder="e.g. Thursdays, Members only" value={formCardBadge} onChange={(e) => setFormCardBadge(e.target.value)} className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
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

          <div className="z-40 shrink-0 rounded-b-4xl border-t-2 border-[#34451F]/15 bg-[#D8D5C8] px-4 py-3 pb-6 sm:px-6">
            {!showForm && selected && (
              <Button variant="ghost" onClick={openEdit} className="h-12 w-full rounded-xl border border-[#34451F] bg-white px-4 text-[13px] font-semibold tracking-wide text-[#34451F] hover:bg-[#E5EBD8] hover:text-[#34451F] active:scale-95">
                <Pencil className="mr-2 h-4 w-4" />Edit event
              </Button>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="ghost" onClick={() => { setFormError(null); if (isAdding) closeSheet(); else setIsEditing(false); }} disabled={isPending} className="h-12 rounded-xl border border-admin-line bg-admin-card text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none active:scale-[0.98]">
                  <Undo2 className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="button" disabled={isPending || hasFieldErrors || imageUploading} title={hasFieldErrors ? "Resolve the highlighted fields before saving" : undefined} onClick={() => { const form = document.getElementById('event-form') as HTMLFormElement | null; if (form) form.requestSubmit(); }} className="h-12 rounded-xl bg-[#34451F] font-semibold text-[12px] tracking-wide text-white shadow-lg hover:bg-[#283719] active:scale-95 disabled:pointer-events-none disabled:opacity-50">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save</>}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!issuesEvent} onOpenChange={(open) => { if (!open) setIssuesEvent(null); }}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-surface p-0 shadow-2xl">
          {issuesEvent && (() => {
            const issues = eventIssues(issuesEvent);
            return (
              <>
                <div className="flex flex-col gap-1 px-6 pt-6 pb-4">
                  <DialogTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-admin-ink">
                    <HelpCircle className="h-4.5 w-4.5 shrink-0 text-admin-error" />
                    {issues.length} issue{issues.length === 1 ? "" : "s"} to fix
                  </DialogTitle>
                  <DialogDescription className="text-[13px] font-medium text-admin-muted">
                    {issuesEvent.title || "Untitled Event"}
                    {issuesEvent.date ? ` · ${formatDate(issuesEvent.date)}` : ""}
                  </DialogDescription>
                </div>
                <ul className="max-h-[50vh] divide-y divide-admin-line overflow-y-auto border-y border-admin-line bg-admin-card">
                  {issues.map((issue) => (
                    <li key={issue} className="flex items-start gap-2.5 px-6 py-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-admin-error" aria-hidden="true" />
                      <span className="text-[13px] leading-snug font-semibold text-admin-ink">{issue}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-row gap-2 px-6 py-5">
                  <button
                    type="button"
                    onClick={() => setIssuesEvent(null)}
                    className="h-11 flex-1 rounded-xl border-2 border-admin-muted/35 bg-admin-card text-[13px] font-semibold text-admin-ink transition-colors hover:bg-admin-surface"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => { const target = issuesEvent; setIssuesEvent(null); openView(target); }}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-admin-primary text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
                  >
                    <Pencil className="h-4 w-4" />
                    Open event
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {ConfirmDialogUI}
    </div>
  );
}

function FormRow({ label, required, error, warning, children }: { label: string; required?: boolean; error?: string; warning?: string; children: React.ReactNode }) {
  const message = error ?? warning;
  const isWarning = !error && !!warning;
  return (
    <div className="border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className={cn("flex shrink-0 items-center gap-1", error ? "text-red-600" : warning ? "text-amber-600" : "text-[#5E6654]")}>
          <span className="font-bold text-[12px] whitespace-nowrap">{label}</span>
          {required && <span className="font-bold text-[12px] text-red-500">*</span>}
        </div>
        {children}
      </div>
      {message && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-[13px] leading-snug font-bold", isWarning ? "text-amber-600" : "text-red-600")}>
          {isWarning ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
          {message}
        </p>
      )}
    </div>
  );
}

function ViewSection({ title, open, onToggle, headerRight, className, children }: { title: string; open: boolean; onToggle: () => void; headerRight?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border-2 border-[#D8D5C8] bg-white", className)}>
      <div className={cn("flex min-h-11 w-full items-center gap-3 bg-[#D8D5C8] px-4 py-2 sm:px-5", open && "border-b border-[#D8D5C8]")}>
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center text-left transition-all hover:brightness-95"
        >
          <span className="font-bold text-[12px] text-[#34451F]">{title}</span>
        </button>
        {headerRight}
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="shrink-0 transition-all hover:brightness-95"
        >
          <ChevronDown className={cn("h-4 w-4 text-[#5E6654] transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      <div className={cn(!open && "hidden")}>{children}</div>
    </div>
  );
}

function ExpandableValue({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const measure = () => {
      const el = textRef.current;
      if (!el || expanded) return;
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text, expanded]);

  return (
    <span className="flex min-w-0 flex-1 items-start justify-end gap-1 text-right text-[13px] font-semibold text-[#20231A]">
      <span ref={textRef} className={cn("min-w-0", !expanded && "truncate")}>{text}</span>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(o => !o)}
          aria-expanded={expanded}
          aria-label={expanded ? "Show less" : "Show the full text"}
          className="shrink-0 font-bold text-[#34451F] underline underline-offset-2"
        >
          {expanded ? "less" : "…"}
        </button>
      )}
    </span>
  );
}

function DetailCell({ label, value, icon, toggle, accent, className }: { label: string; value?: React.ReactNode; icon?: React.ReactNode; toggle?: boolean; accent?: string; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5", className)}>
      <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">
        {icon}
        {label}
      </span>
      {toggle !== undefined ? (
        <ToggleSlider on={toggle} />
      ) : (
        <span className={cn("text-right text-[13px] font-semibold", accent ?? "text-[#20231A]")}>{value || "-"}</span>
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
        on ? (danger ? "bg-red-600" : "bg-green-600") : "bg-[#5E6654]/25"
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
    <div className={cn("overflow-hidden rounded-3xl border-2 border-[#D8D5C8] bg-white", className)}>
      <div className={cn("flex min-h-11 w-full items-center gap-3 bg-[#D8D5C8] px-4 py-2 sm:px-5", open && "border-b border-[#D8D5C8]")}>
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center text-left transition-all hover:brightness-95"
        >
          <span className="font-bold text-[12px] text-[#34451F]">{title}</span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="shrink-0 transition-all hover:brightness-95"
        >
          <ChevronDown className={cn("h-4 w-4 text-[#5E6654] transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      <div className={cn(!open && "hidden")}>{children}</div>
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
        on ? (danger ? "border-red-700 bg-red-600" : "border-green-600 bg-green-500") : "border-[#5E6654]/30 bg-[#5E6654]/20"
      )}
    >
      <span className={cn("absolute top-1/2 left-0 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform", on ? "translate-x-5.25" : "translate-x-0.5")} />
    </button>
  );
}
