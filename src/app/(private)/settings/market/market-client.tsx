"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CandlestickChart,
  Check,
  Link2,
  Loader2,
  MonitorPlay,
  Play,
  RotateCcw,
  SearchX,
  TrendingDown,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DetailCard,
  DetailCell,
  EmptyState,
  ErrorBox,
  FilterChip,
  FormRow,
  ListRow,
  ListSearchInput,
  RecordList,
  RecordSheet,
  StatusPill,
  useRecordSheet,
} from "@/components/admin";
import { formatGbp } from "@/lib/price";
import { DEFAULT_MARKET_CONFIG, type MarketConfig, type StockState } from "@/lib/market/types";
import type { CatalogVariation } from "@/lib/market/mapping";
import { formatTimeWindow, type StockMarketEventSummary } from "@/lib/market/stock-market-events";
import {
  autoMatchMappingsAction,
  crashMarketAction,
  deactivateStockMarketEventAction,
  endMarketAction,
  loadCatalogVariationsAction,
  openStockMarketEventAction,
  pushMenuToSquareAction,
  restoreTillPricesAction,
  saveMappingAction,
  saveStockMarketEventAction,
  setStockOverrideAction,
} from "./actions";
import { CONFIG_FIELDS, ConfigHelp } from "./config-fields";

export type SessionSummary = {
  id: number;
  tickNo: number;
  startedAt: string;
  crashUntilTick: number | null;
  config: MarketConfig;
  stockMarketEventId: number | null;
};

/* A session (live or ended) whose linked drinks still carry market prices
   in Square. Null means the till already shows the normal menu. */
export type TillRestoreSummary = {
  sessionId: number;
  status: "live" | "ended";
  endedAt: string | null;
  count: number;
};

export type InstrumentSummary = {
  id: number;
  name: string;
  serve: string;
  basePrice: number;
  currentPrice: number;
  demandUnits: number;
  stockState: StockState;
  stockOverride: StockState | null;
  mapped: boolean;
};

export type CategoryOption = {
  id: number;
  name: string;
  tradeableCount: number;
};

export type DrinkOption = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
};

export type EmployeeOption = {
  id: number;
  full_name: string;
};

export type MappingRow = {
  menuItemPriceId: number;
  itemName: string;
  categoryName: string;
  serve: string;
  amount: number;
  isPrimary: boolean;
  squareVariationId: string | null;
};

type EventFilter = "all" | "live" | "run" | "never";

const CARD = "rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5";
const PRIMARY_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:h-9";
const OUTLINE_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft disabled:opacity-50 sm:h-9";
const NEUTRAL_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-line px-4 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface disabled:opacity-50 sm:h-9";
const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";

function ConfigFormRows({ config }: { config: MarketConfig }) {
  return (
    <TooltipProvider>
      {CONFIG_FIELDS.map((field) => (
        <FormRow key={field.key} label={field.label} dense>
          <ConfigHelp field={field} />
          <input
            type="number"
            name={field.key}
            aria-label={field.label}
            defaultValue={config[field.key]}
            step={field.step}
            min="0"
            required
            className={FIELD_INPUT}
          />
        </FormRow>
      ))}
    </TooltipProvider>
  );
}

function DrinkPicker({
  drinks,
  selected,
  onChange,
}: {
  drinks: DrinkOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const groups = useMemo(() => {
    const byCategory = new Map<number, { name: string; drinks: DrinkOption[] }>();
    for (const drink of drinks) {
      const group = byCategory.get(drink.categoryId) ?? { name: drink.categoryName, drinks: [] };
      group.drinks.push(drink);
      byCategory.set(drink.categoryId, group);
    }
    return [...byCategory.entries()].map(([id, group]) => ({ id, ...group }));
  }, [drinks]);

  const selectedSet = new Set(selected);

  function toggleDrink(id: number) {
    onChange(selectedSet.has(id) ? selected.filter((d) => d !== id) : [...selected, id]);
  }

  function toggleGroup(ids: number[], allOn: boolean) {
    if (allOn) onChange(selected.filter((id) => !ids.includes(id)));
    else onChange([...new Set([...selected, ...ids])]);
  }

  if (groups.length === 0) {
    return (
      <p className="px-4 py-3 text-[13px] text-admin-muted sm:px-5">
        No priced drinks on the menu yet. Add menu items with a price first.
      </p>
    );
  }

  return (
    <div className="divide-y divide-admin-line/50">
      {groups.map((group) => {
        const ids = group.drinks.map((drink) => drink.id);
        const onCount = ids.filter((id) => selectedSet.has(id)).length;
        const allOn = onCount === ids.length;
        return (
          <div key={group.id} className="px-4 py-2 sm:px-5">
            <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={() => toggleGroup(ids, allOn)}
                  aria-label={`Select all ${group.name}`}
                  className="h-4 w-4 cursor-pointer accent-admin-primary"
                />
                <span className="text-[13px] font-bold text-admin-ink">{group.name}</span>
              </span>
              <span className="text-[11px] font-semibold text-admin-muted tabular-nums">
                {onCount}/{ids.length}
              </span>
            </label>
            <div className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {group.drinks.map((drink) => (
                <label
                  key={drink.id}
                  className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-admin-ink"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(drink.id)}
                    onChange={() => toggleDrink(drink.id)}
                    aria-label={`Trade ${drink.name}`}
                    className="h-4 w-4 cursor-pointer accent-admin-primary"
                  />
                  <span className="truncate">{drink.name}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventForm({
  event,
  drinks,
  live,
  formError,
  onSubmit,
}: {
  event: StockMarketEventSummary | null;
  drinks: DrinkOption[];
  live: boolean;
  formError: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  const [selectedDrinks, setSelectedDrinks] = useState<number[]>(event?.menuItemIds ?? []);
  const config = event?.config ?? DEFAULT_MARKET_CONFIG;

  return (
    <form
      id="stock-market-event-form"
      action={onSubmit}
      className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
    >
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="menu_item_ids" value={JSON.stringify(selectedDrinks)} />

      <DetailCard className="divide-y divide-admin-line/50">
        <FormRow label="Name" required dense>
          <input
            name="name"
            required
            maxLength={80}
            aria-label="Name"
            placeholder="e.g. Friday floor"
            defaultValue={event?.name ?? ""}
            className={FIELD_INPUT}
          />
        </FormRow>
        <FormRow label="Opens at" required dense>
          <input
            type="time"
            name="open_time"
            required
            aria-label="Opening time"
            defaultValue={event?.openTime || "19:00"}
            className={FIELD_INPUT}
          />
        </FormRow>
        <FormRow label="Closes at" required dense>
          <input
            type="time"
            name="close_time"
            required
            aria-label="Closing time"
            defaultValue={event?.closeTime || "23:30"}
            className={FIELD_INPUT}
          />
        </FormRow>
      </DetailCard>

      <div>
        <p className="mb-2 px-1 text-[11px] font-semibold text-admin-muted">Market settings</p>
        <DetailCard className="divide-y divide-admin-line/50">
          <ConfigFormRows config={config} />
        </DetailCard>
        {live && (
          <p className="mt-2 px-1 text-[11px] text-admin-muted">
            This event&apos;s market is live. Changes here apply the next time it is opened; use
            the live settings above to change the running market.
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold text-admin-muted">Drinks on the board</p>
          <p className="text-[11px] font-semibold text-admin-muted tabular-nums">
            {selectedDrinks.length} selected
          </p>
        </div>
        <DetailCard>
          <DrinkPicker drinks={drinks} selected={selectedDrinks} onChange={setSelectedDrinks} />
        </DetailCard>
      </div>

      {formError && <ErrorBox message={formError} />}
    </form>
  );
}

function StockSelect({
  instrument,
  disabled,
  onChange,
}: {
  instrument: InstrumentSummary;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={`Stock override for ${instrument.name}`}
      value={instrument.stockOverride ?? "auto"}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 cursor-pointer rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none"
    >
      <option value="auto">Auto</option>
      <option value="ok">In stock</option>
      <option value="low">Running low</option>
      <option value="out">Sold out</option>
    </select>
  );
}

function stockLabel(state: StockState): { label: string; className: string } {
  if (state === "out") return { label: "Sold out", className: "bg-admin-error-bg text-admin-error" };
  if (state === "low") return { label: "Running low", className: "bg-admin-warning-bg text-admin-warning" };
  return { label: "In stock", className: "bg-admin-success-bg text-admin-success" };
}

function formatRunDate(iso: string | null): string {
  if (!iso) return "Never run";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function MarketClient({
  session,
  instruments,
  categories,
  drinks,
  events,
  employees,
  mappingRows,
  tillRestore,
  initialEditId,
}: {
  session: SessionSummary | null;
  instruments: InstrumentSummary[];
  categories: CategoryOption[];
  drinks: DrinkOption[];
  events: StockMarketEventSummary[];
  employees: EmployeeOption[];
  mappingRows: MappingRow[];
  tillRestore: TillRestoreSummary | null;
  initialEditId: number | null;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [mappingOpen, setMappingOpen] = useState(false);
  const [variations, setVariations] = useState<CatalogVariation[] | null>(null);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EventFilter>("all");

  const sheet = useRecordSheet<StockMarketEventSummary>({
    records: events,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const showForm = mode === "add" || mode === "edit";

  const openedFromUrl = useRef(false);
  const { openView, startEdit } = sheet;
  useEffect(() => {
    if (openedFromUrl.current || initialEditId == null) return;
    const target = events.find((event) => event.id === initialEditId);
    if (!target) return;
    openedFromUrl.current = true;
    openView(target);
    startEdit();
    router.replace("/settings/market");
  }, [initialEditId, events, openView, startEdit, router]);

  const live = session !== null;
  const liveEventId = session?.stockMarketEventId ?? null;
  const tradeableCount = categories.reduce((sum, cat) => sum + cat.tradeableCount, 0);

  const mappedCount = useMemo(
    () => mappingRows.filter((row) => row.isPrimary && row.squareVariationId).length,
    [mappingRows]
  );
  const primaryCount = useMemo(
    () => mappingRows.filter((row) => row.isPrimary).length,
    [mappingRows]
  );

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  const drinkNames = useMemo(() => new Map(drinks.map((drink) => [drink.id, drink])), [drinks]);

  const shownEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (needle && !event.name.toLowerCase().includes(needle)) return false;
      if (filter === "live") return event.id === liveEventId;
      if (filter === "run") return event.lastRunAt !== null;
      if (filter === "never") return event.lastRunAt === null;
      return true;
    });
  }, [events, query, filter, liveEventId]);

  function run(action: () => Promise<{ error?: string } | void>, success?: string) {
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

  function handleOpen(event: StockMarketEventSummary) {
    startTransition(async () => {
      const result = await openStockMarketEventAction(event.id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const count = "count" in result ? result.count : 0;
      toast.success(`${event.name} open - ${count} drinks trading.`);
      router.refresh();
    });
  }

  async function handleEnd() {
    const confirmed = await confirm({
      title: "Close the market?",
      description:
        "Trading stops, the board shows closed, and every linked drink goes back to its normal price on the till.",
      confirmLabel: "Close market",
    });
    if (confirmed) run(endMarketAction, "Market closed - till prices restored.");
  }

  async function handleRestoreTill() {
    if (!tillRestore) return;
    const confirmed = await confirm({
      title: "Restore till prices?",
      description:
        tillRestore.status === "live"
          ? `${tillRestore.count} linked drinks go back to their normal price on the till now. The market stays open and the next tick will move them again.`
          : `${tillRestore.count} linked drinks still show market-night prices on the till. This puts the normal menu prices back.`,
      confirmLabel: "Restore prices",
    });
    if (confirmed) {
      run(() => restoreTillPricesAction(tillRestore.sessionId), "Till prices restored.");
    }
  }

  async function handleCrash() {
    const confirmed = await confirm({
      title: "Crash the market?",
      description: "Every price tumbles toward the crash floor for the next few ticks.",
      confirmLabel: "Crash it",
    });
    if (confirmed) run(crashMarketAction, "Crash triggered - watch the board.");
  }

  function handleDeactivate() {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Deactivate event",
      description: `"${selected.name}" will disappear from this list. Past market nights run under it stay in the history.`,
      confirmLabel: "Deactivate",
      action: async () => {
        const result = await deactivateStockMarketEventAction(selected.id);
        if (!result.error) router.refresh();
        return result;
      },
    });
  }

  const submitEvent = sheet.submit(async (formData) => {
    const result = await saveStockMarketEventAction(formData);
    if (!result.error) router.refresh();
    return result;
  });

  async function openMappings() {
    setMappingOpen((open) => !open);
    if (variations || loadingVariations) return;
    setLoadingVariations(true);
    const result = await loadCatalogVariationsAction();
    setLoadingVariations(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    setVariations(result.variations ?? []);
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
        `Square catalog updated - ${result?.created ?? 0} items created, ${result?.linked ?? 0} serves linked${result?.skipped ? `, ${result.skipped} already existed` : ""}.`
      );
      setVariations(null);
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
        `Matched ${result?.matched ?? 0} serves${result?.unmatched ? `, ${result.unmatched} still unmatched` : ""}.`
      );
      setVariations(null);
      router.refresh();
    });
  }

  const sheetTitle =
    mode === "add" ? "New stock market event" : mode === "edit" ? "Edit event" : "View event";
  const selectedIsLive = selected != null && selected.id === liveEventId;

  const selectedDrinksByCategory = useMemo(() => {
    if (!selected) return [];
    const groups = new Map<string, string[]>();
    for (const id of selected.menuItemIds) {
      const drink = drinkNames.get(id);
      if (!drink) continue;
      groups.set(drink.categoryName, [...(groups.get(drink.categoryName) ?? []), drink.name]);
    }
    return [...groups.entries()];
  }, [selected, drinkNames]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-2 py-3 sm:px-4 sm:py-0 md:px-6">
      {ConfirmDialogUI}


      <RecordList
        variant="panel"
        title="Stock market events"
        count={shownEvents.length}
        onAdd={sheet.openAdd}
        addLabel="New event"
        activeFilterCount={filter === "all" ? 0 : 1}
        toolbar={
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search events"
            placeholder="Search by name"
          />
        }
        filters={
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            <FilterChip active={filter === "live"} onClick={() => setFilter("live")}>
              Live now
            </FilterChip>
            <FilterChip active={filter === "run"} onClick={() => setFilter("run")}>
              Has been run
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
                : "Create an event to choose the drinks and settings for a market night."
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
            return (
              <ListRow
                key={event.id}
                onClick={() => sheet.openView(event)}
                selected={selected?.id === event.id}
                status={
                  <StatusPill
                    tone={isLive ? "success" : "neutral"}
                    icon={isLive ? <Check className="h-3 w-3" /> : undefined}
                    className="sm:w-20 sm:justify-center"
                  >
                    {isLive ? "Live" : "Ready"}
                  </StatusPill>
                }
                actions={
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isLive ? (
                      <>
                        <a
                          href="/market/board"
                          target="_blank"
                          rel="noreferrer"
                          className={NEUTRAL_BUTTON}
                        >
                          <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:inline">Open big screen</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleEnd}
                          disabled={isPending}
                          className={NEUTRAL_BUTTON}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:inline">Close market</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCrash}
                          disabled={isPending}
                          className={OUTLINE_BUTTON}
                        >
                          <TrendingDown className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:inline">Crash market</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpen(event)}
                        disabled={isPending || live}
                        title={live ? "Close the live market first" : undefined}
                        className={PRIMARY_BUTTON}
                      >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Open market</span>
                      </button>
                    )}
                  </div>
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-admin-ink">{event.name}</p>
                  <p className="text-[11px] text-admin-muted">
                    {formatTimeWindow(event.openTime, event.closeTime)} · {event.menuItemIds.length}{" "}
                    {event.menuItemIds.length === 1 ? "drink" : "drinks"} ·{" "}
                    {event.lastRunAt ? `Last run ${formatRunDate(event.lastRunAt)}` : "Never run"}
                  </p>
                </div>
              </ListRow>
            );
          })
        )}
      </RecordList>

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={mode}
        title={sheetTitle}
        recordId={selected?.id}
        formId="stock-market-event-form"
        isPending={sheet.isPending}
        onEdit={sheet.startEdit}
        onCancel={mode === "add" || !selected ? sheet.close : () => sheet.openView(selected)}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <StatusPill tone={selectedIsLive ? "success" : "neutral"} showLabelOnMobile>
              {selectedIsLive ? "Live now" : "Ready to open"}
            </StatusPill>
          )
        }
        actions={
          mode === "view" && selected && !selectedIsLive ? (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={sheet.isPending}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-admin-line px-3 text-[12px] font-semibold text-admin-error transition-colors hover:bg-admin-error-bg disabled:opacity-50"
            >
              Deactivate
            </button>
          ) : undefined
        }
        systemInfo={
          selected == null
            ? undefined
            : {
                createdAt: selected.createdAt,
                createdBy: employeeName(selected.createdBy),
                updatedAt: selected.updatedAt,
                updatedBy: employeeName(selected.updatedBy),
              }
        }
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell dense label="Name" value={selected.name} />
              <DetailCell dense label="Opens at" value={selected.openTime} />
              <DetailCell dense label="Closes at" value={selected.closeTime} />
            </DetailCard>
            <DetailCard>
              {CONFIG_FIELDS.map((field) => (
                <DetailCell
                  key={field.key}
                  dense
                  label={field.label}
                  value={String(selected.config[field.key])}
                />
              ))}
            </DetailCard>
            <DetailCard>
              <DetailCell
                dense
                label="Last run"
                value={selected.lastRunAt ? formatRunDate(selected.lastRunAt) : "Never"}
              />
              <DetailCell
                multiline
                label="Drinks"
                value={
                  selectedDrinksByCategory.length === 0 ? (
                    "None selected"
                  ) : (
                    <span className="block space-y-1 text-left">
                      {selectedDrinksByCategory.map(([category, names]) => (
                        <span key={category} className="block">
                          <span className="text-[11px] font-semibold text-admin-muted">
                            {category}:{" "}
                          </span>
                          {names.join(", ")}
                        </span>
                      ))}
                    </span>
                  )
                }
              />
            </DetailCard>
            <Link
              href={`/settings/market/${selected.id}`}
              className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-primary text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft sm:h-9"
            >
              Full details and past nights
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <EventForm
            key={`${mode}-${selected?.id ?? "new"}`}
            event={mode === "edit" ? selected : null}
            drinks={drinks}
            live={selectedIsLive}
            formError={sheet.formError}
            onSubmit={submitEvent}
          />
        )}
      </RecordSheet>

      {live && (
        <section className={CARD}>
          <h3 className="mb-3 text-sm font-bold text-admin-ink">Trading floor</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-125 text-left">
              <thead>
                <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                  <th className="py-2 pr-3">Drink</th>
                  <th className="py-2 pr-3 text-right">Base</th>
                  <th className="py-2 pr-3 text-right">Now</th>
                  <th className="py-2 pr-3 text-right">Demand</th>
                  <th className="py-2 pr-3">Stock</th>
                  <th className="py-2">Override</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((instrument) => {
                  const stock = stockLabel(instrument.stockState);
                  const up = instrument.currentPrice > instrument.basePrice;
                  const down = instrument.currentPrice < instrument.basePrice;
                  return (
                    <tr key={instrument.id} className="border-b border-admin-line/60">
                      <td className="py-2 pr-3">
                        <p className="text-[13px] font-semibold text-admin-ink">{instrument.name}</p>
                        <p className="text-[11px] text-admin-muted">
                          {instrument.serve}
                          {!instrument.mapped && " · not linked to Square"}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-right text-[13px] text-admin-muted tabular-nums">
                        {formatGbp(instrument.basePrice)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 text-right text-[13px] font-semibold tabular-nums",
                          up ? "text-admin-success" : down ? "text-admin-error" : "text-admin-ink"
                        )}
                      >
                        {formatGbp(instrument.currentPrice)}
                      </td>
                      <td className="py-2 pr-3 text-right text-[13px] text-admin-muted tabular-nums">
                        {instrument.demandUnits.toFixed(1)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            stock.className
                          )}
                        >
                          {stock.label}
                        </span>
                      </td>
                      <td className="py-2">
                        <StockSelect
                          instrument={instrument}
                          disabled={isPending}
                          onChange={(value) =>
                            run(() => setStockOverrideAction(instrument.id, value))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link2 className="h-5 w-5 text-admin-primary" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-admin-ink">Square links</h3>
              <p className="text-[11px] text-admin-muted">
                Till sales drive demand for linked serves; inventory drives sold-out alerts ·{" "}
                {mappedCount}/{primaryCount} lead serves linked
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePushToSquare}
              disabled={isPending}
              className={OUTLINE_BUTTON}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              Send menu to Square
            </button>
            <button
              type="button"
              onClick={handleAutoMatch}
              disabled={isPending}
              className={OUTLINE_BUTTON}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Wand2 className="h-4 w-4" aria-hidden="true" />
              )}
              Auto-match
            </button>
            <button type="button" onClick={openMappings} className={NEUTRAL_BUTTON}>
              {mappingOpen ? "Hide serves" : "Edit links"}
            </button>
          </div>
        </div>

        {/* Only rendered while Square still holds market prices, so after a
            clean close it disappears on its own. Amber because it is a
            pending decision, per the Requests/Bookings colour semantics. */}
        {tillRestore && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-admin-warning/40 bg-admin-warning-bg px-3 py-2.5">
            <p className="text-[13px] text-admin-ink">
              <span className="font-semibold">
                {tillRestore.count} drink{tillRestore.count === 1 ? "" : "s"} still at market price on the till
              </span>
              <span className="text-admin-muted">
                {tillRestore.status === "live"
                  ? " · market is live"
                  : ` · market ended ${formatRunDate(tillRestore.endedAt)}`}
              </span>
            </p>
            <button
              type="button"
              onClick={handleRestoreTill}
              disabled={isPending}
              className={OUTLINE_BUTTON}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              )}
              Restore till prices
            </button>
          </div>
        )}

        {mappingOpen && (
          <div className="mt-4">
            {loadingVariations && (
              <p className="flex items-center gap-2 py-4 text-[13px] text-admin-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading the Square catalog…
              </p>
            )}
            {!loadingVariations && (
              <ul className="divide-y divide-admin-line/60">
                {mappingRows.map((row) => (
                  <li
                    key={row.menuItemPriceId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-admin-ink">
                        {row.itemName}
                        {row.isPrimary && (
                          <span className="ml-1.5 rounded-full bg-admin-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-admin-primary">
                            on the board
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-admin-muted">
                        {row.categoryName} · {row.serve} · {formatGbp(row.amount)}
                      </p>
                    </div>
                    <select
                      aria-label={`Square variation for ${row.itemName} (${row.serve})`}
                      value={row.squareVariationId ?? ""}
                      disabled={isPending || !variations}
                      onChange={(event) =>
                        run(
                          () =>
                            saveMappingAction(
                              row.menuItemPriceId,
                              event.target.value || null
                            ),
                          "Link saved."
                        )
                      }
                      className="h-9 max-w-60 cursor-pointer rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none"
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
