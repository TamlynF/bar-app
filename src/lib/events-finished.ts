import { format } from "date-fns";

/* "Already finished" is a date and a time, not just a date - a quiz that ends at
   23:00 is still running at 21:00 on the same day. Dates are stored as
   YYYY-MM-DD and times as HH:MM:SS, so both compare correctly as strings.

   Date and time are read off the same clock in local time. Deriving the date in
   UTC and the time locally would disagree either side of midnight once the
   clocks go forward. */
export function finishedEventOrFilter(now: Date): string {
  const day = format(now, "yyyy-MM-dd");
  const time = format(now, "HH:mm:ss");
  return `date.lt.${day},and(date.eq.${day},end_time.lt.${time})`;
}

/* The same rule for one event in hand rather than as a query. An event with no
   date has not finished - it has not been scheduled. A missing end time counts
   the whole day, so the event is only finished once that day is over. */
export function eventHasFinished(
  event: { date?: string | null; end_time?: string | null },
  now: Date
): boolean {
  if (!event.date) return false;
  const day = format(now, "yyyy-MM-dd");
  if (event.date < day) return true;
  if (event.date > day) return false;
  return (event.end_time ?? "23:59:59") < format(now, "HH:mm:ss");
}
