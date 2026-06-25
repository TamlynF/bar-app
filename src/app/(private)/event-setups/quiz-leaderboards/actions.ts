"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const LEADERBOARD_PATH = "/event-setups/quiz-leaderboards";

export interface LeaderboardEvent {
  id: string;
  date: string;
  title: string | null;
}

export interface TeamRow {
  bookingId: string;
  groupName: string;
  groupSize: number | null;
  contactName: string | null;
  /** null when the team has not been scored yet. */
  score: number | null;
  isWinner: boolean;
}

export interface ScoreEntry {
  bookingId: string;
  score: number | null;
  isWinner: boolean;
}

/** Helper for Supabase joins that may come back as an array or a single object. */
function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

type EventJoin = { id: number; date: string; title: string | null };
type ContactJoin = { full_name: string | null };
type ScoreJoin = { score: number | null; is_winner: boolean | null };

/**
 * Quiz-behaviour events that have at least one non-cancelled booking — the
 * events a leaderboard can be viewed or scored for. Newest first.
 */
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

  const byId = new Map<string, LeaderboardEvent>();
  for (const row of data ?? []) {
    const ev = one(row.events as unknown as EventJoin | EventJoin[] | null);
    if (ev && !byId.has(String(ev.id))) {
      byId.set(String(ev.id), { id: String(ev.id), date: String(ev.date), title: ev.title ?? null });
    }
  }

  return Array.from(byId.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Every non-cancelled team booked on an event, with its current score (null when
 * unscored). Drives both the standings view and the score-entry form.
 */
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
      booking_scores(score, is_winner)
    `,
    )
    .eq("event_id", eventId)
    .not("status", "eq", "cancelled")
    .order("group_name", { ascending: true });

  if (error) {
    console.error("getEventTeams error:", error);
    return [];
  }

  return (data ?? []).map((b) => {
    const contact = one(b.contacts as unknown as ContactJoin | ContactJoin[] | null);
    const scoreRow = one(b.booking_scores as unknown as ScoreJoin | ScoreJoin[] | null);
    return {
      bookingId: String(b.id),
      groupName: (b.group_name as string | null)?.trim() || "Guest Team",
      groupSize: (b.group_size as number | null) ?? null,
      contactName: contact?.full_name ?? null,
      score: scoreRow?.score ?? null,
      isWinner: !!scoreRow?.is_winner,
    };
  });
}

/**
 * Replaces all scores for a quiz event in one pass: clears the event's existing
 * booking_scores, then inserts a row for every team given a score. Teams left
 * blank are simply not scored.
 */
export async function saveEventScores(
  eventId: string,
  entries: ScoreEntry[],
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Resolve which employee is making the change (for created_by / updated_by).
  let employeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).single();
    if (emp) employeeId = emp.id;
  }

  // Clear this event's scores, then re-insert the provided ones.
  const { error: delError } = await supabase.from("booking_scores").delete().eq("event_id", Number(eventId));
  if (delError) {
    console.error("saveEventScores delete error:", delError);
    return { error: "Failed to clear existing scores" };
  }

  const rows = entries
    .filter((e) => e.score != null && !Number.isNaN(e.score))
    .map((e) => ({
      booking_id: Number(e.bookingId),
      event_id: Number(eventId),
      score: e.score,
      is_winner: e.isWinner,
      created_by: employeeId,
      updated_by: employeeId,
    }));

  if (rows.length > 0) {
    const { error: insError } = await supabase.from("booking_scores").insert(rows);
    if (insError) {
      console.error("saveEventScores insert error:", insError);
      return { error: "Failed to save scores" };
    }
  }

  revalidatePath(LEADERBOARD_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/event-bookings/quiz-bookings");
  return {};
}
