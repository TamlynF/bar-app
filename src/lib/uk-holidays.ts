const MS_PER_DAY = 86_400_000;

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

function firstWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const first = utcDate(year, month, 1);
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return addDaysUTC(first, shift);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month, 0));
  const shift = (last.getUTCDay() - weekday + 7) % 7;
  return addDaysUTC(last, -shift);
}

export function ukBankHolidays(year: number): string[] {
  const easter = easterSunday(year);

  const moveable = [
    addDaysUTC(easter, -2),
    addDaysUTC(easter, 1),
    firstWeekdayOfMonth(year, 5, 1),
    lastWeekdayOfMonth(year, 5, 1),
    lastWeekdayOfMonth(year, 8, 1),
  ];

  const fixed = [utcDate(year, 1, 1), utcDate(year, 12, 25), utcDate(year, 12, 26)];

  const observed = new Set<string>();
  moveable.forEach((d) => observed.add(toISODate(d)));
  fixed.filter((d) => !isWeekend(d)).forEach((d) => observed.add(toISODate(d)));

  for (const base of fixed) {
    if (!isWeekend(base)) continue;
    let candidate = base;
    while (isWeekend(candidate) || observed.has(toISODate(candidate))) {
      candidate = addDaysUTC(candidate, 1);
    }
    observed.add(toISODate(candidate));
  }

  return [...observed].sort();
}

export function ukBankHolidaysBetween(fromISO: string, toISO: string): Set<string> {
  const fromYear = Number(fromISO.slice(0, 4));
  const toYear = Number(toISO.slice(0, 4));
  const result = new Set<string>();

  for (let year = fromYear; year <= toYear; year++) {
    for (const iso of ukBankHolidays(year)) {
      if (iso >= fromISO && iso <= toISO) result.add(iso);
    }
  }

  return result;
}
