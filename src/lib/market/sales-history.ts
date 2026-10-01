export type SaleLineRow = {
  square_order_id: string;
  quantity: number | string;
  trading_night: string;
  modifiers: { name?: string | null; quantity?: number | string | null }[] | null;
};

export type ModifierCount = { name: string; quantity: number };

export type NightHistory = { night: string; orders: number; quantity: number; modifiers: ModifierCount[] };

export type WeekdayHistory = {
  weekday: number;
  nights: number;
  orders: number;
  quantity: number;
  byNight: NightHistory[];
};

export type SalesHistory = {
  nights: number;
  orders: number;
  quantity: number;
  hasModifiers: boolean;
  byWeekday: WeekdayHistory[];
};

function weekdayOf(night: string): number {
  return new Date(night + "T00:00:00").getDay();
}

function sortedModifiers(counts: Map<string, number>): ModifierCount[] {
  return [...counts]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

/* A variation's Square order lines rolled up for the drink sheet: totals,
   then by weekday (Monday first), then by trading night (latest first). An
   order counts once however many lines of the drink it had. A modifier is
   counted once per unit sold, so two gin and tonics on one line are two
   tonics. */
export function summariseSaleLines(lines: SaleLineRow[]): SalesHistory {
  const nights = new Map<string, { orders: Set<string>; quantity: number; modifiers: Map<string, number> }>();
  for (const line of lines) {
    const quantity = Number(line.quantity) || 0;
    const entry = nights.get(line.trading_night) ?? { orders: new Set(), quantity: 0, modifiers: new Map() };
    entry.orders.add(line.square_order_id);
    entry.quantity += quantity;
    for (const modifier of line.modifiers ?? []) {
      if (!modifier.name) continue;
      const count = (Number(modifier.quantity ?? 1) || 1) * quantity;
      entry.modifiers.set(modifier.name, (entry.modifiers.get(modifier.name) ?? 0) + count);
    }
    nights.set(line.trading_night, entry);
  }

  const byWeekday = new Map<number, WeekdayHistory>();
  const allOrders = new Set<string>();
  let hasModifiers = false;
  for (const [night, entry] of [...nights].sort((a, b) => b[0].localeCompare(a[0]))) {
    const weekday = weekdayOf(night);
    const day = byWeekday.get(weekday) ?? { weekday, nights: 0, orders: 0, quantity: 0, byNight: [] };
    day.nights += 1;
    day.orders += entry.orders.size;
    day.quantity += entry.quantity;
    day.byNight.push({ night, orders: entry.orders.size, quantity: entry.quantity, modifiers: sortedModifiers(entry.modifiers) });
    byWeekday.set(weekday, day);
    entry.orders.forEach((order) => allOrders.add(order));
    if (entry.modifiers.size > 0) hasModifiers = true;
  }

  const mondayFirst = (weekday: number) => (weekday + 6) % 7;
  return {
    nights: nights.size,
    orders: allOrders.size,
    quantity: [...nights.values()].reduce((sum, entry) => sum + entry.quantity, 0),
    hasModifiers,
    byWeekday: [...byWeekday.values()].sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday)),
  };
}
