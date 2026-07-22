
import { parseTimeToMinutes } from "./event-clash";

export type BandLifecycleStage = "completed" | "upcoming";

export interface BandLifecycleInput {
  status: string | null | undefined;
  eventId: number | null | undefined;
  eventIsActive: boolean | undefined;
  date: string | null | undefined;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
}

export interface BandLifecycleRequest extends BandLifecycleInput {
  id: string;
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 24 * 60;

function slotInstants(date: string, startTime: string | null | undefined, endTime: string | null | undefined) {
  const day = new Date(`${date}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  const from = startMinutes ?? 0;
  let to = endMinutes ?? startMinutes ?? MINUTES_PER_DAY;
  if (endMinutes != null && to <= from) to += MINUTES_PER_DAY;

  return {
    day,
    start: new Date(day.getTime() + from * MS_PER_MINUTE),
    end: new Date(day.getTime() + to * MS_PER_MINUTE),
  };
}

export function bandLifecycleStages(
  requests: BandLifecycleRequest[],
  now: Date
): Map<string, BandLifecycleStage> {
  const stages = new Map<string, BandLifecycleStage>();
  let nextUp: { id: string; start: number } | null = null;

  for (const request of requests) {
    if ((request.status ?? "").trim().toLowerCase() !== "booked") continue;
    if (request.eventId == null) continue;
    if (!request.date) continue;

    const slot = slotInstants(request.date, request.startTime, request.endTime);
    if (!slot) continue;

    if (slot.end.getTime() < now.getTime()) {
      stages.set(request.id, "completed");
      continue;
    }

    if (request.eventIsActive !== true) continue;

    const start = slot.start.getTime();
    if (start <= now.getTime()) continue;

    if (!nextUp || start < nextUp.start) nextUp = { id: request.id, start };
  }

  if (nextUp) stages.set(nextUp.id, "upcoming");
  return stages;
}
