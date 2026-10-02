import { format } from "date-fns";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

export type ScheduleDay = {
  date: string;
  dayShort: string;
  dayNumber: string;
  events: SerializedEvent[];
};

export type ScheduleMonth = {
  key: string;
  label: string;
  days: ScheduleDay[];
};

/* Dated one-off events grouped by month and then by day, so a night with two
   acts shares one date tile. Events arrive sorted by date then start time. */
export function groupSchedule(events: SerializedEvent[], limit = 6): ScheduleMonth[] {
  const months: ScheduleMonth[] = [];
  let taken = 0;

  for (const event of events) {
    if (taken >= limit) break;
    const date = parseDate(event.date);
    const monthKey = format(date, "yyyy-MM");
    let month = months[months.length - 1];
    if (!month || month.key !== monthKey) {
      month = { key: monthKey, label: format(date, "MMMM"), days: [] };
      months.push(month);
    }
    let day = month.days[month.days.length - 1];
    if (!day || day.date !== event.date) {
      day = { date: event.date, dayShort: format(date, "EEE"), dayNumber: format(date, "d"), events: [] };
      month.days.push(day);
    }
    day.events.push(event);
    taken += 1;
  }

  return months;
}

export function daysUntil(dateStr: string, today: Date): number {
  const target = parseDate(dateStr);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function countdownLabel(dateStr: string, today: Date): string {
  const diff = daysUntil(dateStr, today);
  if (diff <= 0) return "Tonight";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

export function nightLabel(dateStr: string, today: Date): string {
  const diff = daysUntil(dateStr, today);
  if (diff <= 0) return "Tonight";
  const date = parseDate(dateStr);
  return diff < 7 ? `This ${format(date, "EEEE")}` : format(date, "EEEE d MMMM");
}
