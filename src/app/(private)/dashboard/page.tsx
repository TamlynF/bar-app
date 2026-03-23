import React from "react"
import { createClient } from "../../../lib/supabase/server"
import Link from "next/link"
import { format, differenceInDays, parseISO, isThisMonth } from "date-fns"
import {
  CheckCircle2,
  Clock3,
  Users,
  AlertTriangle,
  Trophy,
  Music,
  Building2,
  CalendarDays,
  ArrowRight,
  ChevronRight,
  UserPlus,
  Sparkles,
} from "lucide-react"
import { StatCard } from "./components/stat-card"
import { PendingReviews } from "./components/pending-reviews"
import { BandCalendarClient } from "./components/band-calendar-client"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStat = { id: string; status: string; created_at: string }

type UpcomingEventBooking = {
  id: string
  group_name: string | null
  group_size: number | null
  status: string | null
  created_at: string
  contacts: { full_name: string | null } | null
  booking_table_mappings: Array<{
    tables: { id: number; name: string; max_capacity: number } | null
  }>
}

type UpcomingEvent = {
  id: string
  date: string
  title: string | null
  start_time: string | null
  bookings: UpcomingEventBooking[]
}

type WaitlistedBooking = {
  id: string
  group_name: string | null
  group_size: number | null
  created_at: string
  contacts: { full_name: string | null; email: string | null } | null
  events: { date: string } | null
}

type RecentBooking = {
  id: string
  group_name: string | null
  group_size: number | null
  status: string | null
  created_at: string
  contacts: { full_name: string | null } | null
}

type BandDateData = {
  preferred_dates: string[] | null
  status: string
  booker_name: string
}

type PrivateHireItem = {
  id: string
  full_name: string
  guest_count: number
  preferred_date: string | null
  preferred_time: string | null
  reason_for_hire: string
  status: string
  created_at: string
}

type QuizCategory = {
  id: number
  category_name: string
  question_count: number
}

type QuizQuestionStat = {
  quiz_category_configs_id: number | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  let allBookings: BookingStat[] = []
  let nextEvent: UpcomingEvent | null = null
  let waitlistedBookings: WaitlistedBooking[] = []
  let recentBookings: RecentBooking[] = []
  let pendingBandItems: { id: string; name: string; email: string; created_at: string }[] = []
  let pendingPrivateItems: { id: string; name: string; email: string; created_at: string }[] = []
  let bandDateData: BandDateData[] = []
  let privateHireItems: PrivateHireItem[] = []
  let allBandRequests: { id: string; created_at: string }[] = []
  let allPrivateRequests: { id: string; created_at: string }[] = []
  let newContactsCount = 0
  let quizCategories: QuizCategory[] = []
  let quizQuestionsForEvent: QuizQuestionStat[] = []

  try {
    const supabase = await createClient()
    const today = new Date().toISOString().split("T")[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString()

    const [
      { data: bookingsData },
      { data: nextEventArr },
      { data: waitlistedData },
      { data: recentData },
      { data: pendingBandData },
      { data: pendingPrivateData },
      { data: bandDatesData },
      { data: privateHireData },
      { data: bandAllData },
      { data: privateAllData },
      { data: contactsData },
    ] = await Promise.all([
      // Stat cards — all quiz bookings (lightweight)
      supabase.from("bookings").select("id, status, created_at"),

      // Next upcoming quiz event with nested bookings + table mappings
      supabase
        .from("events")
        .select(
          `id, date, title, start_time,
          event_types!inner(type, sub_type),
          bookings(
            id, group_name, group_size, status, created_at,
            contacts(full_name),
            booking_table_mappings(tables(id, name, max_capacity))
          )`
        )
        .ilike("event_types.type", "game")
        .ilike("event_types.sub_type", "quiz")
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(1),

      // Waitlisted bookings for future events
      supabase
        .from("bookings")
        .select(
          `id, group_name, group_size, created_at,
          contacts(full_name, email),
          events!inner(date)`
        )
        .eq("status", "waitlisted")
        .gte("events.date", today)
        .order("created_at", { ascending: true }),

      // Recent bookings — last 7 days, not cancelled
      supabase
        .from("bookings")
        .select(
          `id, group_name, group_size, status, created_at,
          contacts(full_name)`
        )
        .gte("created_at", sevenDaysAgo)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(6),

      // Pending band reviews
      supabase
        .from("band_booking_requests")
        .select("id, booker_name, email, created_at")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false }),

      // Pending private hire
      supabase
        .from("private_hire_requests")
        .select("id, full_name, email, created_at")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false }),

      // Band preferred dates (confirmed + pending — for calendar)
      supabase
        .from("band_booking_requests")
        .select("preferred_dates, status, booker_name")
        .in("status", ["pending_review", "confirmed"]),

      // Private hire — pending + upcoming confirmed
      supabase
        .from("private_hire_requests")
        .select(
          "id, full_name, guest_count, preferred_date, preferred_time, reason_for_hire, status, created_at"
        )
        .in("status", ["pending_review", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(6),

      // All band requests (for total bookings this month stat)
      supabase
        .from("band_booking_requests")
        .select("id, created_at")
        .neq("status", "rejected"),

      // All private hire requests (for total bookings this month stat)
      supabase
        .from("private_hire_requests")
        .select("id, created_at")
        .neq("status", "rejected"),

      // New contacts this month
      supabase.from("contacts").select("id, created_at"),
    ])

    allBookings = (bookingsData as unknown as BookingStat[]) ?? []
    nextEvent = ((nextEventArr as unknown as UpcomingEvent[])?.[0]) ?? null
    waitlistedBookings = (waitlistedData as unknown as WaitlistedBooking[]) ?? []
    recentBookings = (recentData as unknown as RecentBooking[]) ?? []
    pendingBandItems = (pendingBandData ?? []).map((r) => ({
      id: r.id,
      name: r.booker_name,
      email: r.email,
      created_at: r.created_at,
    }))
    pendingPrivateItems = (pendingPrivateData ?? []).map((r) => ({
      id: r.id,
      name: r.full_name,
      email: r.email,
      created_at: r.created_at,
    }))
    bandDateData = (bandDatesData as unknown as BandDateData[]) ?? []
    privateHireItems = (privateHireData as unknown as PrivateHireItem[]) ?? []
    allBandRequests = (bandAllData ?? []) as { id: string; created_at: string }[]
    allPrivateRequests = (privateAllData ?? []) as { id: string; created_at: string }[]

    const contacts = (contactsData ?? []) as { id: string; created_at: string }[]
    newContactsCount = contacts.filter((c) => {
      try { return isThisMonth(parseISO(c.created_at)) } catch { return false }
    }).length

    // Phase 2: quiz readiness (only if next event exists)
    if (nextEvent) {
      const [{ data: catsData }, { data: qqData }] = await Promise.all([
        supabase
          .from("quiz_category_configs")
          .select("id, category_name, question_count")
          .order("category_name", { ascending: true }),
        supabase
          .from("past_quiz_questions")
          .select("quiz_category_configs_id")
          .eq("events_id", nextEvent.id),
      ])
      quizCategories = (catsData as unknown as QuizCategory[]) ?? []
      quizQuestionsForEvent = (qqData as unknown as QuizQuestionStat[]) ?? []
    }
  } catch (err) {
    console.error("Dashboard data unavailable:", err)
  }

  // ─── Stat card calculations ────────────────────────────────────────────────

  const thisMonthFilter = (item: { created_at: string }) => {
    try { return isThisMonth(parseISO(item.created_at)) } catch { return false }
  }

  const totalBookingsThisMonth =
    allBookings.filter((b) => b.status !== "cancelled" && thisMonthFilter(b)).length +
    allBandRequests.filter(thisMonthFilter).length +
    allPrivateRequests.filter(thisMonthFilter).length

  const totalPending = pendingBandItems.length + pendingPrivateItems.length
  const totalActive = allBookings.filter((b) => b.status !== "cancelled").length

  const pendingItems = [
    ...pendingBandItems.map((b) => ({ ...b, type: "band" as const })),
    ...pendingPrivateItems.map((b) => ({ ...b, type: "private" as const })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // ─── Quiz section ──────────────────────────────────────────────────────────

  const confirmedBookings = (nextEvent?.bookings ?? []).filter(
    (b) => b.status === "confirmed"
  )
  const waitlistedNextEvent = (nextEvent?.bookings ?? []).filter(
    (b) => b.status === "waitlisted"
  )
  const totalGuests = confirmedBookings.reduce(
    (sum, b) => sum + (b.group_size ?? 0),
    0
  )

  const assignedTableIds = new Set(
    confirmedBookings
      .flatMap((b) => b.booking_table_mappings?.map((m) => m.tables?.id))
      .filter((id): id is number => id != null)
  )

  const daysUntilQuiz = nextEvent
    ? differenceInDays(parseISO(nextEvent.date), new Date())
    : null

  const daysLabel =
    daysUntilQuiz === null
      ? null
      : daysUntilQuiz === 0
      ? "Tonight!"
      : daysUntilQuiz === 1
      ? "Tomorrow"
      : `In ${daysUntilQuiz} days`

  // ─── Quiz readiness ────────────────────────────────────────────────────────

  type CategoryReadiness = {
    id: number
    category_name: string
    target: number
    current: number
    complete: boolean
  }

  const categoryReadiness: CategoryReadiness[] = quizCategories.map((cat) => {
    const current = quizQuestionsForEvent.filter(
      (q) => q.quiz_category_configs_id === cat.id
    ).length
    return {
      id: cat.id,
      category_name: cat.category_name,
      target: cat.question_count,
      current,
      complete: current >= cat.question_count,
    }
  })

  const quizStatus: "ready" | "in-progress" | "not-started" | "no-event" | "no-categories" =
    !nextEvent
      ? "no-event"
      : quizCategories.length === 0
      ? "no-categories"
      : quizQuestionsForEvent.length === 0
      ? "not-started"
      : categoryReadiness.every((c) => c.complete)
      ? "ready"
      : "in-progress"

  const incompleteCategories = categoryReadiness.filter((c) => !c.complete)

  // ─── Band calendar calculations ────────────────────────────────────────────

  const confirmedBandDateStrings: string[] = []
  const pendingBandDateStrings: string[] = []
  const dateCountMap = new Map<string, number>()

  for (const band of bandDateData) {
    if (!band.preferred_dates) continue
    for (const dateStr of band.preferred_dates) {
      if (band.status === "confirmed") {
        confirmedBandDateStrings.push(dateStr)
      } else {
        pendingBandDateStrings.push(dateStr)
        dateCountMap.set(dateStr, (dateCountMap.get(dateStr) ?? 0) + 1)
      }
    }
  }

  let popularBandDateString: string | null = null
  let maxDateCount = 0
  for (const [dateStr, count] of dateCountMap.entries()) {
    if (count > maxDateCount) {
      maxDateCount = count
      popularBandDateString = dateStr
    }
  }

  const totalConfirmedBand = bandDateData.filter((b) => b.status === "confirmed").length
  const totalPendingBand = pendingBandItems.length
  const hasBandCalendarData =
    confirmedBandDateStrings.length > 0 || pendingBandDateStrings.length > 0

  // ─── Private hire ──────────────────────────────────────────────────────────

  const today = new Date().toISOString().split("T")[0]
  const pendingPrivateHire = privateHireItems.filter(
    (r) => r.status === "pending_review"
  )
  const upcomingConfirmedPrivate = privateHireItems.filter(
    (r) => r.status === "confirmed" && r.preferred_date && r.preferred_date >= today
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 bg-background min-h-screen">
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 text-left">

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Bookings This Month"
            value={totalBookingsThisMonth}
            icon={CheckCircle2}
            accent="#16a34a"
          />
          <StatCard
            label="New Contacts"
            value={newContactsCount}
            icon={UserPlus}
            accent="#0284c7"
          />
          <StatCard
            label="Needs Review"
            value={totalPending}
            icon={Clock3}
            accent="#d97706"
            urgent={totalPending > 0}
          />
          <StatCard
            label="Waitlisted"
            value={waitlistedBookings.length}
            icon={AlertTriangle}
            accent="#7c3aed"
          />
        </div>

        {/* ── Pending Reviews Banner ── */}
        <PendingReviews items={pendingItems} />

        {/* ══════════════════════════════
            QUIZ NIGHT SECTION
        ══════════════════════════════ */}
        <section className="space-y-4">
          <SectionHeader
            icon={<Trophy className="w-4 h-4 text-[#26300D]" />}
            title="Quiz Night"
            linkHref="/events/quiz-bookings"
            linkLabel="All Bookings"
          />

          {nextEvent ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ── Left: compact next quiz card ── */}
              <div className="bg-[#26300D] text-white rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#FDCC4B] opacity-80">
                      Next Quiz Night
                    </p>
                    <p className="text-lg font-black tracking-tight mt-0.5 leading-tight">
                      {format(parseISO(nextEvent.date), "EEEE do MMMM")}
                    </p>
                    {daysLabel && (
                      <p className="text-[10px] text-white/50 font-bold mt-0.5">
                        {daysLabel}
                      </p>
                    )}
                  </div>
                  <CalendarDays className="w-4 h-4 text-[#FDCC4B] opacity-40 shrink-0 mt-1" />
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-white/10 rounded-xl p-2.5">
                    <p className="text-xl font-black tabular-nums">
                      {confirmedBookings.length}
                    </p>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-50 mt-0.5">
                      Teams
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2.5">
                    <p className="text-xl font-black tabular-nums">{totalGuests}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-50 mt-0.5">
                      Guests
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2.5">
                    <p className="text-xl font-black tabular-nums">
                      {assignedTableIds.size}
                    </p>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-50 mt-0.5">
                      Tables
                    </p>
                  </div>
                </div>

                {waitlistedNextEvent.length > 0 && (
                  <div className="flex items-center gap-2 bg-orange-500/20 rounded-xl px-3 py-2">
                    <Clock3 className="w-3 h-3 text-orange-300 shrink-0" />
                    <span className="text-[10px] font-black text-orange-200">
                      {waitlistedNextEvent.length} team
                      {waitlistedNextEvent.length !== 1 ? "s" : ""} on waitlist
                    </span>
                  </div>
                )}
              </div>

              {/* ── Right: quiz readiness + waitlisted ── */}
              <div className="bg-white border border-[#E6DFC8] rounded-2xl p-4 space-y-3 flex flex-col">

                {/* Quiz readiness */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5F624F]">
                      Quiz Status
                    </p>
                    <Link
                      href="/quiz-generator"
                      className="text-[9px] font-black uppercase tracking-widest text-[#5F624F] hover:text-[#26300D] transition-colors flex items-center gap-0.5"
                    >
                      Generator <ChevronRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>

                  {quizStatus === "ready" && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                      <Sparkles className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      <span className="text-[11px] font-black text-green-700">
                        Quiz Ready — all categories complete
                      </span>
                    </div>
                  )}

                  {quizStatus === "not-started" && (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span className="text-[11px] font-black text-rose-700">
                        Quiz not started — no questions generated
                      </span>
                    </div>
                  )}

                  {quizStatus === "in-progress" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <Clock3 className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="text-[10px] font-black text-amber-700">
                          {incompleteCategories.length} categor{incompleteCategories.length !== 1 ? "ies" : "y"} incomplete
                        </span>
                      </div>
                      <div className="space-y-1 pl-1">
                        {incompleteCategories.slice(0, 4).map((cat) => (
                          <div key={cat.id} className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#5F624F] truncate">
                              {cat.category_name}
                            </span>
                            <span className="text-[10px] font-black tabular-nums text-[#1F1F1A] ml-2 shrink-0">
                              {cat.current}/{cat.target}
                            </span>
                          </div>
                        ))}
                        {incompleteCategories.length > 4 && (
                          <p className="text-[9px] text-[#5F624F] font-bold opacity-60">
                            +{incompleteCategories.length - 4} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {quizStatus === "no-categories" && (
                    <div className="flex items-center gap-2 bg-[#F7F4EA] border border-[#E6DFC8] rounded-xl px-3 py-2.5">
                      <span className="text-[11px] font-bold text-[#5F624F]">
                        No categories configured
                      </span>
                    </div>
                  )}
                </div>

                <div className="h-px bg-[#E6DFC8]" />

                {/* Waitlisted for next event */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5F624F]">
                      Waitlisted
                    </p>
                    {waitlistedNextEvent.length > 0 && (
                      <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                        {waitlistedNextEvent.length}
                      </span>
                    )}
                  </div>

                  {waitlistedNextEvent.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-[11px] font-bold text-[#5F624F]">
                        No waitlisted teams
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {waitlistedNextEvent.slice(0, 3).map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-[#1F1F1A] truncate">
                            {booking.group_name || booking.contacts?.full_name || "Unknown"}
                          </span>
                          <span className="text-[10px] font-bold text-[#5F624F] ml-2 shrink-0">
                            {booking.group_size} guests
                          </span>
                        </div>
                      ))}
                      {waitlistedNextEvent.length > 3 && (
                        <Link
                          href="/events/quiz-bookings"
                          className="text-[9px] font-black text-[#5F624F] uppercase tracking-widest hover:text-[#26300D] transition-colors"
                        >
                          +{waitlistedNextEvent.length - 3} more →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E6DFC8] rounded-2xl p-8 text-center">
              <CalendarDays className="w-7 h-7 text-[#5F624F] opacity-40 mx-auto mb-2" />
              <p className="text-sm font-black text-[#1F1F1A]">
                No upcoming quiz nights scheduled
              </p>
            </div>
          )}

          {/* Recent Activity */}
          {recentBookings.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-60">
                Recent Bookings (Last 7 Days)
              </p>
              <div className="flex flex-wrap gap-2">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold",
                      booking.status === "confirmed"
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-orange-50 border-orange-200 text-orange-800"
                    )}
                  >
                    <span>
                      {booking.group_name ||
                        booking.contacts?.full_name ||
                        "Guest"}
                    </span>
                    <span className="opacity-50 text-xs">
                      · {booking.group_size} guests
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ══════════════════════════════
            MUSIC BOOKINGS SECTION
        ══════════════════════════════ */}
        <section className="space-y-4">
          <SectionHeader
            icon={<Music className="w-4 h-4 text-[#26300D]" />}
            title="Music Bookings"
            linkHref="/events/music-bookings"
            linkLabel="All Applications"
          />

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className={cn(
                "bg-white border rounded-2xl p-4 text-center",
                totalPendingBand > 0
                  ? "border-amber-300 bg-amber-50/60"
                  : "border-[#E6DFC8]"
              )}
            >
              <p
                className={cn(
                  "text-2xl font-black",
                  totalPendingBand > 0 ? "text-amber-700" : "text-[#1F1F1A]"
                )}
              >
                {totalPendingBand}
              </p>
              <p
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest mt-0.5",
                  totalPendingBand > 0 ? "text-amber-600" : "text-[#5F624F]"
                )}
              >
                Pending Review
              </p>
            </div>
            <div className="bg-white border border-[#E6DFC8] rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-[#1F1F1A]">{totalConfirmedBand}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#5F624F] mt-0.5">
                Confirmed
              </p>
            </div>
            <div className="bg-white border border-[#E6DFC8] rounded-2xl p-4 text-center">
              {popularBandDateString ? (
                <>
                  <p className="text-base font-black text-[#1F1F1A] leading-tight">
                    {format(parseISO(popularBandDateString), "d MMM")}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#5F624F] mt-0.5">
                    Most Wanted
                  </p>
                  <p className="text-[10px] font-bold text-[#5F624F] opacity-60">
                    {maxDateCount} act{maxDateCount !== 1 ? "s" : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-black text-[#1F1F1A]">—</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#5F624F] mt-0.5">
                    No Dates Yet
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Band Calendar */}
          {hasBandCalendarData ? (
            <div className="bg-white border border-[#E6DFC8] rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] mb-4">
                Preferred Dates
              </p>
              <BandCalendarClient
                confirmedDateStrings={confirmedBandDateStrings}
                pendingDateStrings={pendingBandDateStrings}
                popularDateString={popularBandDateString}
              />
            </div>
          ) : (
            <div className="bg-white border border-[#E6DFC8] rounded-2xl p-8 text-center">
              <Music className="w-7 h-7 text-[#5F624F] opacity-40 mx-auto mb-2" />
              <p className="text-sm font-black text-[#1F1F1A]">
                No date preferences submitted yet
              </p>
            </div>
          )}

          {/* Pending band applications list */}
          {pendingBandItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-60">
                Awaiting Review
              </p>
              <div className="space-y-2">
                {pendingBandItems.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href="/events/music-bookings"
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#E6DFC8] hover:border-[#26300D]/30 transition-all group"
                  >
                    <Music className="w-4 h-4 text-[#5F624F] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[#1F1F1A] truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-[#5F624F] font-bold truncate">
                        {item.email}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#5F624F] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                ))}
                {pendingBandItems.length > 3 && (
                  <Link
                    href="/events/music-bookings"
                    className="block text-center text-[10px] font-black uppercase tracking-widest py-2 rounded-xl bg-[#F7F4EA] text-[#5F624F] hover:text-[#26300D] hover:bg-[#E6DFC8] transition-colors"
                  >
                    View all {pendingBandItems.length} applications →
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ══════════════════════════════
            PRIVATE HIRE SECTION
        ══════════════════════════════ */}
        <section className="space-y-4 pb-8">
          <SectionHeader
            icon={<Building2 className="w-4 h-4 text-[#26300D]" />}
            title="Private Hire"
            linkHref="/events/private-bookings"
            linkLabel="All Enquiries"
          />

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className={cn(
                "bg-white border rounded-2xl p-4",
                pendingPrivateHire.length > 0
                  ? "border-amber-300 bg-amber-50/60"
                  : "border-[#E6DFC8]"
              )}
            >
              <p
                className={cn(
                  "text-2xl font-black",
                  pendingPrivateHire.length > 0 ? "text-amber-700" : "text-[#1F1F1A]"
                )}
              >
                {pendingPrivateHire.length}
              </p>
              <p
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest mt-0.5",
                  pendingPrivateHire.length > 0 ? "text-amber-600" : "text-[#5F624F]"
                )}
              >
                Pending Enquiries
              </p>
            </div>
            <div className="bg-white border border-[#E6DFC8] rounded-2xl p-4">
              <p className="text-2xl font-black text-[#1F1F1A]">
                {upcomingConfirmedPrivate.length}
              </p>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#5F624F] mt-0.5">
                Upcoming Confirmed
              </p>
            </div>
          </div>

          {/* Pending private hire list */}
          {pendingPrivateHire.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-60">
                Awaiting Review
              </p>
              <div className="space-y-2">
                {pendingPrivateHire.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href="/events/private-bookings"
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#E6DFC8] hover:border-[#26300D]/30 transition-all group"
                  >
                    <Building2 className="w-4 h-4 text-[#5F624F] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[#1F1F1A] truncate">
                        {item.full_name}
                      </p>
                      <p className="text-[10px] text-[#5F624F] font-bold truncate">
                        {item.guest_count} guests ·{" "}
                        {item.preferred_date
                          ? format(parseISO(item.preferred_date), "d MMM yyyy")
                          : "Date TBC"}{" "}
                        · {item.reason_for_hire}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#5F624F] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                ))}
                {pendingPrivateHire.length > 4 && (
                  <Link
                    href="/events/private-bookings"
                    className="block text-center text-[10px] font-black uppercase tracking-widest py-2 rounded-xl bg-[#F7F4EA] text-[#5F624F] hover:text-[#26300D] hover:bg-[#E6DFC8] transition-colors"
                  >
                    View all {pendingPrivateHire.length} enquiries →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Upcoming confirmed private events */}
          {upcomingConfirmedPrivate.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-60">
                Upcoming Confirmed Events
              </p>
              <div className="space-y-2">
                {upcomingConfirmedPrivate.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3 border border-green-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[#1F1F1A] truncate">
                        {item.full_name}
                      </p>
                      <p className="text-[10px] text-[#5F624F] font-bold">
                        {item.guest_count} guests ·{" "}
                        {item.preferred_date
                          ? format(parseISO(item.preferred_date), "d MMM yyyy")
                          : "TBC"}
                        {item.preferred_time ? ` · ${item.preferred_time}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingPrivateHire.length === 0 &&
            upcomingConfirmedPrivate.length === 0 && (
              <div className="bg-white border border-[#E6DFC8] rounded-2xl p-8 text-center">
                <Building2 className="w-7 h-7 text-[#5F624F] opacity-40 mx-auto mb-2" />
                <p className="text-sm font-black text-[#1F1F1A]">
                  No active private hire enquiries
                </p>
              </div>
            )}
        </section>
      </div>
    </div>
  )
}

// ─── Section Header helper ─────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  linkHref,
  linkLabel,
}: {
  icon: React.ReactNode
  title: string
  linkHref: string
  linkLabel: string
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <h2 className="text-sm font-black uppercase tracking-widest text-[#1F1F1A]">
        {title}
      </h2>
      <div className="flex-1 h-px bg-[#E6DFC8]" />
      <Link
        href={linkHref}
        className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] hover:text-[#26300D] transition-colors flex items-center gap-1"
      >
        {linkLabel}
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
