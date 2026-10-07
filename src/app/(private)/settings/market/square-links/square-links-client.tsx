"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleAlert,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  SearchX,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListSearchInput, StatusPill } from "@/components/admin";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatGbp } from "@/lib/price";
import { squareItemUrl } from "@/lib/market/simulate";
import type { CatalogVariation } from "@/lib/market/mapping";
import type { MappingRow } from "@/lib/market/mapping-rows";
import {
  autoMatchMappingsAction,
  loadCatalogVariationsAction,
  pushMenuToSquareAction,
  saveMappingAction,
  syncSquareSalesAction,
} from "../actions";
import { NEUTRAL_BUTTON, formatStamp, salesSyncMessage } from "../ui";
import type { MixerChoice } from "@/lib/market/mixer";
import type { ModifierListOption } from "@/lib/market/square-mixers";
import MixerModifierCard from "./mixer-modifier-card";
import {
  CATEGORY_TOGGLE,
  CATEGORY_TOGGLE_NOTE,
  FilterPill,
  FiltersButton,
  HEADER_BUTTON,
  HEADER_PRIMARY_BUTTON,
  StatTile,
} from "./link-list-parts";

type LinkFilter = "all" | "linked" | "unlinked" | "board" | "event";

export type SaleLineCount = {
  lines: number;
  units: number;
  firstNight: string | null;
  lastNight: string | null;
};

type Group = { name: string; rows: MappingRow[] };

const COLUMN_COUNT = 7;

function formatNight(night: string): string {
  return new Date(night + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function saleLinesTitle(count: SaleLineCount): string {
  const units = Number.isInteger(count.units)
    ? count.units
    : count.units.toFixed(1);
  const span =
    count.firstNight && count.lastNight
      ? ` from ${formatNight(count.firstNight)} to ${formatNight(count.lastNight)}`
      : "";
  return `${count.lines} Square order ${count.lines === 1 ? "line" : "lines"}, ${units} units${span}`;
}

function SaleLines({
  row,
  counts,
}: {
  row: MappingRow;
  counts: Record<string, SaleLineCount> | null;
}) {
  if (!row.squareVariationId || !counts)
    return <span className="text-admin-muted">-</span>;
  const count = counts[row.squareVariationId];
  if (!count) {
    return (
      <span
        className="text-admin-muted"
        title="No Square sales synced for this variation yet"
      >
        0
      </span>
    );
  }
  return (
    <span className="text-admin-ink tabular-nums" title={saleLinesTitle(count)}>
      {count.lines.toLocaleString("en-GB")}
    </span>
  );
}

function CategoryToggle({
  group,
  open,
  onToggle,
  className,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const linked = group.rows.filter((row) => row.squareVariationId).length;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        CATEGORY_TOGGLE,
        className,
      )}
    >
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
          !open && "-rotate-90",
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">{group.name}</span>
      <span className={CATEGORY_TOGGLE_NOTE}>
        {group.rows.length} {group.rows.length === 1 ? "serve" : "serves"} · {linked} linked
      </span>
    </button>
  );
}

function matches(needle: string, row: MappingRow): boolean {
  if (!needle) return true;
  return [row.itemName, row.categoryName, row.serve, ...row.onEvents].some(
    (field) => field.toLowerCase().includes(needle),
  );
}

function VariationSelect({
  row,
  variations,
  disabled,
  onChange,
  className,
}: {
  row: MappingRow;
  variations: CatalogVariation[] | null;
  disabled: boolean;
  onChange: (variationId: string | null) => void;
  className?: string;
}) {
  return (
    <select
      aria-label={`Square variation for ${row.itemName} (${row.serve})`}
      value={row.squareVariationId ?? ""}
      disabled={disabled || !variations}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn(
        "h-11 w-full cursor-pointer rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none disabled:opacity-60 sm:h-9",
        className,
      )}
    >
      <option value="">Not linked</option>
      {row.squareVariationId &&
        !variations?.some((v) => v.variationId === row.squareVariationId) && (
          <option value={row.squareVariationId}>Linked (current)</option>
        )}
      {(variations ?? []).map((variation) => (
        <option key={variation.variationId} value={variation.variationId}>
          {variation.itemName}
          {variation.variationName ? ` - ${variation.variationName}` : ""}
        </option>
      ))}
    </select>
  );
}

/* Every priced serve on the menu against the Square catalog. A one-off job
   when the menu changes, not something done per market night, which is why
   it has a page of its own rather than a panel on the hub. */
/* Linked reads as a real link into the Square dashboard when the catalog
   pass knew the item, and the eye shows the raw variation id for anyone
   checking against Square by hand. */
function LinkStatus({
  row,
  itemId,
  environment,
  revealed,
  untracked,
  onToggle,
}: {
  row: MappingRow;
  itemId: string | undefined;
  environment: "sandbox" | "production";
  revealed: boolean;
  untracked: boolean;
  onToggle: () => void;
}) {
  if (!row.squareVariationId) {
    return (
      <StatusPill tone="neutral" showLabelOnMobile>
        Not linked
      </StatusPill>
    );
  }
  const pill = (
    <StatusPill
      tone="success"
      icon={itemId ? <ExternalLink className="h-3 w-3" /> : undefined}
      showLabelOnMobile
    >
      Linked
    </StatusPill>
  );
  return (
    <span className="inline-flex items-center gap-1">
      {itemId ? (
        <a
          href={squareItemUrl(environment, itemId)}
          target="_blank"
          rel="noreferrer"
          title={`Open ${row.itemName} in the Square dashboard`}
          className="rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none"
        >
          {pill}
        </a>
      ) : (
        pill
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={revealed}
        aria-label={
          revealed
            ? "Hide the Square variation id"
            : "Show the Square variation id"
        }
        title={revealed ? "Hide variation id" : "Show variation id"}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
      >
        {revealed ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
      {untracked && (
        <span
          className="whitespace-nowrap"
          title="Square does not count this serve's stock. It never goes low or sold out on its own; mark it sold out on the trading floor."
        >
          <StatusPill tone="neutral" showLabelOnMobile>
            Stock not tracked
          </StatusPill>
        </span>
      )}
      {revealed && (
        <code
          className="max-w-40 truncate rounded bg-admin-surface px-1.5 py-0.5 font-mono text-[11px] text-admin-ink"
          title={row.squareVariationId}
        >
          {row.squareVariationId}
        </code>
      )}
    </span>
  );
}

export default function SquareLinksClient({
  rows,
  variations,
  focusEvent,
  itemIds,
  environment,
  untrackedVariationIds,
  mixerChoice,
  modifierLists,
  saleLineCounts,
  salesSyncedAt,
  catalogSyncedAt,
}: {
  rows: MappingRow[];
  saleLineCounts: Record<string, SaleLineCount> | null;
  salesSyncedAt: string | null;
  catalogSyncedAt: string | null;
  untrackedVariationIds: string[];
  variations: CatalogVariation[] | null;
  focusEvent: { id: number; name: string } | null;
  itemIds: Record<string, string>;
  environment: "sandbox" | "production";
  mixerChoice: MixerChoice;
  modifierLists: ModifierListOption[] | null;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [revealedIds, setRevealedIds] = useState<Set<number>>(() => new Set());
  const toggleRevealed = (id: number) =>
    setRevealedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const untrackedSet = new Set(untrackedVariationIds);
  const linkStatus = (row: MappingRow) => (
    <LinkStatus
      row={row}
      itemId={
        row.squareVariationId ? itemIds[row.squareVariationId] : undefined
      }
      environment={environment}
      revealed={revealedIds.has(row.menuItemPriceId)}
      untracked={
        row.squareVariationId != null && untrackedSet.has(row.squareVariationId)
      }
      onToggle={() => toggleRevealed(row.menuItemPriceId)}
    />
  );
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LinkFilter>(
    focusEvent ? "event" : "all",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const linkedCount = rows.filter((row) => row.squareVariationId).length;
  const onBoard = rows.filter((row) => row.onEvents.length > 0);
  const unlinkedOnBoard = onBoard.filter(
    (row) => !row.squareVariationId,
  ).length;
  const unlinkedCount = rows.length - linkedCount;
  const linkedPct = rows.length ? Math.round((linkedCount / rows.length) * 100) : 0;
  const onFocusEvent = focusEvent ? rows.filter((row) => row.onEvents.includes(focusEvent.name)).length : 0;
  const stats: {
    key: LinkFilter;
    label: string;
    value: number;
    note: string;
    tone?: "warning";
    progress?: number;
  }[] = [
    { key: "all", label: "Serves", value: rows.length, note: "Every serve on the menu" },
    {
      key: "linked",
      label: "Linked",
      value: linkedCount,
      note: `${linkedPct}% linked to a Square variation`,
      progress: linkedPct,
    },
    {
      key: "unlinked",
      label: "Not linked",
      value: unlinkedCount,
      note: unlinkedCount === 0 ? "Everything is linked" : "No Square variation yet",
      tone: unlinkedCount > 0 ? "warning" : undefined,
    },
    { key: "board", label: "On the board", value: onBoard.length, note: "On at least one market night" },
    ...(focusEvent
      ? [{ key: "event" as const, label: `On ${focusEvent.name}`, value: onFocusEvent, note: `On ${focusEvent.name}` }]
      : []),
  ];
  const activeStat = stats.find((stat) => stat.key === filter) ?? stats[0];
  const filtered = filter !== "all";

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matches(needle, row)) return false;
      if (filter === "unlinked") return !row.squareVariationId;
      if (filter === "linked") return Boolean(row.squareVariationId);
      if (filter === "board") return row.onEvents.length > 0;
      if (filter === "event")
        return focusEvent != null && row.onEvents.includes(focusEvent.name);
      return true;
    });
  }, [rows, query, filter, focusEvent]);

  const groups = useMemo(() => {
    const out: Group[] = [];
    for (const row of shown) {
      const last = out[out.length - 1];
      if (last && last.name === row.categoryName) last.rows.push(row);
      else out.push({ name: row.categoryName, rows: [row] });
    }
    return out;
  }, [shown]);

  const searching = query.trim().length > 0;
  const isOpen = (name: string) => searching || !collapsed.has(name);
  const toggleGroup = (name: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const allCollapsed =
    groups.length > 0 && groups.every((group) => collapsed.has(group.name));
  const toggleAllGroups = () =>
    setCollapsed(
      allCollapsed ? new Set() : new Set(groups.map((group) => group.name)),
    );

  function handleSyncSales() {
    startSyncing(async () => {
      const result = await syncSquareSalesAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const message = salesSyncMessage(result);
      if (message.catalogFailed) toast.warning(message.text);
      else toast.success(message.text);
      router.refresh();
    });
  }

  function run(
    action: () => Promise<{ error?: string } | void>,
    success?: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  }

  async function retryCatalog() {
    setLoadingCatalog(true);
    const result = await loadCatalogVariationsAction();
    setLoadingCatalog(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Catalog copied from Square - ${result.variations?.length ?? 0} variations.`);
    router.refresh();
  }

  async function handlePushToSquare() {
    const confirmed = await confirm({
      title: "Send the menu to Square?",
      description:
        "Creates a Square catalog item per menu item (one variation per serve, priced from the menu) and links them here automatically. Items whose name already exists in Square are skipped, never duplicated.",
      confirmLabel: "Send menu",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await pushMenuToSquareAction();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Square catalog updated - ${result?.created ?? 0} items created, ${result?.linked ?? 0} serves linked${result?.skipped ? `, ${result.skipped} already existed` : ""}.`,
      );
      router.refresh();
    });
  }

  function handleAutoMatch() {
    startTransition(async () => {
      const result = await autoMatchMappingsAction();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Matched ${result?.matched ?? 0} serves${result?.unmatched ? `, ${result.unmatched} still unmatched` : ""}.`,
      );
      router.refresh();
    });
  }

  const eventsLabel = (row: MappingRow) =>
    row.onEvents.length === 0
      ? ""
      : row.onEvents.length <= 2
        ? row.onEvents.join(", ")
        : `${row.onEvents.length} events`;

  return (
    <div className="space-y-4">
      {ConfirmDialogUI}

      {focusEvent && (
        <Link
          href={`/settings/market/${focusEvent.id}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-admin-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to {focusEvent.name}
        </Link>
      )}

      {unlinkedOnBoard > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-admin-warning/40 bg-admin-warning-bg px-4 py-3 text-[13px] text-admin-ink sm:px-5">
          <CircleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-admin-warning"
            aria-hidden="true"
          />
          <p>
            <span className="font-semibold">
              {unlinkedOnBoard} {unlinkedOnBoard === 1 ? "serve" : "serves"} on
              the board {unlinkedOnBoard === 1 ? "is" : "are"} not linked.
            </span>{" "}
            <span className="text-admin-muted">
              Unlinked serves get no till demand, no stock alerts, and their
              market price never reaches the till.
            </span>
          </p>
        </div>
      )}

      {variations === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-error/30 bg-admin-error-bg px-4 py-3 text-[13px] sm:px-5">
          <p className="text-admin-ink">
            <span className="font-semibold">
              The Square catalog has not been copied yet.
            </span>{" "}
            <span className="text-admin-muted">
              Links are shown but cannot be changed until it is. The nightly sync copies it, or copy it now.
            </span>
          </p>
          <button
            type="button"
            onClick={retryCatalog}
            disabled={loadingCatalog}
            className={NEUTRAL_BUTTON}
          >
            {loadingCatalog ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Copy from Square
          </button>
        </div>
      )}

      <MixerModifierCard choice={mixerChoice} lists={modifierLists} />

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-[min(24rem,calc(100%-2rem))] gap-0 rounded-3xl border-2 border-admin-line bg-admin-surface p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-bold text-admin-ink">Filter menu serves</DialogTitle>
            <DialogDescription className="text-[12px] text-admin-muted">
              Pick one to show just those serves.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.map((stat) => (
              <FilterPill
                key={stat.key}
                active={filter === stat.key}
                onClick={() => {
                  setFilter(stat.key);
                  setFiltersOpen(false);
                }}
              >
                {stat.label}
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    stat.tone === "warning" ? "text-admin-warning" : "text-admin-ink",
                  )}
                >
                  {stat.value.toLocaleString("en-GB")}
                </span>
              </FilterPill>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <section className="overflow-hidden rounded-2xl border border-admin-line bg-admin-card shadow-sm">
        <div className="space-y-3 border-b border-admin-line bg-admin-surface px-4 py-3.5 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-admin-ink">Menu serves</h2>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-admin-muted">
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  Catalog copied {catalogSyncedAt ? formatStamp(catalogSyncedAt) : "never"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Download className="h-3 w-3" aria-hidden="true" />
                  Sales synced {salesSyncedAt ? formatStamp(salesSyncedAt) : "never"}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleSyncSales}
                disabled={isSyncing}
                className={cn(HEADER_BUTTON, "hidden 2xl:flex")}
              >
                <Download className={cn("h-4 w-4", isSyncing && "animate-pulse")} aria-hidden="true" />
                Sync sales
              </button>
              <button
                type="button"
                onClick={handleAutoMatch}
                disabled={isPending}
                className={cn(HEADER_PRIMARY_BUTTON, "hidden sm:flex")}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                )}
                Auto-match
              </button>
              <button
                type="button"
                onClick={handlePushToSquare}
                disabled={isPending}
                className={cn(HEADER_BUTTON, "hidden lg:flex")}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Send menu to Square
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More Square actions"
                    title="More Square actions"
                    className={cn(HEADER_BUTTON, "w-11 px-0 sm:w-9")}
                  >
                    <Ellipsis className="h-4 w-4" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem disabled={isSyncing} onSelect={handleSyncSales} className="min-h-11 2xl:hidden">
                    <Download className="h-4 w-4" />
                    Sync sales from Square
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isPending} onSelect={handleAutoMatch} className="min-h-11 sm:hidden">
                    <Wand2 className="h-4 w-4" />
                    Auto-match serves
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isPending} onSelect={handlePushToSquare} className="min-h-11 lg:hidden">
                    <Upload className="h-4 w-4" />
                    Send menu to Square
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={loadingCatalog} onSelect={retryCatalog} className="min-h-11">
                    <RefreshCw className="h-4 w-4" />
                    Refresh catalog from Square
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={searching || groups.length === 0}
                    onSelect={toggleAllGroups}
                    className="min-h-11"
                  >
                    {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
                    {allCollapsed ? "Expand all categories" : "Collapse all categories"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className={cn("hidden gap-2 sm:grid", stats.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
            {stats.map((stat) => (
              <StatTile
                key={stat.key}
                label={stat.label}
                value={stat.value}
                note={stat.note}
                tone={stat.tone}
                progress={stat.progress}
                active={filter === stat.key}
                onClick={() => setFilter(stat.key)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 sm:w-96 sm:shrink-0">
              <div className="min-w-0 flex-1">
                <ListSearchInput
                  value={query}
                  onChange={setQuery}
                  label="Search serves"
                  placeholder="Search by drink, category, serve or event"
                />
              </div>
              <FiltersButton
                filtered={filtered}
                label={`Filter menu serves${filtered ? `, showing ${activeStat.label}` : ""}`}
                onClick={() => setFiltersOpen(true)}
              />
            </div>
            <p className={cn("text-[12px] text-admin-muted sm:ml-auto sm:block", !filtered && "hidden")}>
              Showing <span className="font-semibold text-admin-ink tabular-nums">{shown.length}</span> of{" "}
              <span className="tabular-nums">{rows.length}</span>
              {filtered && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="ml-2 font-semibold text-admin-primary hover:underline"
                >
                  Clear filter
                </button>
              )}
            </p>
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <SearchX className="h-6 w-6 text-admin-muted" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-admin-ink">
              No serves match
            </p>
            <p className="text-[11px] text-admin-muted">
              Try a different search or filter.
            </p>
          </div>
        ) : (
          <>
            <ul className="m-0 list-none p-0 sm:hidden">
              {groups.map((group) => (
                <li key={group.name}>
                  <CategoryToggle
                    group={group}
                    open={isOpen(group.name)}
                    onToggle={() => toggleGroup(group.name)}
                    className="px-3"
                  />
                  {isOpen(group.name) && (
                    <ul className="m-0 list-none divide-y divide-admin-muted/30 p-0">
                      {group.rows.map((row) => (
                        <li
                          key={row.menuItemPriceId}
                          className="space-y-2 px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-admin-ink">
                                {row.itemName}
                                <span className="font-medium text-admin-muted">
                                  {" "}
                                  · {row.serve}
                                </span>
                              </p>
                              <p className="text-[11px] text-admin-muted">
                                {formatGbp(row.amount)}
                                {row.onEvents.length > 0 &&
                                  ` · ${eventsLabel(row)}`}
                                {row.squareVariationId && saleLineCounts && (
                                  <>
                                    {" · "}
                                    <SaleLines
                                      row={row}
                                      counts={saleLineCounts}
                                    />{" "}
                                    sales lines
                                  </>
                                )}
                              </p>
                            </div>
                            {linkStatus(row)}
                          </div>
                          <VariationSelect
                            row={row}
                            variations={variations}
                            disabled={isPending}
                            onChange={(id) =>
                              run(
                                () =>
                                  saveMappingAction(row.menuItemPriceId, id),
                                "Link saved.",
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-160 text-left">
                <thead>
                  <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                    <th className="py-2 pr-3 pl-4 sm:pl-5">Drink</th>
                    <th className="py-2 pr-3">Serve</th>
                    <th className="py-2 pr-3 text-right">Price</th>
                    <th className="py-2 pr-3">On events</th>
                    <th className="py-2 pr-3">Square variation</th>
                    <th
                      className="py-2 pr-3 text-right"
                      title="Square order lines synced for this variation, across every night"
                    >
                      Sales lines
                    </th>
                    <th className="py-2 pr-4 sm:pr-5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <GroupRows
                      key={group.name}
                      group={group}
                      open={isOpen(group.name)}
                      onToggle={() => toggleGroup(group.name)}
                      saleLineCounts={saleLineCounts}
                      variations={variations}
                      isPending={isPending}
                      eventsLabel={eventsLabel}
                      onChange={(row, id) =>
                        run(
                          () => saveMappingAction(row.menuItemPriceId, id),
                          "Link saved.",
                        )
                      }
                      status={linkStatus}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function GroupRows({
  group,
  open,
  onToggle,
  saleLineCounts,
  variations,
  isPending,
  eventsLabel,
  onChange,
  status,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  saleLineCounts: Record<string, SaleLineCount> | null;
  variations: CatalogVariation[] | null;
  isPending: boolean;
  eventsLabel: (row: MappingRow) => string;
  onChange: (row: MappingRow, variationId: string | null) => void;
  status: (row: MappingRow) => React.ReactNode;
}) {
  return (
    <>
      <tr>
        <td colSpan={COLUMN_COUNT} className="p-0">
          <CategoryToggle
            group={group}
            open={open}
            onToggle={onToggle}
            className="px-4 sm:px-5"
          />
        </td>
      </tr>
      {open &&
        group.rows.map((row) => (
          <tr
            key={row.menuItemPriceId}
            className="border-b border-admin-line/60"
          >
            <td className="py-1.5 pr-3 pl-4 text-[13px] font-semibold text-admin-ink sm:pl-5">
              {row.itemName}
            </td>
            <td className="py-1.5 pr-3 text-[13px] text-admin-muted">
              {row.serve}
            </td>
            <td className="py-1.5 pr-3 text-right text-[13px] text-admin-ink tabular-nums">
              {formatGbp(row.amount)}
            </td>
            <td className="py-1.5 pr-3 text-[12px] text-admin-muted">
              {eventsLabel(row) || "-"}
            </td>
            <td className="py-1.5 pr-3">
              <VariationSelect
                row={row}
                variations={variations}
                disabled={isPending}
                onChange={(id) => onChange(row, id)}
                className="max-w-80"
              />
            </td>
            <td className="py-1.5 pr-3 text-right text-[13px]">
              <SaleLines row={row} counts={saleLineCounts} />
            </td>
            <td className="py-1.5 pr-4 sm:pr-5">{status(row)}</td>
          </tr>
        ))}
    </>
  );
}
