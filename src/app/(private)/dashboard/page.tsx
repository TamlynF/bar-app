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

import SectionLabel from "./components/section-label";
import { EventRowListClient } from "./components/event-row-list-client";
import TonightCard from "./components/tonight-card";
import StatCard from "./components/stat-card";
import ActionRow from "./components/action-row";
import LeaderboardCard, { type LeaderboardEntry } from "./components/leaderboard-card";

export const dynamic = "force-dynamic";

type TableCapacityGroup = { capacity: number; assigned: number; total: number };
export type EventTypeRow = { type: string; sub_type: string; badge_color?: string | null } | null;
type BookingRow = { id: number; group_size: number; status: string; group_name: string | null; total_amount: number | null; paid_amount: number | null };
type PrivateHireRow = {
  id: string;
  event_id: number | null;
  selected_date: string;
  selected_start_time: string | null;
  selected_end_time: string | null;
  reason_for_hire: string;
  reason: string | null;
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
  event_types: EventTypeRow | EventTypeRow[];
  bookings: BookingRow[];
  past_quiz_questions: { id: number }[];
};

export function getEventType(ev: UpcomingEvent): EventTypeRow {
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

export function getBookingsHref(et: EventTypeRow, eventId?: number): string {
  if (!et) return "/event-bookings";
  const s = et.sub_type?.toLowerCase() ?? "";
  const t = et.type?.toLowerCase() ?? "";
  if (s.includes("bingo") || t.includes("bingo")) return "/event-bookings/bingo-bookings";
  if (s.includes("quiz") || t.includes("quiz")) return "/event-bookings/quiz-bookings";
  if (t.includes("music") || t.includes("band") || t.includes("live")) return "/event-bookings/music-bookings";
  if (t.includes("private")) return "/event-bookings/private-bookings";
  if (eventId) return `/event-bookings/event/${eventId}`;
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
      .eq("status", "pending_review")
      .gte("preferred_date", firstDayOfMonth),
    supabase
      .from("band_booking_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("bookings")
      .select("id, events!bookings_event_id_fkey!inner(date)")
      .eq("payment_status", "unpaid")
      .gt("total_amount", 0)
      .in("status", ["confirmed", "pending"])
      .gte("events.date", todayStr),
    supabase
      .from("events")
      .select("id, event_types!inner(sub_type, type), past_quiz_questions(id)")
      .gte("date", todayStr)
      .eq("is_active", true)
      .ilike("event_types.sub_type", "%quiz%"),
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

  const { data: leaderboardScores, error: leaderboardError } = await supabase
    .from("booking_scores")
    .select("id, score, is_winner, bookings(id, group_name), events(id, title, date)");
  if (leaderboardError) console.error("Leaderboard query error:", leaderboardError);

  const { data: rawUpcoming, error: upcomingError } = await supabase
    .from("events")
    .select(
      "id, date, start_time, end_time, title, host_employee_id, event_types!inner(type, sub_type, badge_color), bookings!bookings_event_id_fkey (id, group_size, status, team_id, total_amount, paid_amount), past_quiz_questions(id)"
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
      .select("id, event_id, selected_date, selected_start_time, selected_end_time, reason_for_hire, reason, full_name, email, phone_no, guest_count, deposit_amount, paid_amount")
      .eq("status", "confirmed")
      .gte("selected_date", todayStr)
      .order("selected_date", { ascending: true }),
    supabase
      .from("band_booking_requests")
      .select("id, event_id, group_name, booker_name, email, phone_no, type, genre, payment_amount, payment_status, selected_date, selected_start_time, selected_end_time")
      .eq("status", "approved")
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

  // ─── Leaderboard Aggregation ─────────────────────────────────────────────
  const topTeams: LeaderboardEntry[] = (() => {
    const statsMap: Record<string, LeaderboardEntry> = {};
    (leaderboardScores ?? []).forEach((record: { score: number | null; is_winner: boolean | null; bookings: { id: number; group_name: string | null } | { id: number; group_name: string | null }[] | null }) => {
      const booking = Array.isArray(record.bookings) ? record.bookings[0] : record.bookings;
      const teamName = booking?.group_name || "Unknown Team";
      if (!statsMap[teamName]) {
        statsMap[teamName] = { team_name: teamName, wins: 0, quizzes_attended: 0, total_score: 0 };
      }
      statsMap[teamName].quizzes_attended += 1;
      statsMap[teamName].total_score += record.score || 0;
      if (record.is_winner) statsMap[teamName].wins += 1;
    });
    return Object.values(statsMap)
      .sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.total_score - a.total_score)
      .slice(0, 5);
  })();

  const eventListItems: ListItem[] = upcomingEvents.map((ev) => {
    const et = getEventType(ev);
    const confirmedBookings = ev.bookings.filter((b) => b.status === "confirmed");
    const confirmedGuests = confirmedBookings.reduce((s, b) => s + (b.group_size ?? 0), 0);

    const isQuiz =
      et?.sub_type?.toLowerCase().includes("quiz") ||
      et?.type?.toLowerCase().includes("quiz");

    const isBingo =
      et?.sub_type?.toLowerCase().includes("bingo") ||
      et?.type?.toLowerCase().includes("bingo");

    const isPrivate =
      et?.sub_type?.toLowerCase().includes("private") ||
      et?.type?.toLowerCase().includes("private");

    const isMusic =
      et?.sub_type?.toLowerCase().includes("music") ||
      et?.type?.toLowerCase().includes("music");

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
      reasonForHire: ph.reason || ph.reason_for_hire,
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

  //console.log("All List Items:", allListItems);
  const tonightGeneralEvent = allListItems[0]?.date === todayStr ? allListItems[0] : null;
  const tonightGuests = tonightGeneralEvent?.guests ?? 0;

  //console.log("tonightgen", tonightGeneralEvent);
  const capacityPercent =
    totalVenueCapacity > 0
      ? Math.min(100, Math.round((tonightGuests / totalVenueCapacity) * 100))
      : 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 bg-background min-h-screen pb-24">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">

        <header className="flex justify-center">
          <p className="text-sm font-bold text-[#5F624F] uppercase tracking-wide">
            {format(new Date(), "EEEE, do MMMM yyyy")}
          </p>
        </header>

        {/* SECTION A: NEEDS ACTION */}
        <section className="space-y-2">
          <SectionLabel
            icon={BellRing}
            label="Needs Action"
            highlight={totalActions > 0}
            badge={totalActions > 0 ? `${totalActions} Pending` : undefined}
          />
          <div className="bg-white border border-[#E6DFC8] rounded-2xl divide-y divide-[#E6DFC8] overflow-hidden">
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
              activeColor="text-purple-700"
              activeBg="bg-purple-100"
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
              label="Incomplete Quizzes"
              count={quizzesMissingQuestions}
              href="/event-setups/events?filter=quiz-incomplete"
              activeColor="text-green-700"
              activeBg="bg-green-50"
              activeDot="bg-green-500"
            />
            <ActionRow
              icon={Music}
              label="Open Saturdays This Month"
              count={openSaturdays}
              href="/event-bookings/music-bookings"
              activeColor="text-red-600"
              activeBg="bg-red-50"
              activeDot="bg-rose-500"
            />
          </div>
        </section>

        {/* SECTION B: THIS MONTH */}
        <section className="space-y-2">
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

        {/* SECTION: QUIZ LEADERBOARD */}
        <section className="space-y-2">
          <SectionLabel icon={Trophy} label="Quiz Leaderboard" />
          <LeaderboardCard entries={topTeams} />
        </section>

        {/* SECTION C: UPCOMING EVENTS */}
        <section className="space-y-3">
          <SectionLabel icon={CalendarDays} label="Upcoming Events" />

          {tonightGeneralEvent && (
            <TonightCard
              event={tonightGeneralEvent}
              guests={tonightGuests}
              capacity={totalVenueCapacity}
              capacityPercent={capacityPercent}
            />
          )}

          {allListItems.length > 0 ? (
            <EventRowListClient items={allListItems} />
          ) : !tonightGeneralEvent ? (
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
            <QuickLink href="/event-setups/quiz-generator" label="Quiz" icon={Trophy} />
            <QuickLink href="/event-setups" label="Events" icon={CalendarDays} />
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
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-[#E6DFC8] rounded-2xl hover:bg-[#F7F4EA] transition-colors group"
    >
      <div className="w-10 h-10 bg-[#F7F4EA] group-hover:bg-white rounded-full flex items-center justify-center transition-colors shadow-sm">
        <Icon className="w-5 h-5 text-[#5C4033]" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-wide text-[#1F1F1A]">
        {label}
      </span>
    </Link>
  );
}
