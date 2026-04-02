import React from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import {
  BellRing,
  Music,
  Building2,
  CreditCard,
  CalendarDays,
  Users,
  Grid2X2,
  ChevronRight,
  Trophy,
  Plus,
  TrendingUp,
  UserCheck,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type EventTypeRow = { type: string; sub_type: string } | null;
type BookingRow = { id: number; group_size: number; status: string; group_name: string | null };
type PrivateHireRow = {
  id: string;
  selected_date: string;
  selected_start_time: string | null;
  selected_end_time: string | null;
  reason_for_hire: string;
  full_name: string;
  guest_count: number;
};
type BandBookingRow = {
  id: string;
  booker_name: string;
  selected_date: string;
  selected_start_time: string | null;
  selected_end_time: string | null;
};
type ListItem = {
  key: string;
  date: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  eventType: EventTypeRow;
  hostName: string | null;
  guests: number;
  href: string;
};
type UpcomingEvent = {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  host_employee_id: number | null;
  event_types: EventTypeRow | EventTypeRow[];
  bookings: BookingRow[];
};

function getEventType(ev: UpcomingEvent): EventTypeRow {
  return (Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types) ?? null;
}

function getSaturdaysInMonth(year: number, month: number): string[] {
  const saturdays: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === 6) saturdays.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }
  return saturdays;
}

function getBookingsHref(et: EventTypeRow): string {
  if (!et) return "/event-bookings";
  const s = et.sub_type?.toLowerCase() ?? "";
  const t = et.type?.toLowerCase() ?? "";
  if (s.includes("bingo") || t.includes("bingo")) return "/event-bookings/bingo-bookings";
  if (s.includes("quiz") || t.includes("quiz")) return "/event-bookings/quiz-bookings";
  if (t.includes("music") || t.includes("band") || t.includes("live")) return "/event-bookings/music-bookings";
  if (t.includes("private")) return "/event-bookings/private-bookings";
  return "/event-bookings";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const todayStr = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString().split("T")[0];

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const [
    { count: pendingPrivate },
    { count: pendingBands },
    { data: unpaidBookingsData },
    { data: upcomingQuizData },
  ] = await Promise.all([
    supabase
      .from("private_hire_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("band_booking_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("bookings")
      .select("id, events!inner(date)")
      .eq("payment_status", "unpaid")
      .gt("total_amount", 0)
      .in("status", ["confirmed", "pending"])
      .gte("events.date", todayStr),
    supabase
      .from("events")
      .select("id, event_types(sub_type, type), past_quiz_questions(id)")
      .gte("date", todayStr),
  ]);

  const [
    { data: monthBookings },
    { count: newContactsCount },
    { count: confirmedBookingsCount },
    { data: bandPreferredDates },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("total_amount, paid_amount, payment_status, status")
      .gte("created_at", firstDayOfMonth)
      .neq("status", "cancelled"),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .gte("created_at", firstDayOfMonth),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("created_at", firstDayOfMonth),
    supabase
      .from("band_booking_requests")
      .select("preferred_dates"),
  ]);

  const { data: rawUpcoming } = await supabase
    .from("events")
    .select(
      "id, date, start_time, end_time, title, host_employee_id, event_types (type, sub_type), bookings (id, group_size, status, team_id)"
    )
    .gte("date", todayStr)
    .order("date", { ascending: true })
    .limit(5);

  const upcomingEvents = (rawUpcoming ?? []) as unknown as UpcomingEvent[];

  const [{ data: employees }, { data: tablesData }, { data: confirmedPrivateHires }, { data: confirmedBandBookings }] = await Promise.all([
    supabase.from("employees").select("id, full_name"),
    supabase.from("tables").select("id, max_capacity").eq("available", true),
    supabase
      .from("private_hire_requests")
      .select("id, selected_date, selected_start_time, selected_end_time, reason_for_hire, full_name, guest_count")
      .eq("status", "confirmed")
      .gte("selected_date", todayStr)
      .order("selected_date", { ascending: true }),
    supabase
      .from("band_booking_requests")
      .select("id, booker_name, selected_date, selected_start_time, selected_end_time")
      .eq("status", "approved")
      .gte("selected_date", todayStr)
      .order("selected_date", { ascending: true }),
  ]);

  // ─── Calculations ─────────────────────────────────────────────────────────

  const quizzesMissingQuestions = (upcomingQuizData ?? []).filter((ev) => {
    const et = (Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types) as { sub_type?: string; type?: string } | null;
    const isQuiz =
      et?.sub_type?.toLowerCase().includes("quiz") ||
      et?.type?.toLowerCase().includes("quiz");
    const questions = Array.isArray(ev.past_quiz_questions) ? ev.past_quiz_questions : [];
    return isQuiz && questions.length === 0;
  }).length;

  const now = new Date();
  const currentMonthSaturdays = getSaturdaysInMonth(now.getFullYear(), now.getMonth());
  const saturdaysBooked = new Set<string>();
  (bandPreferredDates ?? []).forEach((req) => {
    ((req.preferred_dates ?? []) as string[]).forEach((d) => {
      if (currentMonthSaturdays.includes(d)) saturdaysBooked.add(d);
    });
  });
  const openSaturdays = currentMonthSaturdays.length - saturdaysBooked.size;

  const totalActions =
    (pendingPrivate ?? 0) +
    (pendingBands ?? 0) +
    (unpaidBookingsData?.length ?? 0) +
    quizzesMissingQuestions +
    openSaturdays;

  const collectedRevenue =
    monthBookings?.reduce((s, b) => s + (b.paid_amount ?? 0), 0) ?? 0;
  const outstandingRevenue =
    monthBookings
      ?.filter((b) => b.payment_status === "unpaid")
      .reduce((s, b) => s + ((b.total_amount ?? 0) - (b.paid_amount ?? 0)), 0) ?? 0;

  const totalVenueCapacity =
    tablesData?.reduce((acc, t) => acc + t.max_capacity, 0) ?? 0;

  const employeeMap = new Map(
    (employees ?? []).map((e) => [e.id, e.full_name])
  );

  const tonightEvent =
    upcomingEvents[0]?.date === todayStr ? upcomingEvents[0] : null;
  const futureEvents = tonightEvent ? upcomingEvents.slice(1) : upcomingEvents;

  const eventListItems: ListItem[] = futureEvents.map((ev) => {
    const et = getEventType(ev);
    return {
      key: `event-${ev.id}`,
      date: ev.date,
      title: ev.title ?? "Untitled Event",
      startTime: ev.start_time,
      endTime: ev.end_time,
      eventType: et,
      hostName: ev.host_employee_id ? (employeeMap.get(ev.host_employee_id) ?? null) : null,
      guests: ev.bookings.filter((b) => b.status === "confirmed").reduce((s, b) => s + (b.group_size ?? 0), 0),
      href: getBookingsHref(et),
    };
  });

  const privateHireListItems: ListItem[] = ((confirmedPrivateHires ?? []) as PrivateHireRow[])
    .filter((ph) => ph.selected_date !== todayStr || !tonightEvent)
    .map((ph) => ({
      key: `ph-${ph.id}`,
      date: ph.selected_date,
      title: ph.reason_for_hire,
      startTime: ph.selected_start_time,
      endTime: ph.selected_end_time,
      eventType: { type: "Private Hire", sub_type: "private" } as EventTypeRow,
      hostName: ph.full_name,
      guests: ph.guest_count,
      href: "/event-bookings/private-bookings",
    }));

  const bandListItems: ListItem[] = ((confirmedBandBookings ?? []) as BandBookingRow[]).map((b) => ({
    key: `band-${b.id}`,
    date: b.selected_date,
    title: b.booker_name,
    startTime: b.selected_start_time,
    endTime: b.selected_end_time,
    eventType: { type: "Live Music", sub_type: "band" } as EventTypeRow,
    hostName: null,
    guests: 0,
    href: "/event-bookings/music-bookings",
  }));

  const allListItems = [...eventListItems, ...privateHireListItems, ...bandListItems]
    .sort((a, b) => a.date.localeCompare(b.date));

  const tonightConfirmed = (tonightEvent?.bookings ?? []).filter(
    (b) => b.status === "confirmed"
  );

  const tonightGuests = tonightConfirmed.reduce(
    (s, b) => s + (b.group_size ?? 0),
    0
  );
  const capacityPercent =
    totalVenueCapacity > 0
      ? Math.min(100, Math.round((tonightGuests / totalVenueCapacity) * 100))
      : 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 bg-background min-h-screen pb-24">
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">

        <header>
          <p className="text-sm font-bold text-[#5F624F] uppercase tracking-widest">
            {format(new Date(), "EEEE, do MMMM yyyy")}
          </p>
        </header>

        {/* SECTION A: NEEDS ACTION */}
        <section className="space-y-3">
          <SectionLabel
            icon={BellRing}
            label="Needs Action"
            highlight={totalActions > 0}
            badge={totalActions > 0 ? `${totalActions} Pending` : undefined}
          />
          <div className="bg-white border border-[#E6DFC8] rounded-2xl divide-y divide-[#F0EBE0] overflow-hidden">
            <ActionRow
              icon={Building2}
              label="Private Hires"
              count={pendingPrivate ?? 0}
              href="/event-bookings/private-bookings?status=pending_review"
              activeColor="text-blue-600"
              activeBg="bg-blue-50"
              activeDot="bg-blue-500"
            />
            <ActionRow
              icon={Music}
              label="Band Submissions"
              count={pendingBands ?? 0}
              href="/event-bookings/music-bookings?status=pending_review"
              activeColor="text-purple-600"
              activeBg="bg-purple-50"
              activeDot="bg-purple-500"
            />
            <ActionRow
              icon={CreditCard}
              label="Unpaid Bookings"
              count={unpaidBookingsData?.length ?? 0}
              href={`/event-bookings/bingo-bookings?status=confirmed,pending&payment_status=unpaid&from_date=${todayStr}&min_total=0`}
              activeColor="text-amber-600"
              activeBg="bg-amber-50"
              activeDot="bg-amber-500"
            />
            <ActionRow
              icon={Trophy}
              label="Quizzes Without Questions"
              count={quizzesMissingQuestions}
              href="/events/quiz-generator"
              activeColor="text-green-700"
              activeBg="bg-green-50"
              activeDot="bg-green-500"
            />
            <ActionRow
              icon={Music}
              label="Open Saturdays This Month"
              count={openSaturdays}
              href="/event-bookings/music-bookings"
              activeColor="text-rose-600"
              activeBg="bg-rose-50"
              activeDot="bg-rose-500"
            />
          </div>
        </section>

        {/* SECTION B: THIS MONTH */}
        <section className="space-y-3">
          <SectionLabel
            icon={TrendingUp}
            label={`${format(new Date(), "MMMM")} at a Glance`}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Collected"
              value={`£${collectedRevenue.toFixed(2)}`}
              sub="revenue paid"
              positive
            />
            <StatCard
              label="Outstanding"
              value={`£${outstandingRevenue.toFixed(2)}`}
              sub="to collect"
              warn={outstandingRevenue > 0}
            />
            <StatCard
              label="Bookings"
              value={confirmedBookingsCount ?? 0}
              sub="confirmed"
            />
            <StatCard
              label="New Guests"
              value={newContactsCount ?? 0}
              sub="this month"
            />
          </div>
        </section>

        {/* SECTION C: UPCOMING EVENTS */}
        <section className="space-y-3">
          <SectionLabel icon={CalendarDays} label="Upcoming Events" />

          {tonightEvent && (
            <TonightCard
              event={tonightEvent}
              hostName={
                tonightEvent.host_employee_id
                  ? (employeeMap.get(tonightEvent.host_employee_id) ?? "Unassigned")
                  : "Unassigned"
              }
              guests={tonightGuests}
              capacity={totalVenueCapacity}
              capacityPercent={capacityPercent}
            />
          )}

          {allListItems.length > 0 ? (
            <div className="bg-white border border-[#E6DFC8] rounded-2xl divide-y divide-[#F0EBE0] overflow-hidden">
              {allListItems.map((item) => (
                <EventRow
                  key={item.key}
                  date={item.date}
                  title={item.title}
                  startTime={item.startTime}
                  endTime={item.endTime}
                  eventType={item.eventType}
                  hostName={item.hostName}
                  guests={item.guests}
                  href={item.href}
                />
              ))}
            </div>
          ) : !tonightEvent ? (
            <div className="bg-white border border-[#E6DFC8] rounded-2xl p-10 text-center">
              <CalendarDays className="w-10 h-10 text-[#5F624F] opacity-20 mx-auto mb-3" />
              <p className="text-sm font-black text-[#1F1F1A]">No Upcoming Events</p>
              <p className="text-[11px] text-[#5F624F] font-medium mt-1">
                Schedule an event in Settings to see it here.
              </p>
            </div>
          ) : null}
        </section>

        {/* SECTION D: QUICK LINKS */}
        <section className="space-y-3">
          <SectionLabel icon={Zap} label="Quick Links" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickLink href="/book/bingo" label="Walk-in" icon={Plus} />
            <QuickLink href="/settings/tables" label="Floor Plan" icon={Grid2X2} />
            <QuickLink href="/events/quiz-generator" label="Quiz" icon={Trophy} />
            <QuickLink href="/events" label="Events" icon={CalendarDays} />
          </div>
        </section>

      </div>
    </div>
  );
}

// ─── Tonight Card ──────────────────────────────────────────────────────────

function TonightCard({
  event,
  hostName,
  guests,
  capacity,
  capacityPercent,
}: {
  event: UpcomingEvent;
  hostName: string;
  guests: number;
  capacity: number;
  capacityPercent: number;
}) {
  const et = getEventType(event);
  const isQuiz = et?.sub_type?.toLowerCase().includes("quiz") || et?.type?.toLowerCase().includes("quiz");
  const bookingsHref = getBookingsHref(et);
  const confirmedTeams = isQuiz
    ? new Set(
        event.bookings
          .filter((b) => b.status === "confirmed")
          .map((b) => b.group_name)
      ).size
    : 0;

  return (
    <div className="bg-white border-2 border-[#E6DFC8] rounded-[2rem] overflow-hidden shadow-sm">
      <Link href={bookingsHref} className="block">
        <div className="bg-[#26300D] px-6 py-5 text-white flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="bg-[#FDCC4B] text-[#26300D] text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest">
              Tonight
            </span>
            <h3 className="text-xl font-black uppercase tracking-tight mt-2 leading-none truncate">
              {event.title ?? "Untitled Event"}
            </h3>
            <p className="text-sm text-white/60 mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                {hostName}
              </span>
              {event.start_time && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {event.start_time.substring(0, 5)}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-start gap-4 shrink-0">
            {isQuiz && (
              <>
                <div className="text-right">
                  <p className="text-3xl font-black tabular-nums text-[#FDCC4B] leading-none">
                    {confirmedTeams}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mt-1">
                    Teams
                  </p>
                </div>
                <div className="w-px self-stretch bg-white/10" />
              </>
            )}
            <div className="text-right">
              <p className="text-3xl font-black tabular-nums text-[#FDCC4B] leading-none">
                {guests}
              </p>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mt-1">
                Guests
              </p>
            </div>
          </div>
        </div>
      </Link>

      <div className="px-6 py-5 space-y-4">
        {capacity > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#1F1F1A] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#5F624F]" />
                Capacity
              </span>
              <span className="text-xs font-black text-[#5F624F]">
                {guests} / {capacity} — {capacityPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full bg-[#F7F4EA] rounded-full overflow-hidden border border-[#E6DFC8]">
              <div
                className={cn(
                  "h-full transition-all duration-700",
                  capacityPercent > 90 ? "bg-red-500" : "bg-[#26300D]"
                )}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className={cn("grid gap-3", isQuiz ? "grid-cols-2" : "grid-cols-2")}>
          <Link
            href="/book/bingo"
            className="flex items-center justify-center gap-2 h-11 bg-[#F7F4EA] hover:bg-[#E6DFC8] border border-[#E6DFC8] rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-[#1F1F1A]"
          >
            <Plus className="w-4 h-4" />
            Walk-in
          </Link>
          <Link
            href="/settings/tables"
            className="flex items-center justify-center gap-2 h-11 bg-[#F7F4EA] hover:bg-[#E6DFC8] border border-[#E6DFC8] rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-[#1F1F1A]"
          >
            <Grid2X2 className="w-4 h-4" />
            Floorplan
          </Link>
          {isQuiz && (
            <Link
              href="/events/quiz-generator"
              className="col-span-2 flex items-center justify-between px-5 h-12 bg-[#FDCC4B] hover:bg-[#e5b843] rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4 text-[#26300D]" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#26300D]">
                  Launch Quiz Master
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#26300D]" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Event Row ─────────────────────────────────────────────────────────────

function EventRow({
  date,
  title,
  startTime,
  endTime,
  eventType,
  hostName,
  guests,
  href,
}: {
  date: string;
  title: string;
    startTime: string | null;
  endTime: string | null;
  eventType: EventTypeRow;
  hostName: string | null;
  guests: number;
  href: string;
}) {
  const parsed = parseISO(date);
  const today = isToday(parsed);
console.log("endtime: ", endTime, "startTime: ", startTime, "date: ", date, "title: ", title);
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F4EA] transition-colors active:bg-[#E6DFC8]"
    >
      {/* Date pill */}
      <div
        className={cn(
          "shrink-0 w-14 text-center rounded-xl py-2",
          today ? "bg-[#FDCC4B]" : "bg-[#F7F4EA]"
        )}
      >
        <p
          className={cn(
            "text-[9px] font-black uppercase tracking-widest",
            today ? "text-[#26300D]" : "text-[#5F624F]"
          )}
        >
          {format(parsed, "EEE")}
        </p>
        <p
          className={cn(
            "text-xl font-black leading-tight",
            today ? "text-[#26300D]" : "text-[#1F1F1A]"
          )}
        >
          {format(parsed, "d")}
        </p>
        <p
          className={cn(
            "text-[9px] font-black uppercase tracking-widest",
            today ? "text-[#26300D]" : "text-[#5F624F]"
          )}
        >
          {format(parsed, "MMM")}
        </p>
      </div>

      {/* Event info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-black text-[#1F1F1A] truncate">{title}</p>
          {eventType && (
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-[#F7F4EA] text-[#5F624F] px-2 py-0.5 rounded-md">
              {eventType.sub_type || eventType.type}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#5F624F] font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
          {startTime && (
            <span>
              {startTime.substring(0, 5)}
              {endTime && ` - ${endTime.substring(0, 5)}`}
            </span>
          )}
          {startTime && hostName && <span className="opacity-30">·</span>}
          {hostName && <span>{hostName}</span>}
        </p>
      </div>

      {/* Guests + arrow */}
      <div className="shrink-0 flex items-center gap-3">
        {guests > 0 && (
          <div className="text-right">
            <p className="text-sm font-black text-[#1F1F1A] tabular-nums">{guests}</p>
            <p className="text-[9px] font-bold text-[#5F624F] uppercase tracking-wider">
              guests
            </p>
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40" />
      </div>
    </Link>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  label,
  highlight,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon
        className={cn("w-4 h-4", highlight ? "text-amber-600" : "text-[#5F624F]")}
      />
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F]">
        {label}
      </h2>
      {badge && (
        <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse">
          {badge}
        </span>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  positive,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  positive?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-white border border-[#E6DFC8] rounded-2xl p-4 shadow-sm">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#5F624F] mb-3 leading-tight">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl font-black tabular-nums tracking-tighter",
          positive ? "text-green-600" : warn ? "text-amber-600" : "text-[#1F1F1A]"
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] font-bold text-[#5F624F] uppercase tracking-wider mt-1">
          {sub}
        </p>
      )}
    </div>
  );
}

function ActionRow({
  label,
  count,
  icon: Icon,
  href,
  activeColor,
  activeBg,
  activeDot,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  href: string;
  activeColor: string;
  activeBg: string;
  activeDot: string;
}) {
  const hasItems = count > 0;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F4EA] transition-colors active:bg-[#E6DFC8]"
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          hasItems ? activeBg : "bg-[#F7F4EA]"
        )}
      >
        <Icon className={cn("w-4 h-4", hasItems ? activeColor : "text-[#5F624F]")} />
      </div>
      <span className="flex-1 text-[11px] font-black uppercase tracking-widest text-[#1F1F1A]">
        {label}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            "text-sm font-black tabular-nums px-2.5 py-0.5 rounded-full",
            hasItems
              ? `${activeBg} ${activeColor}`
              : "bg-[#F7F4EA] text-[#5F624F]"
          )}
        >
          {count}
        </span>
        <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40" />
      </div>
    </Link>
  );
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#E6DFC8] rounded-2xl hover:bg-[#F7F4EA] transition-colors group"
    >
      <div className="w-10 h-10 bg-[#F7F4EA] group-hover:bg-white rounded-full flex items-center justify-center transition-colors shadow-sm">
        <Icon className="w-5 h-5 text-[#26300D]" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-[#1F1F1A]">
        {label}
      </span>
    </Link>
  );
}
