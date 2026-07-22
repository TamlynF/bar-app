import { findEventClashes, parseTimeToMinutes, type ClashEvent, type ClashEventInput } from "./event-clash";

export type EventFormFields = {
  eventTypesId: number | null;
  eventSubtypesId: number | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type EventClashCandidate = ClashEventInput & {
  date: string | null;
  is_active?: boolean | null;
};

export type EventValidationResult =
  | { ok: true }
  | { ok: false; code: "missing_fields" }
  | { ok: false; code: "end_before_start" }
  | { ok: false; code: "clash"; clash: ClashEvent };

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

export const OVERNIGHT_END_MAX_MINUTES = 6 * 60; // 06:00

export function isOvernightEnd(endMinutes: number | null): boolean {
  return endMinutes != null && endMinutes <= OVERNIGHT_END_MAX_MINUTES;
}

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
