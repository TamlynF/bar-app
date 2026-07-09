import React from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import {
  CalendarDays,
  Grid2X2,
  Trophy,
  Plus,
  TrendingUp,
  Zap,
} from "lucide-react";

import { isEventBehavior, type EventBehavior } from "@/lib/event-behavior";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";
import { adminBookingsHref } from "@/lib/booking-links";
import SectionLabel from "./components/section-label";
import { EventRowListClient } from "./components/event-row-list-client";
import NeedsActionHero, { type ActionItem } from "./components/needs-action-hero";
import BookingsTrend, { type TrendBooking } from "./components/bookings-trend";
import { BarChart3 } from "lucide-react"; // alongside existing lucide imports
import { fetchDashboardAnalytics } from "./lib/analytics";
import { fetchVenueSales } from "./lib/venue-sales";
import { RevenueTrendChart } from "./components/revenue-trend-chart";
import { RevenueByTypeChart } from "./components/revenue-by-type-chart";
import { VenueSalesSection } from "./components/venue-sales-section";
import StatCard from "./components/stat-card";
import { Wine } from "lucide-react";

export const dynamic = "force-dynamic";

type TableCapacityGroup = { capacity: number; assigned: number; total: number };
export type EventTypeRow = { type: string; sub_type: string; badge_color?: string | null; behavior: EventBehavior } | null;
type BookingRow = { id: number; group_size: number; status: string; group_name: string | null; total_amount: number | null; paid_amount: number | null };
type PrivateHireRow = {
  id: string;
  event_id: number | null;
  selected_date: string;
  selected_start_time: string | null;
  selected_end_time: string | null;
  reason_for_hire: string;
  reason: string | null;
  event_subtypes: { name: string; default_event_title: string | null } | { name: string; default_event_title: string | null }[] | null;
  full_name: string;
  email: string;
  phone_no: string | null;
  guest_count: number;
  deposit_amount: number | null;
  paid_amount: number | null;
};
type PrivateDetails = {
  email: string;
  phone: string | null;
  guestCount: number;
  capacityPct: number;
  depositAmount: number | null;
  outstanding: number | null;
  reasonForHire: string;
};
type BandBookingRow = {
  id: string;
  event_id: number | null;
  group_name: string | null;
  booker_name: string;
  email: string;
  phone_no: string | null;
  type: string | null;
  genre: string | null;
  payment_amount: number | null;
  payment_status: string | null;
  selected_date: string;
  selected_start_time: string | null;
  selected_end_time: string | null;
};
type BandDetails = {
  bookerName: string;
  email: string;
  phone: string | null;
  actType: string | null;
  genre: string | null;
  paymentRequired: boolean;
  paymentAmount: number | null;
};
type QuizDetails = {
  confirmedTeams: number;
  waitlistedTeams: number;
  pendingTeams: number;
  questionsGenerated: number;
  questionsTarget: number;
  tablesAssigned: boolean;
  capacityPct: number;
  tableGroups: TableCapacityGroup[];
};
type BingoDetails = {
  capacityPct: number;
  pricePerPerson: number | null;
  totalPaid: number;
  totalOutstanding: number;
  tablesAssigned: boolean;
  tableGroups: TableCapacityGroup[];
};
export type ListItem = {
  key: string;
  eventId: number;
  date: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  eventType: EventTypeRow;
  hostName: string | null;
  guests: number;
  href: string;
  quizDetails?: QuizDetails;
  bingoDetails?: BingoDetails;
  privateDetails?: PrivateDetails;
  bandDetails?: BandDetails;
};
export type UpcomingEvent = {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  host_employee_id: number | null;
  event_types: { name: string } | { name: string }[];
  event_subtypes: { name: string; color: string | null; behavior: string | null } | { name: string; color: string | null; behavior: string | null }[];
  bookings: BookingRow[];
  past_quiz_questions: { id: number }[];
};

export function getEventType(ev: UpcomingEvent): EventTypeRow {
  const t = Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types;
  const s = Array.isArray(ev.event_subtypes) ? ev.event_subtypes[0] : ev.event_subtypes;
  if (!t && !s) return null;
  return {
    type: t?.name ?? "",
    sub_type: s?.name ?? "",
    badge_color: s?.color ?? null,
    behavior: isEventBehavior(s?.behavior) ? s.behavior : "standard",
  };
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

export function getBookingsHref(et: EventTypeRow, eventId?: number): string {
  if (!et) return "/event-bookings";
  return adminBookingsHref(et.behavior, eventId);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const analyticsPromise = fetchDashboardAnalytics(supabase);
  const venueSalesPromise = fetchVenueSales(supabase);
  const nowMs = new Date().getTime();
  const todayStr = new Date().toISOString().split("T")[0];
  // 12-month horizon for the "missing quiz" deep-link's date-range filter.
  const twelveMonthsStr = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 12,
    new Date().getDate()
  ).toISOString().split("T")[0];

  // Trend chart supports week/month/year views, so fetch from the start of last
  // calendar year (covers "this year" vs "last year", and the shorter ranges).
  const trendFrom = new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1))
    .toISOString()
    .split("T")[0];

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const analytics = await analyticsPromise;
  const venueSales = await venueSalesPromise;
  
  const [
    { count: pendingPrivate },
    { count: pendingBands },
    { count: pendingEnquiries },
    { data: unpaidBookingsData },
    { data: upcomingQuizData },
  ] = await Promise.all([
    supabase
      .from("private_hire_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("band_booking_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "reviewing"]),
    supabase
      .from("enquiries")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id, total_amount, paid_amount, events!bookings_event_id_fkey!inner(is_active)")
      .eq("status", "confirmed")
      .gt("total_amount", 0)
      .eq("events.is_active", true),
    supabase
      .from("events")
      .select("id, event_subtypes!inner(behavior), past_quiz_questions(id)")
      .gte("date", todayStr)
      .lte("date", twelveMonthsStr)
      .eq("is_active", true)
      .eq("event_subtypes.behavior", "quiz"),
  ]);

  // Confirmed bookings on active events that still owe money. The paid < total
  // comparison isn't expressible in the PostgREST filter, so it's applied here.
  const unpaidCount = ((unpaidBookingsData ?? []) as { total_amount: number | null; paid_amount: number | null }[])
    .filter((b) => (b.paid_amount ?? 0) < (b.total_amount ?? 0)).length;

  const { data: bandPreferredDates } = await supabase
    .from("band_booking_requests")
    .select("preferred_dates");

  // Bookings trend (created_at + event taxonomy) for the weekly/monthly chart.
  const { data: trendRaw } = await supabase
    .from("bookings")
    .select("created_at, events!bookings_event_id_fkey!inner(event_types!inner(id, name), event_subtypes!inner(id, name))")
    .gte("created_at", trendFrom)
    .neq("status", "cancelled");

  const { data: rawUpcoming, error: upcomingError } = await supabase
    .from("events")
    .select(
      "id, date, start_time, end_time, title, host_employee_id, event_types!inner(name), event_subtypes!inner(name, color, behavior), bookings!bookings_event_id_fkey (id, group_size, status, team_id, total_amount, paid_amount), past_quiz_questions(id)"
    )
    .gte("date", todayStr)
    .neq("is_active", false)
    .order("date", { ascending: true })
    .limit(5);
  //console.log("Raw upcoming events data:", JSON.stringify(rawUpcoming, null, 2), "Error:", upcomingError);
  if (upcomingError) console.error("Upcoming events error:", upcomingError);
  
  const upcomingEvents = (rawUpcoming ?? []) as unknown as UpcomingEvent[];

  const allUpcomingBookingIds = upcomingEvents.flatMap((ev) => ev.bookings.map((b) => b.id));

  const [{ data: employees }, { data: tablesData }, { data: confirmedPrivateHires }, { data: confirmedBandBookings }, { data: categoryConfigs }, { data: tableMappings }] = await Promise.all([
    supabase.from("employees").select("id, full_name"),
    supabase.from("tables").select("id, max_capacity").eq("available", true),
    supabase
      .from("private_hire_requests")
      .select("id, event_id, selected_date, selected_start_time, selected_end_time, reason_for_hire, reason, event_subtypes:event_subtypes_id ( name, default_event_title ), full_name, email, phone_no, guest_count, deposit_amount, paid_amount")
      .eq("status", "confirmed")
      .gte("selected_date", todayStr)
      .order("selected_date", { ascending: true }),
    supabase
      .from("band_booking_requests")
      .select("id, event_id, group_name, booker_name, email, phone_no, type, genre, payment_amount, payment_status, selected_date, selected_start_time, selected_end_time")
      .eq("status", "booked")
      .gte("selected_date", todayStr)
      .order("selected_date", { ascending: true }),
    supabase.from("quiz_category_configs").select("question_count").eq("is_active", true),
    allUpcomingBookingIds.length > 0
      ? supabase.from("booking_table_mappings").select("booking_id, table_id").in("booking_id", allUpcomingBookingIds)
      : Promise.resolve({ data: [] as { booking_id: number; table_id: number }[] }),
  ]);

  // ─── Calculations ─────────────────────────────────────────────────────────

  const tableCapacityMap = new Map((tablesData ?? []).map(t => [t.id, t.max_capacity]));
  const bookingTableMap = new Map((tableMappings ?? []).map(m => [m.booking_id, m.table_id]));
  const privateHireByEventId = new Map(
    ((confirmedPrivateHires ?? []) as PrivateHireRow[])
      .filter(ph => ph.event_id != null)
      .map(ph => [ph.event_id!, ph])
  );
  const bandByEventId = new Map(
    ((confirmedBandBookings ?? []) as BandBookingRow[])
      .filter(b => b.event_id != null)
      .map(b => [b.event_id!, b])
  );
   const totalTablesByCapacity = new Map<number, number>();
 (tablesData ?? []).forEach(t => {
   totalTablesByCapacity.set(t.max_capacity, (totalTablesByCapacity.get(t.max_capacity) ?? 0) + 1);
 });
  
  const totalRequiredQuestions = (categoryConfigs ?? []).reduce(
    (sum, c) => sum + (c.question_count ?? 0), 0
  );
  const quizzesMissingQuestions = (upcomingQuizData ?? []).filter((ev) => {
    const questions = Array.isArray(ev.past_quiz_questions) ? ev.past_quiz_questions : [];
    return questions.length < totalRequiredQuestions;
  }).length;

  const now = new Date();
  const currentMonthSaturdays = getSaturdaysInMonth(now.getFullYear(), now.getMonth());
  const saturdaysBooked = new Set<string>();
  (bandPreferredDates ?? []).forEach((req) => {
    ((req.preferred_dates ?? []) as string[]).forEach((d) => {
      if (currentMonthSaturdays.includes(d)) saturdaysBooked.add(d);
    });
  });

  const totalActions =
    (pendingPrivate ?? 0) +
    (pendingBands ?? 0) +
    (pendingEnquiries ?? 0) +
    unpaidCount +
    quizzesMissingQuestions;

  const totalVenueCapacity =
    tablesData?.reduce((acc, t) => acc + t.max_capacity, 0) ?? 0;

  const totalQuestionTarget =
    (categoryConfigs ?? []).reduce((s, c) => s + (c.question_count ?? 0), 0);

  const mappedBookingIds = new Set(
    (tableMappings ?? []).map((m) => m.booking_id)
  );

  const employeeMap = new Map(
    (employees ?? []).map((e) => [e.id, e.full_name])
  );

  const computeTableGroups = (confirmedBookings: BookingRow[]): TableCapacityGroup[] => {
    const assignedByCapacity = new Map<number, number>();
    confirmedBookings.forEach(b => {
      const tableId = bookingTableMap.get(b.id);
      if (tableId !== undefined) {
        const cap = tableCapacityMap.get(tableId);
        if (cap !== undefined)
          assignedByCapacity.set(cap, (assignedByCapacity.get(cap) ?? 0) + 1);
      }
    });
    return Array.from(totalTablesByCapacity.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([capacity, total]) => ({
        capacity,
        total,
        assigned: assignedByCapacity.get(capacity) ?? 0,
      }));
  };

  const eventListItems: ListItem[] = upcomingEvents.map((ev) => {
    const et = getEventType(ev);
    const confirmedBookings = ev.bookings.filter((b) => b.status === "confirmed");
    const confirmedGuests = confirmedBookings.reduce((s, b) => s + (b.group_size ?? 0), 0);

    const isQuiz = et?.behavior === "quiz";
    const isBingo = et?.behavior === "bingo";
    const isPrivate = et?.behavior === "private";
    const isMusic = et?.behavior === "music_act";

    const bingoDetails: BingoDetails | undefined = isBingo ? (() => {
      const totalPaid = confirmedBookings.reduce((s, b) => s + (b.paid_amount ?? 0), 0);
      const totalAmount = confirmedBookings.reduce((s, b) => s + (b.total_amount ?? 0), 0);
      const firstWithPrice = confirmedBookings.find((b) => b.total_amount && b.group_size);
      const pricePerPerson = firstWithPrice
        ? Math.round((firstWithPrice.total_amount! / firstWithPrice.group_size) * 100) / 100
        : null;
      return {
        capacityPct: totalVenueCapacity > 0
          ? Math.round((confirmedGuests / totalVenueCapacity) * 100)
          : 0,
        pricePerPerson,
        totalPaid,
        totalOutstanding: Math.max(0, totalAmount - totalPaid),
        tablesAssigned:
          confirmedBookings.length > 0 &&
          confirmedBookings.every((b) => mappedBookingIds.has(b.id)),
        tableGroups: computeTableGroups(confirmedBookings),
      };
    })() : undefined;

    const quizDetails: QuizDetails | undefined = isQuiz ? {
      confirmedTeams: confirmedBookings.length,
      waitlistedTeams: ev.bookings.filter((b) => b.status === "waitlisted").length,
      pendingTeams: ev.bookings.filter((b) => b.status === "pending").length,
      questionsGenerated: (ev.past_quiz_questions ?? []).length,
      questionsTarget: totalQuestionTarget,
      tablesAssigned:
        confirmedBookings.length > 0 &&
        confirmedBookings.every((b) => mappedBookingIds.has(b.id)),
      capacityPct: totalVenueCapacity > 0
        ? Math.round((confirmedGuests / totalVenueCapacity) * 100)
        : 0,
      tableGroups: computeTableGroups(confirmedBookings),
    } : undefined;

    const ph = privateHireByEventId.get(ev.id);
    const privateDetails: PrivateDetails | undefined = isPrivate && ph ? {
      email: ph.email,
      phone: ph.phone_no,
      guestCount: ph.guest_count,
      capacityPct: totalVenueCapacity > 0
        ? Math.round((ph.guest_count / totalVenueCapacity) * 100)
        : 0,
      depositAmount: ph.deposit_amount,
      outstanding: ph.deposit_amount !== null && ph.paid_amount !== null
        ? Math.max(0, ph.deposit_amount - ph.paid_amount)
        : null,
      reasonForHire: privateHireSubtypeLabel(unwrapSubtype(ph.event_subtypes), ph.reason_for_hire),
    } : undefined;

    const bb = bandByEventId.get(ev.id);
    const bandDetails: BandDetails | undefined = isMusic && bb ? {
      bookerName: bb.booker_name,
      email: bb.email,
      phone: bb.phone_no,
      actType: bb.type,
      genre: bb.genre,
      paymentRequired: bb.payment_status !== "not_required" && bb.payment_amount !== null && bb.payment_amount > 0,
      paymentAmount: bb.payment_amount,
    } : undefined;

    return {
      key: `event-${ev.id}`,
      eventId: ev.id,
      date: ev.date,
      title: ev.title ?? "Untitled Event",
      startTime: ev.start_time,
      endTime: ev.end_time,
      eventType: et,
      hostName: ev.host_employee_id ? (employeeMap.get(ev.host_employee_id) ?? null) : null,
      href: isQuiz
        ? `/event-bookings/quiz-bookings?date=${ev.date}&eventId=${ev.id}`
        : isBingo
          ? `/event-bookings/bingo-bookings?date=${ev.date}&eventId=${ev.id}`
          : isPrivate && ph
            ? `/event-bookings/private-bookings/${ph.id}`
            : isMusic && bb
              ? `/event-bookings/music-bookings/${bb.id}`
              : `/event-bookings/event/${ev.id}`,
      guests: isPrivate && ph ? ph.guest_count : confirmedGuests,
      quizDetails,
      bingoDetails,
      privateDetails,
      bandDetails,
    };
  });

  const allListItems = [...eventListItems]
    .sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date); // ascending date
      if (dateDiff !== 0) return dateDiff;
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime); // ascending startTime
    });

  // Map trend rows to the flat shape the client chart buckets/filters.
  type IdName = { id: number; name: string };
  type TrendEventRel = { event_types: IdName | IdName[]; event_subtypes: IdName | IdName[] };
  type TrendRaw = { created_at: string; events: TrendEventRel | TrendEventRel[] | null };
  const trendBookings: TrendBooking[] = ((trendRaw ?? []) as unknown as TrendRaw[])
    .map((r) => {
      const ev = Array.isArray(r.events) ? r.events[0] : r.events;
      const t = ev ? (Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types) : null;
      const s = ev ? (Array.isArray(ev.event_subtypes) ? ev.event_subtypes[0] : ev.event_subtypes) : null;
      return {
        createdAt: r.created_at,
        typeId: t ? String(t.id) : "other",
        typeName: t?.name ?? "Other",
        subId: s ? String(s.id) : null,
        subName: s?.name ?? null,
      };
    })
    .filter((b) => !!b.createdAt);

  // Triage "Needs Action" segments — order + colour per the design.
  const actionItems: ActionItem[] = [
    { key: "unpaid", label: "Unpaid bookings", count: unpaidCount, href: "/event-bookings/unpaid", color: "bg-amber-700" },
    { key: "bands", label: "Bands pending", count: pendingBands ?? 0, href: "/event-bookings/general/music/__all__?status=new,reviewing", color: "bg-purple-700" },
    { key: "hires", label: "Private hires pending", count: pendingPrivate ?? 0, href: "/event-bookings/general/private/__all__?status=pending", color: "bg-blue-600" },
    { key: "enquiries", label: "Enquiries pending", count: pendingEnquiries ?? 0, href: "/requests/enquiries?status=pending", color: "bg-teal-600" },
    { key: "quizzes", label: "Missing quiz", count: quizzesMissingQuestions, href: `/event-setups/events?from=${todayStr}&to=${twelveMonthsStr}&quick=quiz,active`, color: "bg-green-700" },
    //{ key: "saturdays", label: "Saturdays", count: openSaturdays, href: "/event-bookings/music-bookings", color: "bg-red-600" },    
    //{ key: "seatable-waitlist", label: "Waitlist", count: seatableWaitlistCount, href: "/event-bookings/quiz-bookings?status=waitlisted", color: "bg-teal-600" },
  ];

  // Everything upcoming (incl. tonight) lists together in "Coming Up"; tonight's
  // event is flagged inside the row list (see EventRowListClient).
  const comingUp = allListItems;


  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex-1 bg-background pb-24">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 sm:py-0 md:px-6">

        <header className="flex justify-center">
          <p className="text-sm font-bold tracking-wide text-[#5F624F] uppercase">
            {format(new Date(), "EEEE, do MMMM yyyy")}
          </p>
        </header>

        {/* TRIAGE: what's wrong — needs-action hero */}
        <NeedsActionHero items={actionItems} total={totalActions} />

        {/* Bookings graph spans full width (like the needs-action hero); below it
            Trends fills the wide left column and "at a Glance" + "Coming Up" stack
            in the right column. Mobile stacks in source order. */}
        <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">

          {/* Bookings trend — full width, matching the needs-action hero */}
          <div className="lg:col-span-2 lg:row-start-1">
            <BookingsTrend bookings={trendBookings} nowMs={nowMs} />
          </div>

          {/* SECTION: TRENDS — wide left column */}
          <section className="space-y-2 lg:col-start-1 lg:row-start-2">
            <SectionLabel icon={BarChart3} label="Trends" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RevenueTrendChart data={analytics.weekly} />
              <RevenueByTypeChart
                data={analytics.revenueByType}
                bandSpend={analytics.bandSpendThisMonth}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Returning"
                value={`${analytics.guestSplit.returningPct}%`}
                sub="of month's guests"
              />
              <StatCard
                label="Cancellations"
                value={`${analytics.cancellationPct}%`}
                sub="of bookings"
                warn={analytics.cancellationPct > 15}
              />
              <StatCard
                label="Lead Time"
                value={`${analytics.medianLeadDays}d`}
                sub="median booking"
              />
            </div>
          </section>

          {/* Right column: this month "at a Glance", then "Coming Up" beneath it */}
          <div className="space-y-5 lg:col-start-2 lg:row-start-2">
            <section className="space-y-2">
              <SectionLabel
                icon={TrendingUp}
                label={`${format(new Date(), "MMMM")} at a Glance`}
              />
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Collected"
                  value={`£${analytics.thisMonth.collected.toFixed(2)}`}
                  sub="revenue paid"
                  positive
                  delta={analytics.deltas.collected}
                />
                <StatCard
                  label="Outstanding"
                  value={`£${analytics.thisMonth.outstanding.toFixed(2)}`}
                  sub="to collect"
                  warn={analytics.thisMonth.outstanding > 0}
                />
                <StatCard
                  label="Bookings"
                  value={analytics.thisMonth.bookings}
                  sub="this month"
                  delta={analytics.deltas.bookings}
                />
                <StatCard
                  label="New Guests"
                  value={analytics.guestSplit.newGuests}
                  sub="first-time bookers"
                />
              </div>
            </section>

            {/* Coming Up (incl. tonight) — directly under "at a Glance" */}
            <section className="space-y-2">
              <SectionLabel icon={CalendarDays} label="Coming Up" />
              {comingUp.length > 0 ? (
                <EventRowListClient items={comingUp} />
              ) : (
                <div className="rounded-2xl border border-[#E6DFC8] bg-white p-10 text-center">
                  <CalendarDays className="mx-auto mb-3 h-10 w-10 text-[#5F624F] opacity-20" />
                  <p className="font-black text-sm text-[#1F1F1A]">No Upcoming Events</p>
                  <p className="mt-1 text-[11px] font-medium text-[#5F624F]">
                    Schedule an event in Settings to see it here.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* SECTION: VENUE SALES (actual Square takings — distinct from pre-booked revenue) */}
          <section className="space-y-2 lg:col-span-2">
            <SectionLabel icon={Wine} label="Venue Sales" />
            <VenueSalesSection data={venueSales} />
          </section>
        </div>

        {/* Quick links */}
        <section className="space-y-2">
          <SectionLabel icon={Zap} label="Quick Links" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickLink href="/book/bingo" label="Walk-in" icon={Plus} />
            <QuickLink href="/settings/tables" label="Floor Plan" icon={Grid2X2} />
            <QuickLink href="/event-setups/quiz-generator" label="Quiz" icon={Trophy} />
            <QuickLink href="/event-setups/events" label="Schedule" icon={CalendarDays} />
          </div>
        </section>

      </div>
    </div>
  );
}





// ─── Shared Components ─────────────────────────────────────────────────────






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
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#E6DFC8] bg-white p-4 transition-colors hover:bg-[#F7F4EA]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F4EA] shadow-sm transition-colors group-hover:bg-white">
        <Icon className="h-5 w-5 text-[#5C4033]" />
      </div>
      <span className="font-black text-[10px] tracking-wide text-[#1F1F1A] uppercase">
        {label}
      </span>
    </Link>
  );
}
