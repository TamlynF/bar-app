// Pure validation for creating / saving an event in the admin events screen.
// Kept free of React and Supabase so it can be unit-tested and shared between the
// client form (event-setups-client) and the server action (events/actions).
// Time-window clashing reuses the `event-clash` helpers.

import { findEventClashes, parseTimeToMinutes, type ClashEvent, type ClashEventInput } from "./event-clash";

export type EventFormFields = {
  eventTypesId: number | null;
  eventSubtypesId: number | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
};

/** A candidate event to clash-check against (the full event list or one date's events). */
export type EventClashCandidate = ClashEventInput & {
  date: string | null;
  is_active?: boolean | null;
};

export type EventValidationResult =
  | { ok: true }
  | { ok: false; code: "missing_fields" }
  | { ok: false; code: "end_before_start" }
  | { ok: false; code: "clash"; clash: ClashEvent };

/** True when any of the always-required create/save fields is blank. */
export function eventRequiredFieldsMissing(f: EventFormFields): boolean {
  return (
    !f.eventTypesId ||
    !f.eventSubtypesId ||
    !f.title.trim() ||
    !f.date ||
    !f.startTime ||
    !f.endTime
  );
}

/**
 * Active events on the same date whose time window overlaps [start, end), excluding
 * the event being edited. Applies the date / active / self filters, then defers the
 * overlap maths to `findEventClashes`.
 */
export function findActiveEventClashes(
  target: { id?: number | string | null; date: string; start: string; end: string },
  candidates: EventClashCandidate[]
): ClashEvent[] {
  const sameDayActive = candidates.filter(
    (e) =>
      e.date === target.date &&
      e.is_active !== false &&
      (target.id == null || String(e.id) !== String(target.id))
  );
  return findEventClashes({ start: target.start, end: target.end }, sameDayActive);
}

/** Latest minute-of-day an end time may fall on to count as an overnight finish. */
export const OVERNIGHT_END_MAX_MINUTES = 6 * 60; // 06:00

/**
 * True when the end time is between midnight and 6am. Such an end is treated as
 * finishing the next day (an overnight event), so it's valid even though it's
 * numerically at or before the start time.
 */
export function isOvernightEnd(endMinutes: number | null): boolean {
  return endMinutes != null && endMinutes <= OVERNIGHT_END_MAX_MINUTES;
}

/**
 * Full create/save validation, in order: required fields → end-after-start →
 * no clash with another active event on the same date. Returns a structured
 * result so each caller can render its own message.
 */
export function validateEventForm(
  fields: EventFormFields,
  candidates: EventClashCandidate[],
  editingId?: number | string | null
): EventValidationResult {
  if (eventRequiredFieldsMissing(fields)) return { ok: false, code: "missing_fields" };

  const start = parseTimeToMinutes(fields.startTime);
  const end = parseTimeToMinutes(fields.endTime);
  if (start == null || end == null || (end <= start && !isOvernightEnd(end))) return { ok: false, code: "end_before_start" };

  const clashes = findActiveEventClashes(
    { id: editingId ?? null, date: fields.date, start: fields.startTime, end: fields.endTime },
    candidates
  );
  if (clashes.length > 0) return { ok: false, code: "clash", clash: clashes[0] };

  return { ok: true };
}
