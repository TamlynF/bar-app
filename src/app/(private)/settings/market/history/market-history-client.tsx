"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Filter, History, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, FilterChip, ListSearchInput, StatusPill } from "@/components/admin";
import type { HistoryEntry, HistoryEntryKind } from "@/lib/market/history";

export type SessionOption = {
  id: number;
  status: string;
  startedAt: string;
  eventName: string | null;
};

export type SessionSummary = SessionOption & {
  tickNo: number;
  endedAt: string | null;
  drinkCount: number;
  truncated: boolean;
};

type KindFilter = "all" | HistoryEntryKind;

const PAGE_SIZE = 200;

const KIND_LABEL: Record<HistoryEntryKind, string> = {
  price: "Price",
  stock: "Stock",
  alert: "Alert",
  crash: "Crash",
};

const KIND_CLASS: Record<HistoryEntryKind, string> = {
  price: "bg-admin-surface text-admin-muted",
  stock: "bg-admin-warning-bg text-admin-warning",
  alert: "bg-admin-info-bg text-admin-info",
  crash: "bg-admin-error-bg text-admin-error",
};

function formatStamp(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function sessionLabel(session: SessionOption): string {
  return `${session.eventName ?? "Ad hoc market"} · ${formatStamp(session.startedAt)}${
    session.status === "live" ? " · live" : ""
  }`;
}

export default function MarketHistoryClient({
  sessions,
  selected,
  entries,
}: {
  sessions: SessionOption[];
  selected: SessionSummary | null;
  entries: HistoryEntry[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [shownCount, setShownCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (kind !== "all" && entry.kind !== kind) return false;
      if (needle && !(entry.drink ?? "").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [entries, query, kind]);

  const counts = useMemo(() => {
    const result: Record<HistoryEntryKind, number> = { price: 0, stock: 0, alert: 0, crash: 0 };
    for (const entry of entries) result[entry.kind] += 1;
    return result;
  }, [entries]);

  const visible = filtered.slice(0, shownCount);

  if (sessions.length === 0 || !selected) {
    return (
      <div className="mx-auto w-full max-w-5xl px-2 py-3 sm:px-4 sm:py-0 md:px-6">
        <EmptyState
          icon={History}
          title="No market nights yet"
          description="Open a stock market event and its price and stock changes will show up here."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-2 py-3 sm:px-4 sm:py-0 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-admin-line bg-admin-card px-2 sm:max-w-md">
          <Filter className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden="true" />
          <div className="relative min-w-0 flex-1">
            <select
              aria-label="Market night"
              value={selected.id}
              onChange={(event) => {
                setShownCount(PAGE_SIZE);
                router.push(`/settings/market/history?session=${event.target.value}`);
              }}
              className="h-11 w-full cursor-pointer appearance-none truncate border-none bg-transparent pr-7 text-base text-admin-ink outline-none sm:text-sm"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {sessionLabel(session)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-1 h-4 w-4 -translate-y-1/2 text-admin-muted"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search drinks"
            placeholder="Search by drink"
          />
        </div>
      </div>

      <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-admin-ink">
                {selected.eventName ?? "Ad hoc market"}
              </h2>
              <StatusPill tone={selected.status === "live" ? "success" : "neutral"}>
                {selected.status === "live" ? "Live" : "Ended"}
              </StatusPill>
            </div>
            <p className="text-[11px] text-admin-muted">
              Session #{selected.id} · {formatStamp(selected.startedAt)}
              {selected.endedAt ? ` to ${formatStamp(selected.endedAt)}` : ""} · {selected.tickNo}{" "}
              ticks · {selected.drinkCount} drinks
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={kind === "all"} onClick={() => setKind("all")}>
              All {entries.length}
            </FilterChip>
            <FilterChip active={kind === "price"} onClick={() => setKind("price")}>
              Prices {counts.price}
            </FilterChip>
            <FilterChip active={kind === "stock"} onClick={() => setKind("stock")}>
              Stock {counts.stock}
            </FilterChip>
            <FilterChip active={kind === "alert"} onClick={() => setKind("alert")}>
              Alerts {counts.alert}
            </FilterChip>
            <FilterChip active={kind === "crash"} onClick={() => setKind("crash")}>
              Crashes {counts.crash}
            </FilterChip>
          </div>
        </div>
        {selected.truncated && (
          <p className="mt-2 text-[11px] text-admin-warning">
            This night has more price ticks than can be shown; the earliest ones are left out.
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <SearchX className="h-6 w-6 text-admin-muted" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-admin-ink">Nothing to show</p>
            <p className="text-[11px] text-admin-muted">
              {entries.length === 0
                ? "No prices or stock changed during this night."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-125 text-left">
              <thead>
                <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Drink</th>
                  <th className="py-2 pr-3">Change</th>
                  <th className="py-2 text-right">Tick</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr key={entry.key} className="border-b border-admin-line/60">
                    <td className="py-2 pr-3 text-[13px] text-admin-muted tabular-nums">
                      {formatTime(entry.at)}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          KIND_CLASS[entry.kind]
                        )}
                      >
                        {KIND_LABEL[entry.kind]}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <p className="text-[13px] font-semibold text-admin-ink">
                        {entry.drink ?? "Whole market"}
                      </p>
                      {entry.serve && entry.serve !== "each" && (
                        <p className="text-[11px] text-admin-muted">{entry.serve}</p>
                      )}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-3 text-[13px] tabular-nums",
                        entry.kind === "price" && entry.pct != null && entry.pct > 0
                          ? "font-semibold text-admin-success"
                          : entry.kind === "price" && entry.pct != null && entry.pct < 0
                            ? "font-semibold text-admin-error"
                            : "text-admin-ink"
                      )}
                    >
                      {entry.copy}
                    </td>
                    <td className="py-2 text-right text-[13px] text-admin-muted tabular-nums">
                      {entry.tickNo ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > visible.length && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShownCount((count) => count + PAGE_SIZE)}
                  className="flex h-11 items-center justify-center rounded-lg border border-admin-line px-4 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface sm:h-9"
                >
                  Show more ({filtered.length - visible.length} left)
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
