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
