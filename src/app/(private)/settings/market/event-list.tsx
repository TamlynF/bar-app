"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CandlestickChart, Check, Play, SearchX, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  FilterChip,
  ListRow,
  ListSearchInput,
  RecordList,
  StatusPill,
} from "@/components/admin";
import { formatTimeWindow, type StockMarketEventSummary } from "@/lib/market/stock-market-events";
import { readinessParts, type EventReadiness } from "@/lib/market/event-readiness";
import { OUTLINE_BUTTON, PRIMARY_BUTTON, ROW_ICON_BUTTON, formatRunDate } from "./ui";

type EventFilter = "all" | "ready" | "setup" | "never";

/* The list of market events. Each row says whether the event could open
   right now and offers the one action that follows from that: Open market
   when it can, a path to its page when it cannot. */
export function EventListPanel({
  events,
  readinessById,
  liveEventId,
  selectedId,
  tradeableCount,
  isPending,
  title,
  defaultCollapsed = false,
  onOpenSheet,
  onAdd,
  onOpenMarket,
}: {
  events: StockMarketEventSummary[];
  readinessById: Record<number, EventReadiness>;
  liveEventId: number | null;
  selectedId: number | null;
  tradeableCount: number;
  isPending: boolean;
  title: string;
  defaultCollapsed?: boolean;
  onOpenSheet: (event: StockMarketEventSummary) => void;
  onAdd: () => void;
  onOpenMarket: (event: StockMarketEventSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EventFilter>("all");
  const anyLive = liveEventId != null;

  const shownEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (needle && !event.name.toLowerCase().includes(needle)) return false;
      const readiness = readinessById[event.id];
      if (filter === "ready") return readiness?.ready === true;
      if (filter === "setup") return readiness?.ready === false;
      if (filter === "never") return event.lastRunAt === null;
      return true;
    });
  }, [events, query, filter, readinessById]);

  return (
    <RecordList
      variant="panel"
      title={title}
      count={shownEvents.length}
      collapsible={defaultCollapsed}
      defaultCollapsed={defaultCollapsed}
      onAdd={onAdd}
      addLabel="New event"
      activeFilterCount={filter === "all" ? 0 : 1}
      toolbar={
        <ListSearchInput value={query} onChange={setQuery} label="Search events" placeholder="Search by name" />
      }
      filters={
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterChip>
          <FilterChip active={filter === "ready"} onClick={() => setFilter("ready")}>
            Ready
          </FilterChip>
          <FilterChip active={filter === "setup"} onClick={() => setFilter("setup")}>
            Needs setup
          </FilterChip>
          <FilterChip active={filter === "never"} onClick={() => setFilter("never")}>
            Never run
          </FilterChip>
        </div>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={CandlestickChart}
          title="No stock market events yet"
          description={
            tradeableCount === 0
              ? "Add priced menu items first, then create an event to trade them."
              : "Create an event, pick its drinks, then open it on the night."
          }
        />
      ) : shownEvents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <SearchX className="h-6 w-6 text-admin-muted" aria-hidden="true" />
          <p className="text-[13px] font-semibold text-admin-ink">No events match</p>
          <p className="text-[11px] text-admin-muted">Try a different search or filter.</p>
        </div>
      ) : (
        shownEvents.map((event) => {
          const isLive = event.id === liveEventId;
          const readiness = readinessById[event.id];
          const ready = readiness?.ready ?? false;
          const canOpen = readiness?.canOpen ?? false;
          const summary = readiness ? readinessParts(readiness).join(" · ") : "";
          return (
            <ListRow
              key={event.id}
              onClick={() => onOpenSheet(event)}
              selected={selectedId === event.id}
              status={
                <StatusPill
                  tone={isLive || ready ? "success" : "warning"}
                  icon={isLive || ready ? <Check className="h-3 w-3" /> : undefined}
                  className="max-sm:hidden sm:w-24 sm:justify-center"
                >
                  {isLive ? "Live" : ready ? "Ready" : "Needs setup"}
                </StatusPill>
              }
              actions={
                !isLive && (
                  <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {canOpen ? (
                      <button
                        type="button"
                        onClick={() => onOpenMarket(event)}
                        disabled={isPending || anyLive}
                        aria-label="Open market"
                        title={anyLive ? "Close the live market first" : "Open market"}
                        className={cn(
                          PRIMARY_BUTTON,
                          ROW_ICON_BUTTON,
                          "bg-admin-success hover:bg-admin-success/90"
                        )}
                      >
                        <Play className="h-4 w-4 fill-current max-sm:ml-0.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Open market</span>
                      </button>
                    ) : (
                      <Link
                        href={`/settings/market/${event.id}`}
                        aria-label="Set up this event"
                        title="Set up this event"
                        className={cn(OUTLINE_BUTTON, ROW_ICON_BUTTON)}
                      >
                        <Settings2 className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Set up</span>
                      </Link>
                    )}
                  </div>
                )
              }
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-admin-ink">{event.name}</p>
                <p className="text-[11px] text-admin-muted">
                  {formatTimeWindow(event.openTime, event.closeTime)}
                  {summary && ` · ${summary}`}
                  <span className="hidden sm:inline"> · </span>
                  <span className="block sm:inline">
                    {event.lastRunAt ? `Last run ${formatRunDate(event.lastRunAt)}` : "Never run"}
                  </span>
                </p>
              </div>
            </ListRow>
          );
        })
      )}
    </RecordList>
  );
}
