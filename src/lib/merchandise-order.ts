export type OrderRow = {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
};

export type OrderChange = {
  id: number;
  display_order: number;
};

export type ReorderPlan = {
  position: number;
  changes: OrderChange[];
};

export type SaveChange = {
  id: number | null;
  isActive: boolean;
  targetPosition: number | null;
};

export type ChangeDescription = {
  id: number;
  name: string;
  from: number;
  to: number;
};

const INACTIVE_POSITION = 0;

function byPosition(a: OrderRow, b: OrderRow) {
  return a.display_order - b.display_order || a.id - b.id;
}

function activeRowsExcluding(rows: OrderRow[], excludedId: number | null) {
  return rows
    .filter((row) => row.is_active && row.id !== excludedId)
    .sort(byPosition);
}

function diff(rows: OrderRow[], ordered: OrderRow[]): OrderChange[] {
  const changes: OrderChange[] = [];

  ordered.forEach((row, index) => {
    const position = index + 1;
    if (row.display_order !== position) {
      changes.push({ id: row.id, display_order: position });
    }
  });

  for (const row of rows) {
    const stillActive = ordered.some((candidate) => candidate.id === row.id);
    if (!stillActive && row.display_order !== INACTIVE_POSITION) {
      changes.push({ id: row.id, display_order: INACTIVE_POSITION });
    }
  }

  return changes;
}

export function planSave(rows: OrderRow[], change: SaveChange): ReorderPlan {
  const others = activeRowsExcluding(rows, change.id);

  if (!change.isActive) {
    const changes = diff(rows, others).filter((c) => c.id !== change.id);
    return { position: INACTIVE_POSITION, changes };
  }

  const previous =
    change.id === null ? null : rows.find((row) => row.id === change.id) ?? null;
  const wasActive = previous?.is_active ?? false;

  const total = others.length + 1;
  const requested =
    wasActive && change.targetPosition !== null && Number.isFinite(change.targetPosition)
      ? change.targetPosition
      : total;
  const position = Math.min(Math.max(Math.trunc(requested), 1), total);

  const placeholder: OrderRow = previous ?? {
    id: change.id ?? -1,
    name: "",
    display_order: INACTIVE_POSITION,
    is_active: true,
  };

  const ordered = [...others];
  ordered.splice(position - 1, 0, placeholder);

  const changes = diff(rows, ordered).filter((c) => c.id !== placeholder.id);

  return { position, changes };
}

export function planDelete(rows: OrderRow[], deletedId: number): OrderChange[] {
  const remaining = activeRowsExcluding(rows, deletedId);
  const survivors = rows.filter((row) => row.id !== deletedId);

  return diff(survivors, remaining);
}

export function describeChanges(
  rows: OrderRow[],
  changes: OrderChange[]
): ChangeDescription[] {
  return changes
    .map((change) => {
      const row = rows.find((candidate) => candidate.id === change.id);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        from: row.display_order,
        to: change.display_order,
      };
    })
    .filter((entry): entry is ChangeDescription => entry !== null)
    .sort((a, b) => a.to - b.to || a.from - b.from);
}

export function nextPosition(rows: OrderRow[]): number {
  return rows.filter((row) => row.is_active).length + 1;
}
