"use server";

import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";

const LEADERBOARD_PATH = "/event-setups/quiz-leaderboards";

// PostgREST answers with at most 1000 rows, so a single select quietly returns a
// slice of a busy venue's quiz history.
const PAGE_SIZE = 1000;

export interface LeaderboardEvent {
  id: string;
  date: string;
  title: string | null;
  hasWinner: boolean;
}

export interface TeamRow {
  bookingId: string;
  groupName: string;
  groupSize: number | null;
  contactName: string | null;
  isWinner: boolean;
}

export interface AllTimeTeam {
  team_name: string;
  wins: number;
  quizzes_attended: number;
}

// Dates are plain YYYY-MM-DD, so they compare correctly as strings. A quiz that
// has not been played yet has no winner to record and nobody has attended it.
function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function many<T>(rel: T | T[] | null | undefined): T[] {
  if (!rel) return [];
  return Array.isArray(rel) ? rel : [rel];
}

type EventJoin = { id: number; date: string; title: string | null };
type ContactJoin = { full_name: string | null };
type WinnerJoin = { is_winner: boolean | null };

export async function getQuizEvents(): Promise<LeaderboardEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("event_id, events!bookings_event_id_fkey!inner(id, date, title, event_subtypes!inner(behavior))")
    .eq("events.event_subtypes.behavior", "quiz")
    .not("status", "eq", "cancelled");

  if (error) {
    console.error("getQuizEvents error:", error);
    return [];
  }

  const { data: winnerRows, error: winnerError } = await supabase
    .from("booking_scores")
    .select("event_id")
    .eq("is_winner", true);

  if (winnerError) console.error("getQuizEvents winners error:", winnerError);
  const recorded = new Set((winnerRows ?? []).map((row) => String(row.event_id)));

  const cutoff = today();
  const byId = new Map<string, LeaderboardEvent>();
  for (const row of data ?? []) {
    const ev = one(row.events as unknown as EventJoin | EventJoin[] | null);
    if (!ev || byId.has(String(ev.id))) continue;
    const date = String(ev.date);
    if (date > cutoff) continue;
    const id = String(ev.id);
    byId.set(id, { id, date, title: ev.title ?? null, hasWinner: recorded.has(id) });
  }

  return Array.from(byId.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getEventTeams(eventId: string): Promise<TeamRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      group_name,
      group_size,
      contacts!bookings_contact_id_fkey(full_name),
      booking_scores(is_winner)
    `,
    )
    .eq("event_id", eventId)
    .eq("status", "confirmed")
    .order("group_name", { ascending: true });

  if (error) {
    console.error("getEventTeams error:", error);
    return [];
  }

  return (data ?? []).map((b) => {
    const contact = one(b.contacts as unknown as ContactJoin | ContactJoin[] | null);
    const winnerRows = many(b.booking_scores as unknown as WinnerJoin | WinnerJoin[] | null);
    return {
      bookingId: String(b.id),
      groupName: (b.group_name as string | null)?.trim() || "Guest Team",
      groupSize: (b.group_size as number | null) ?? null,
      contactName: contact?.full_name ?? null,
      isWinner: winnerRows.some((row) => row.is_winner),
    };
  });
}

type AllTimeRow = {
  group_name: string | null;
  events: { date: string | null } | { date: string | null }[] | null;
  booking_scores: WinnerJoin | WinnerJoin[] | null;
};

// Attendance is counted from the bookings themselves, not from the winner rows -
// only the team that won a quiz has a row, so counting those would report every
// team as having attended exactly as many quizzes as it won.
export async function getAllTimeLeaderboard(limit = 5): Promise<AllTimeTeam[]> {
  const supabase = await createClient();

  const rows: AllTimeRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "group_name, events!bookings_event_id_fkey!inner(id, date, event_subtypes!inner(behavior)), booking_scores(is_winner)",
      )
      .eq("events.event_subtypes.behavior", "quiz")
      .not("status", "eq", "cancelled")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("getAllTimeLeaderboard error:", error);
      break;
    }

    const batch = (data as unknown as AllTimeRow[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const cutoff = today();
  const statsMap = new Map<string, AllTimeTeam>();
  for (const row of rows) {
    const eventDate = one(row.events)?.date;
    if (eventDate && eventDate > cutoff) continue;

    const teamName = row.group_name?.trim() || "Unknown Team";
    let team = statsMap.get(teamName);
    if (!team) {
      team = { team_name: teamName, wins: 0, quizzes_attended: 0 };
      statsMap.set(teamName, team);
    }
    team.quizzes_attended += 1;
    if (many(row.booking_scores).some((score) => score.is_winner)) team.wins += 1;
  }

  return Array.from(statsMap.values())
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.quizzes_attended !== a.quizzes_attended) {
        return b.quizzes_attended - a.quizzes_attended;
      }
      return a.team_name.localeCompare(b.team_name);
    })
    .slice(0, limit);
}

// One quiz has one winning team, so recording a winner replaces whatever was
// there before. Passing no booking clears the result.
export async function setEventWinner(
  eventId: string,
  bookingId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);

  const { error: clearError } = await supabase
    .from("booking_scores")
    .delete()
    .eq("event_id", Number(eventId));

  if (clearError) {
    console.error("setEventWinner clear error:", clearError);
    return { error: "Failed to clear the previous winner" };
  }

  if (bookingId) {
    const { error: insertError } = await supabase.from("booking_scores").insert({
      booking_id: Number(bookingId),
      event_id: Number(eventId),
      is_winner: true,
      created_by: employeeId,
      updated_by: employeeId,
    });

    if (insertError) {
      console.error("setEventWinner insert error:", insertError);
      return { error: "Failed to save the winner" };
    }
  }

  // The event carries its own copy of the winning team, which is what the event
  // sheet reads. Writing both here is what stops the two disagreeing.
  const { data: booking } = bookingId
    ? await supabase.from("bookings").select("group_name").eq("id", Number(bookingId)).maybeSingle()
    : { data: null };

  const { error: eventError } = await supabase
    .from("events")
    .update({
      booking_id: bookingId ? Number(bookingId) : null,
      group_name: booking?.group_name ?? null,
    })
    .eq("id", Number(eventId));

  if (eventError) console.error("setEventWinner event error:", eventError);

  revalidatePath(LEADERBOARD_PATH);
  revalidatePath("/event-setups/events");
  revalidatePath("/settings/teams");
  revalidatePath("/settings/customers");
  revalidatePath("/dashboard");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/event-bookings/event/[id]", "page");
  return {};
}
