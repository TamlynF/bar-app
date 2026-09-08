"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  History,
  Loader2,
  MonitorPlay,
  Play,
  Plus,
  PoundSterling,
  RotateCcw,
  Save,
  SearchX,
  Sparkles,
  Square,
  TrendingDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DetailCard,
  DetailCell,
  ErrorBox,
  FormRow,
  ListSearchInput,
  RecordSheet,
  StatusPill,
  useRecordSheet,
} from "@/components/admin";
import { formatGbp } from "@/lib/price";
import type { MarketConfig, StockState } from "@/lib/market/types";
import {
  formatTimeWindow,
  type StockMarketEventSummary,
} from "@/lib/market/stock-market-events";
import {
  defaultDrinkSettings,
  effectiveDrinkSettings,
  type DrinkOverrides,
  type EffectiveDrinkSettings,
} from "@/lib/market/drink-overrides";
import {
  addEventDrinksAction,
  crashInstrumentAction,
  crashMarketAction,
  endMarketAction,
  openStockMarketEventAction,
  removeEventDrinkAction,
  saveEventDrinkPricesAction,
  saveEventDrinkPricingAction,
  saveNightOnlyDrinkAction,
  setInstrumentPriceAction,
  setStockOverrideAction,
} from "../actions";

export type LiveInstrument = {
  id: number;
  openingPrice: number;
  currentPrice: number;
  demandUnits: number;
  stockState: StockState;
  stockOverride: StockState | null;
  crashing: boolean;
};

export type EventDrink = {
  id: number;
  name: string;
  isActive: boolean;
  categoryName: string;
  categoryOrder: number;
  nightOnly: boolean;
  serve: string | null;
  basePrice: number | null;
  linked: boolean;
  overrides: DrinkOverrides;
  instrument: LiveInstrument | null;
};

export type AvailableDrink = {
  id: number;
  name: string;
  categoryName: string;
  serve: string;
  basePrice: number;
};

export type EventSession = {
  id: number;
  status: string;
  tickNo: number;
  startedAt: string;
  endedAt: string | null;
};

type AddPicker = { kind: "add" };

const PRICE_KEYS = ["openingPrice", "minPrice", "maxPrice", "crashPrice"] as const;
type PriceKey = (typeof PRICE_KEYS)[number];
type PriceDraft = Record<PriceKey, string>;

const PRICE_LABELS: Record<PriceKey, string> = {
  openingPrice: "Opening",
  minPrice: "Min",
  maxPrice: "Max",
  crashPrice: "Crash",
};

const EMPTY_DRAFT: PriceDraft = { openingPrice: "", minPrice: "", maxPrice: "", crashPrice: "" };

function draftFromOverrides(overrides: DrinkOverrides): PriceDraft {
  return {
    openingPrice: overrides.openingPrice?.toString() ?? "",
    minPrice: overrides.minPrice?.toString() ?? "",
    maxPrice: overrides.maxPrice?.toString() ?? "",
    crashPrice: overrides.crashPrice?.toString() ?? "",
  };
}

function normalisePrice(value: string): string {
  return value.trim() === "" ? "" : String(Number(value));
}

function sameDraft(a: PriceDraft, b: PriceDraft): boolean {
  return PRICE_KEYS.every((key) => normalisePrice(a[key]) === normalisePrice(b[key]));
}

function hasDraftValue(draft: PriceDraft): boolean {
  return PRICE_KEYS.some((key) => draft[key].trim() !== "");
}

type DrinkGroup = { name: string; drinks: EventDrink[] };

function groupByCategory(drinks: EventDrink[]): DrinkGroup[] {
  const groups: DrinkGroup[] = [];
  for (const drink of drinks) {
    const name = drink.nightOnly ? "Tonight only" : drink.categoryName;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.drinks.push(drink);
    else groups.push({ name, drinks: [drink] });
  }
  return groups;
}

function PriceInput({
  label,
  value,
  placeholder,
  disabled,
  autoFocus,
  onChange,
  onSubmit,
  className,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.05"
      min="0"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter" && onSubmit) {
          event.preventDefault();
          onSubmit();
        }
      }}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-10 w-full rounded-lg border border-admin-line bg-admin-card px-2 text-right text-sm font-semibold text-admin-ink tabular-nums outline-none placeholder:font-normal placeholder:text-admin-muted/50 focus:border-admin-primary disabled:opacity-50 [appearance:textfield] sm:h-9 sm:text-[13px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
    />
  );
}

const ROW_ICON_BUTTON =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9";

function stockLabel(state: StockState): { label: string; className: string } {
  if (state === "out")
    return {
      label: "Sold out",
      className: "bg-admin-error-bg text-admin-error",
    };
  if (state === "low")
    return {
      label: "Running low",
      className: "bg-admin-warning-bg text-admin-warning",
    };
  return {
    label: "In stock",
    className: "bg-admin-success-bg text-admin-success",
  };
}

function StockSelect({
  drinkName,
  instrument,
  disabled,
  onChange,
}: {
  drinkName: string;
  instrument: LiveInstrument;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={`Stock override for ${drinkName}`}
      value={instrument.stockOverride ?? "auto"}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
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

const PRIMARY_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:h-9";
const OUTLINE_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft disabled:opacity-50 sm:h-9";
const NEUTRAL_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-line px-4 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface disabled:opacity-50 sm:h-9";
const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";

function formatStamp(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function matches(
  needle: string,
  ...fields: (string | null | undefined)[]
): boolean {
  if (!needle) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}

function formatPct(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

type OverrideField = {
  key: keyof DrinkOverrides;
  name: string;
  label: string;
  step: string;
  min: string;
  format: (value: number) => string;
};

const OVERRIDE_FIELDS: OverrideField[] = [
  {
    key: "openingPrice",
    name: "opening_price",
    label: "Opening price (£)",
    step: "0.05",
    min: "0.05",
    format: formatGbp,
  },
  {
    key: "minPrice",
    name: "min_price",
    label: "Min price (£)",
    step: "0.05",
    min: "0.05",
    format: formatGbp,
  },
  {
    key: "maxPrice",
    name: "max_price",
    label: "Max price (£)",
    step: "0.05",
    min: "0.05",
    format: formatGbp,
  },
  {
    key: "crashPrice",
    name: "crash_price",
    label: "Crash price (£)",
    step: "0.05",
    min: "0.05",
    format: formatGbp,
  },
  {
    key: "lowStockAt",
    name: "low_stock_at",
    label: "Low stock at",
    step: "1",
    min: "0",
    format: (value) => String(value),
  },
  {
    key: "alertThreshold",
    name: "alert_threshold",
    label: "Alert threshold",
    step: "0.01",
    min: "0.01",
    format: formatPct,
  },
];

function drinkSettings(
  drink: EventDrink,
  config: MarketConfig,
): { effective: EffectiveDrinkSettings; defaults: EffectiveDrinkSettings } | null {
  if (drink.basePrice == null) return null;
  return {
    effective: effectiveDrinkSettings(drink.basePrice, config, drink.overrides),
    defaults: defaultDrinkSettings(drink.basePrice, config),
  };
}

function OverrideFields({
  drink,
  basePrice,
  config,
}: {
  drink: EventDrink | null;
  basePrice: number | null;
  config: MarketConfig;
}) {
  const defaults =
    basePrice != null ? defaultDrinkSettings(basePrice, config) : null;
  return (
    <>
      <DetailCard className="divide-y divide-admin-line/50">
        {OVERRIDE_FIELDS.map((field) => (
          <FormRow key={field.key} label={field.label} dense>
            <input
              type="number"
              name={field.name}
              min={field.min}
              step={field.step}
              aria-label={field.label}
              placeholder={
                defaults ? `Event: ${field.format(defaults[field.key])}` : ""
              }
              defaultValue={drink?.overrides[field.key] ?? ""}
              className={FIELD_INPUT}
            />
          </FormRow>
        ))}
      </DetailCard>
      <p className="px-1 text-[11px] text-admin-muted">
        Leave a field blank to use the event setting. Opening price defaults to
        the base price. Alert threshold is a fraction, so 0.05 alerts on a 5%
        move. Changes apply the next time this event is opened.
      </p>
    </>
  );
}

function DrinkForm({
  eventId,
  drink,
  nightOnly,
  config,
  formError,
  onSubmit,
}: {
  eventId: number;
  drink: EventDrink | null;
  nightOnly: boolean;
  config: MarketConfig;
  formError: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  const [amount, setAmount] = useState(drink?.basePrice ?? null);
  return (
    <form
      id="event-drink-form"
      action={onSubmit}
      className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
    >
      <input type="hidden" name="event_id" value={eventId} />
      {drink && <input type="hidden" name="id" value={drink.id} />}
      {nightOnly && (
        <>
          <DetailCard className="divide-y divide-admin-line/50">
            <FormRow label="Name" required dense>
              <input
                name="name"
                required
                maxLength={80}
                aria-label="Drink name"
                placeholder="e.g. Pumpkin spiced ale"
                defaultValue={drink?.name ?? ""}
                className={FIELD_INPUT}
              />
            </FormRow>
            <FormRow label="Serve" required dense>
              <input
                name="serve"
                required
                maxLength={40}
                aria-label="Serve"
                placeholder="pint, each, single…"
                defaultValue={drink?.serve ?? "each"}
                className={FIELD_INPUT}
              />
            </FormRow>
            <FormRow label="Base price (£)" required dense>
              <input
                type="number"
                name="amount"
                required
                min="0.05"
                step="0.05"
                aria-label="Base price"
                defaultValue={drink?.basePrice ?? ""}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setAmount(Number.isFinite(next) && next > 0 ? next : null);
                }}
                className={FIELD_INPUT}
              />
            </FormRow>
          </DetailCard>
          <p className="px-1 text-[11px] text-admin-muted">
            Tonight-only drinks stay off the public menu and are deleted when
            removed from their last event.
          </p>
        </>
      )}
      <h4 className="px-1 text-[12px] font-semibold text-admin-ink">
        Pricing on this event
      </h4>
      <OverrideFields drink={drink} basePrice={amount} config={config} />
      {formError && <ErrorBox message={formError} />}
    </form>
  );
}

function AddDrinksForm({
  available,
  formError,
  onSubmit,
}: {
  available: AvailableDrink[];
  formError: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const needle = query.trim().toLowerCase();
  const shown = available.filter((drink) =>
    matches(needle, drink.name, drink.categoryName),
  );
  const selectedSet = new Set(selected);

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((d) => d !== id) : [...current, id],
    );
  }

  return (
    <form
      id="add-drinks-form"
      action={onSubmit}
      className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
    >
      <input
        type="hidden"
        name="menu_item_ids"
        value={JSON.stringify(selected)}
      />
      <ListSearchInput
        value={query}
        onChange={setQuery}
        label="Search the menu"
        placeholder="Search by drink or category"
      />
      <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-admin-muted">
        <span>{available.length} drinks not yet on this event</span>
        <span className="tabular-nums">{selected.length} selected</span>
      </div>
      <DetailCard>
        {shown.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-admin-muted sm:px-5">
            {available.length === 0
              ? "Every priced menu drink is already on this event."
              : "No drinks match."}
          </p>
        ) : (
          <div className="divide-y divide-admin-line/50">
            {shown.map((drink) => (
              <label
                key={drink.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-1.5 sm:px-5"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(drink.id)}
                  onChange={() => toggle(drink.id)}
                  aria-label={`Add ${drink.name}`}
                  className="h-4 w-4 cursor-pointer accent-admin-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-admin-ink">
                    {drink.name}
                  </span>
                  <span className="block text-[11px] text-admin-muted">
                    {drink.categoryName} · {drink.serve}
                  </span>
                </span>
                <span className="text-[13px] text-admin-muted tabular-nums">
                  {formatGbp(drink.basePrice)}
                </span>
              </label>
            ))}
          </div>
        )}
      </DetailCard>
      {formError && <ErrorBox message={formError} />}
    </form>
  );
}

export default function EventDetailClient({
  event,
  drinks,
  available,
  sessions,
  isLive,
  anyLive,
}: {
  event: StockMarketEventSummary;
  drinks: EventDrink[];
  available: AvailableDrink[];
  sessions: EventSession[];
  isLive: boolean;
  anyLive: boolean;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<number, PriceDraft>>({});
  const [priceEdit, setPriceEdit] = useState<{ instrumentId: number; value: string } | null>(null);

  const drinkSheet = useRecordSheet<EventDrink>({
    records: drinks,
    getId: (drink) => drink.id,
  });
  const addSheet = useRecordSheet<AddPicker>();

  const needle = query.trim().toLowerCase();
  const shownDrinks = useMemo(
    () =>
      drinks.filter((drink) =>
        matches(needle, drink.name, drink.categoryName, drink.serve),
      ),
    [drinks, needle],
  );
  const groups = useMemo(() => groupByCategory(shownDrinks), [shownDrinks]);

  const dirtyDrinks = drinks.filter((drink) => {
    const draft = priceDrafts[drink.id];
    return draft != null && !sameDraft(draft, draftFromOverrides(drink.overrides));
  });

  function draftFor(drink: EventDrink): PriceDraft {
    return priceDrafts[drink.id] ?? draftFromOverrides(drink.overrides);
  }

  function setDraft(drink: EventDrink, key: PriceKey, value: string) {
    setPriceDrafts((prev) => ({
      ...prev,
      [drink.id]: { ...(prev[drink.id] ?? draftFromOverrides(drink.overrides)), [key]: value },
    }));
  }

  function resetDraft(drink: EventDrink) {
    setPriceDrafts((prev) => ({ ...prev, [drink.id]: EMPTY_DRAFT }));
  }

  function handleSavePrices() {
    if (dirtyDrinks.length === 0) return;
    const rows = dirtyDrinks.map((drink) => ({
      menuItemId: drink.id,
      overrides: {
        ...draftFor(drink),
        lowStockAt: drink.overrides.lowStockAt,
        alertThreshold: drink.overrides.alertThreshold,
      },
    }));
    startTransition(async () => {
      const result = await saveEventDrinkPricesAction(event.id, rows);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Prices saved for ${rows.length} ${rows.length === 1 ? "drink" : "drinks"}.`);
      router.refresh();
    });
  }

  function startPriceEdit(instrument: LiveInstrument) {
    setPriceEdit({ instrumentId: instrument.id, value: instrument.currentPrice.toFixed(2) });
  }

  function handleSetPrice() {
    if (!priceEdit) return;
    const price = Number(priceEdit.value);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a price above zero.");
      return;
    }
    const { instrumentId } = priceEdit;
    setPriceEdit(null);
    run(
      () => setInstrumentPriceAction(instrumentId, price),
      "Price set - it shows on the board from the next tick."
    );
  }

  function run(
    action: () => Promise<{ error?: string } | void>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function handleOpen() {
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
        "Trading stops and the board shows closed. Menu prices are untouched.",
      confirmLabel: "Close market",
    });
    if (confirmed) run(endMarketAction, "Market closed.");
  }

  async function handleCrashDrink(drink: EventDrink, instrument: LiveInstrument) {
    const confirmed = await confirm({
      title: `Crash ${drink.name}?`,
      description:
        "This drink's price tumbles toward its crash price for the next few ticks. Everything else keeps trading normally.",
      confirmLabel: "Crash it",
    });
    if (confirmed) {
      run(
        () => crashInstrumentAction(instrument.id),
        `${drink.name} is crashing - watch the board.`,
      );
    }
  }

  async function handleCrash() {
    const confirmed = await confirm({
      title: "Crash the market?",
      description:
        "Every price tumbles toward the crash floor for the next few ticks.",
      confirmLabel: "Crash it",
    });
    if (confirmed) run(crashMarketAction, "Crash triggered - watch the board.");
  }

  function handleRemove() {
    const drink = drinkSheet.selected;
    if (!drink) return;
    drinkSheet.confirmDelete({
      title: "Remove drink from event",
      description: drink.nightOnly
        ? `"${drink.name}" is a tonight-only drink and will be deleted.`
        : `"${drink.name}" comes off this event. It stays on the menu.`,
      confirmLabel: "Remove",
      action: async () => {
        const result = await removeEventDrinkAction(event.id, drink.id);
        if (!result.error) router.refresh();
        return result;
      },
    });
  }

  const submitDrink = drinkSheet.submit(async (formData) => {
    const editingMenuDrink =
      drinkSheet.mode === "edit" && drinkSheet.selected?.nightOnly === false;
    const result = editingMenuDrink
      ? await saveEventDrinkPricingAction(formData)
      : await saveNightOnlyDrinkAction(formData);
    if ("error" in result && result.error) return { error: result.error };
    const savedId = drinkSheet.selected?.id;
    if (savedId != null) {
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[savedId];
        return next;
      });
    }
    router.refresh();
  });

  const submitAddDrinks = addSheet.submit(async (formData) => {
    let ids: number[] = [];
    try {
      ids = JSON.parse(formData.get("menu_item_ids")?.toString() || "[]");
    } catch {
      ids = [];
    }
    const result = await addEventDrinksAction(event.id, ids);
    if (!result.error) {
      toast.success(`${"count" in result ? result.count : 0} drinks added.`);
      router.refresh();
    }
    return result;
  });

  const { selected: selectedDrink, mode: drinkMode } = drinkSheet;
  const drinkShowForm = drinkMode === "add" || drinkMode === "edit";
  const drinkTitle =
    drinkMode === "add"
      ? "New tonight-only drink"
      : drinkMode === "edit"
        ? selectedDrink?.nightOnly
          ? "Edit drink"
          : "Edit pricing"
        : "Drink";
  const selectedSettings = selectedDrink
    ? drinkSettings(selectedDrink, event.config)
    : null;

  return (
    <div className="w-full space-y-4 px-2 py-3 sm:px-4 sm:py-0 md:px-6">
      {ConfirmDialogUI}

      <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="hidden text-base leading-tight font-bold text-admin-ink sm:block">
              {event.name}
            </h2>
            <StatusPill tone={isLive ? "success" : "neutral"} showLabelOnMobile>
              {isLive ? "Live now" : "Ready to open"}
            </StatusPill>
          </div>
          <p className="mt-1.5 text-[13px] text-admin-muted">
            {formatTimeWindow(event.openTime, event.closeTime)} · {drinks.length}{" "}
            {drinks.length === 1 ? "drink" : "drinks"}
            {isLive ? " trading" : ""}
          </p>
          <p className="mt-0.5 text-[13px] text-admin-muted">
            {isLive
              ? `Opened ${formatStamp(sessions.find((session) => session.status === "live")?.startedAt ?? null)}`
              : event.lastRunAt
                ? `Last run ${formatStamp(event.lastRunAt)}`
                : "Never run"}
          </p>
        </div>

        {/* One primary action for the market's state; everything else is
            secondary - labelled on desktop, behind a menu on phones. */}
        <div className="mt-4 flex flex-wrap items-center gap-2 [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap">
          {isLive ? (
            <button
              type="button"
              onClick={handleEnd}
              disabled={isPending}
              aria-label="Close market"
              title="Close market"
              className={cn(PRIMARY_BUTTON, "flex-1 bg-admin-error hover:bg-admin-error/90 max-sm:px-0 sm:flex-none")}
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span className="hidden sm:inline">Close market</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpen}
              disabled={isPending || anyLive}
              title={anyLive ? "Close the live market first" : undefined}
              className={cn(PRIMARY_BUTTON, "flex-1 bg-admin-success hover:bg-admin-success/90 sm:flex-none")}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              )}
              Open market
            </button>
          )}
          {/* On a phone all three share one row as equal icon buttons, big
              screen then crash then close; from tablet up the pair is
              labelled and sits after the primary. */}
          {isLive && (
            <div className="flex items-center gap-2 max-sm:order-first max-sm:flex-[2] sm:w-auto">
              <a
                href="/market/board"
                target="_blank"
                rel="noreferrer"
                aria-label="Open big screen"
                title="Open big screen"
                className={cn(
                  NEUTRAL_BUTTON,
                  "flex-1 border-admin-info/40 bg-admin-info-bg text-admin-info hover:bg-admin-info/15 max-sm:px-0 sm:flex-none"
                )}
              >
                <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Big screen</span>
              </a>
              <button
                type="button"
                onClick={handleCrash}
                disabled={isPending}
                aria-label="Crash market"
                title="Crash market"
                className={cn(
                  NEUTRAL_BUTTON,
                  "flex-1 border-admin-warning/40 bg-admin-warning-bg text-admin-warning hover:bg-admin-warning/15 max-sm:px-0 sm:flex-none"
                )}
              >
                <TrendingDown className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Crash market</span>
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-admin-ink">
            Drinks on the board{" "}
            <span className="font-medium text-admin-muted">
              ({shownDrinks.length})
            </span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
            <button
              type="button"
              onClick={drinkSheet.openAdd}
              className={cn(OUTLINE_BUTTON, "whitespace-nowrap max-sm:flex-1 max-sm:px-2")}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Tonight-only
            </button>
            <button
              type="button"
              onClick={addSheet.openAdd}
              className={cn(OUTLINE_BUTTON, "whitespace-nowrap max-sm:flex-1 max-sm:px-2")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add from menu
            </button>
            {!isLive && drinks.length > 0 && (
              <button
                type="button"
                onClick={handleSavePrices}
                disabled={isPending || dirtyDrinks.length === 0}
                className={cn(PRIMARY_BUTTON, "whitespace-nowrap max-sm:w-full")}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                Save prices
                {dirtyDrinks.length > 0 && ` (${dirtyDrinks.length})`}
              </button>
            )}
          </div>
        </div>
        <div className="mb-3">
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search drinks on the board"
            placeholder="Search by drink, category or serve"
          />
        </div>
        {isLive ? (
          <p className="mb-3 text-[11px] text-admin-muted">
            The market is live. Prices are locked to what was set at opening;
            use Set price or Crash on a drink to step in. Drinks added or
            removed now trade from the next time this event is opened.
          </p>
        ) : (
          drinks.length > 0 && (
            <p className="mb-3 text-[11px] text-admin-muted">
              Set tonight&apos;s opening, min, max and crash prices per drink, then
              Save prices. An empty box uses the event default shown in grey.
            </p>
          )
        )}
        {drinks.length === 0 ? (
          <p className="text-[13px] text-admin-muted">
            No drinks selected. Add some from the menu or create a tonight-only
            drink.
          </p>
        ) : shownDrinks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <SearchX className="h-6 w-6 text-admin-muted" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-admin-ink">
              No drinks match
            </p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-admin-muted sm:hidden">
              Tap a drink for stock alerts and its Square link.
            </p>
            <ul className="m-0 list-none p-0 sm:hidden">
              {groups.map((group) => (
                <li key={group.name} className="mt-3 first:mt-0">
                  <p className="mb-1 rounded-lg bg-admin-surface px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                    {group.name}
                  </p>
                  <ul className="m-0 list-none divide-y divide-admin-line/60 p-0">
                    {group.drinks.map((drink) => {
                      const instrument = drink.instrument;
                      const settings = drinkSettings(drink, event.config);
                      const draft = draftFor(drink);
                      const stock = instrument && instrument.stockState !== "ok" ? stockLabel(instrument.stockState) : null;
                      const up = instrument ? instrument.currentPrice > instrument.openingPrice : false;
                      const down = instrument ? instrument.currentPrice < instrument.openingPrice : false;
                      const editing = instrument != null && priceEdit?.instrumentId === instrument.id;
                      return (
                        <li key={drink.id} className="py-2.5">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => drinkSheet.openView(drink)}
                            onKeyDown={(e) => {
                              if (e.target !== e.currentTarget) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                drinkSheet.openView(drink);
                              }
                            }}
                            className="flex min-h-11 w-full cursor-pointer items-center gap-3 text-left"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-admin-ink">
                                {drink.name}
                                {!drink.isActive && (
                                  <span className="ml-1.5 text-[11px] font-medium text-admin-muted">(inactive)</span>
                                )}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-admin-muted">
                                {drink.serve && <span>{drink.serve}</span>}
                                {drink.linked ? (
                                  <span className="rounded-full bg-admin-success-bg px-1.5 py-0.5 font-semibold text-admin-success">
                                    Square linked
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-admin-surface px-1.5 py-0.5 font-semibold">
                                    Not linked
                                  </span>
                                )}
                                {stock && (
                                  <span className={cn("rounded-full px-1.5 py-0.5 font-semibold", stock.className)}>
                                    {stock.label}
                                  </span>
                                )}
                                {instrument?.crashing && (
                                  <span className="rounded-full bg-admin-error-bg px-1.5 py-0.5 font-semibold text-admin-error">
                                    Crashing
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="shrink-0 text-right tabular-nums">
                              {instrument ? (
                                <>
                                  <span
                                    className={cn(
                                      "block text-sm font-semibold",
                                      up ? "text-admin-success" : down ? "text-admin-error" : "text-admin-ink"
                                    )}
                                  >
                                    {formatGbp(instrument.currentPrice)}
                                  </span>
                                  <span className="block text-[11px] text-admin-muted">
                                    opened {formatGbp(instrument.openingPrice)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="block text-sm font-semibold text-admin-ink">
                                    {drink.basePrice != null ? formatGbp(drink.basePrice) : "-"}
                                  </span>
                                  <span className="block text-[11px] text-admin-muted">base</span>
                                </>
                              )}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-admin-muted opacity-40" aria-hidden="true" />
                          </div>
                          {!isLive && settings && (
                            <div className="mt-2">
                              <div className="grid grid-cols-4 gap-1.5">
                                {PRICE_KEYS.map((key) => (
                                  <label key={key} className="block">
                                    <span className="mb-0.5 block text-[10px] font-semibold text-admin-muted">
                                      {PRICE_LABELS[key]}
                                    </span>
                                    <PriceInput
                                      label={`${PRICE_LABELS[key]} price for ${drink.name}`}
                                      value={draft[key]}
                                      placeholder={settings.defaults[key].toFixed(2)}
                                      disabled={isPending}
                                      onChange={(value) => setDraft(drink, key, value)}
                                    />
                                  </label>
                                ))}
                              </div>
                              {hasDraftValue(draft) && (
                                <button
                                  type="button"
                                  onClick={() => resetDraft(drink)}
                                  className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-admin-primary"
                                >
                                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                  Reset to base
                                </button>
                              )}
                            </div>
                          )}
                          {instrument && settings && (
                            <div className="mt-2">
                              <p className="text-[11px] text-admin-muted tabular-nums">
                                Demand {instrument.demandUnits.toFixed(1)} · Range{" "}
                                {formatGbp(settings.effective.minPrice)} to {formatGbp(settings.effective.maxPrice)}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                {editing ? (
                                  <>
                                    <PriceInput
                                      label={`New price for ${drink.name}`}
                                      value={priceEdit.value}
                                      autoFocus
                                      disabled={isPending}
                                      onChange={(value) => setPriceEdit({ instrumentId: instrument.id, value })}
                                      onSubmit={handleSetPrice}
                                      className="w-24 flex-none"
                                    />
                                    <button
                                      type="button"
                                      aria-label={`Save price for ${drink.name}`}
                                      title="Save price"
                                      disabled={isPending}
                                      onClick={handleSetPrice}
                                      className={cn(ROW_ICON_BUTTON, "border-admin-primary bg-admin-primary text-white hover:bg-admin-primary-hover")}
                                    >
                                      <Check className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Cancel price change"
                                      title="Cancel"
                                      onClick={() => setPriceEdit(null)}
                                      className={cn(ROW_ICON_BUTTON, "border-admin-line text-admin-muted hover:bg-admin-surface")}
                                    >
                                      <X className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className="min-w-0 flex-1">
                                      <StockSelect
                                        drinkName={drink.name}
                                        instrument={instrument}
                                        disabled={isPending}
                                        onChange={(value) =>
                                          run(() => setStockOverrideAction(instrument.id, value), "Stock override updated.")
                                        }
                                      />
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Set price for ${drink.name}`}
                                      title="Set price now"
                                      disabled={isPending || instrument.stockState === "out"}
                                      onClick={() => startPriceEdit(instrument)}
                                      className={cn(ROW_ICON_BUTTON, "border-admin-line text-admin-primary hover:bg-admin-primary-soft")}
                                    >
                                      <PoundSterling className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Crash ${drink.name}`}
                                      title="Crash this drink"
                                      disabled={isPending || instrument.crashing || instrument.stockState === "out"}
                                      onClick={() => handleCrashDrink(drink, instrument)}
                                      className={cn(ROW_ICON_BUTTON, "border-admin-warning/40 bg-admin-warning-bg text-admin-warning hover:bg-admin-warning/15")}
                                    >
                                      <TrendingDown className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-160 text-left">
                <thead>
                  <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                    <th className="py-2 pr-3">Drink</th>
                    <th className="py-2 pr-3">Serve</th>
                    <th className="py-2 pr-3 text-right">Base</th>
                    <th className="py-2 pr-3 text-right">Opening</th>
                    {isLive ? (
                      <>
                        <th className="py-2 pr-3 text-right">Now</th>
                        <th className="py-2 pr-3 text-right">Range</th>
                        <th className="py-2 pr-3 text-right">Demand</th>
                        <th className="py-2 pr-3">Stock</th>
                        <th className="py-2 pr-3">Override</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2 pr-3 text-right">Min</th>
                        <th className="py-2 pr-3 text-right">Max</th>
                        <th className="py-2 pr-3 text-right">Crash</th>
                      </>
                    )}
                    <th className="py-2 pr-3">Square</th>
                    <th className="py-2 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <Fragment key={group.name}>
                      <tr>
                        <td
                          colSpan={isLive ? 11 : 9}
                          className="bg-admin-surface px-2 py-1.5 text-[11px] font-semibold tracking-wide text-admin-muted uppercase"
                        >
                          {group.name}
                        </td>
                      </tr>
                      {group.drinks.map((drink) => {
                        const instrument = drink.instrument;
                        const settings = drinkSettings(drink, event.config);
                        const draft = draftFor(drink);
                        const stock = instrument ? stockLabel(instrument.stockState) : null;
                        const up = instrument ? instrument.currentPrice > instrument.openingPrice : false;
                        const down = instrument ? instrument.currentPrice < instrument.openingPrice : false;
                        const editing = instrument != null && priceEdit?.instrumentId === instrument.id;
                        return (
                          <tr
                            key={drink.id}
                            onClick={() => drinkSheet.openView(drink)}
                            className="cursor-pointer border-b border-admin-line/60 hover:bg-admin-surface/60"
                          >
                            <td className="py-1.5 pr-3 text-[13px] font-semibold text-admin-ink">
                              {drink.name}
                              {!drink.isActive && (
                                <span className="ml-1.5 text-[11px] font-medium text-admin-muted">(inactive)</span>
                              )}
                              {instrument?.crashing && (
                                <span className="ml-1.5 rounded-full bg-admin-error-bg px-2 py-0.5 text-[11px] font-semibold text-admin-error">
                                  Crashing
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-[13px] text-admin-muted">{drink.serve ?? "-"}</td>
                            <td className="py-1.5 pr-3 text-right text-[13px] text-admin-ink tabular-nums">
                              {drink.basePrice != null ? formatGbp(drink.basePrice) : "-"}
                            </td>
                            {isLive ? (
                              <>
                                <td className="py-1.5 pr-3 text-right text-[13px] text-admin-muted tabular-nums">
                                  {instrument ? formatGbp(instrument.openingPrice) : "-"}
                                </td>
                                <td
                                  className={cn(
                                    "py-1.5 pr-3 text-right text-[13px] tabular-nums",
                                    !instrument && "text-admin-muted",
                                    instrument && "font-semibold",
                                    up ? "text-admin-success" : down ? "text-admin-error" : instrument && "text-admin-ink"
                                  )}
                                >
                                  {instrument ? formatGbp(instrument.currentPrice) : "-"}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-[12px] whitespace-nowrap text-admin-muted tabular-nums">
                                  {settings
                                    ? `${formatGbp(settings.effective.minPrice)} to ${formatGbp(settings.effective.maxPrice)}`
                                    : "-"}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-[13px] text-admin-muted tabular-nums">
                                  {instrument ? instrument.demandUnits.toFixed(1) : "-"}
                                </td>
                                <td className="py-1.5 pr-3 text-[13px] text-admin-muted">
                                  {stock ? (
                                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", stock.className)}>
                                      {stock.label}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="py-1.5 pr-3 text-[13px] text-admin-muted" onClick={(e) => e.stopPropagation()}>
                                  {instrument ? (
                                    <StockSelect
                                      drinkName={drink.name}
                                      instrument={instrument}
                                      disabled={isPending}
                                      onChange={(value) =>
                                        run(() => setStockOverrideAction(instrument.id, value), "Stock override updated.")
                                      }
                                    />
                                  ) : (
                                    "-"
                                  )}
                                </td>
                              </>
                            ) : settings ? (
                              PRICE_KEYS.map((key) => (
                                <td key={key} className="py-1.5 pr-2" onClick={(e) => e.stopPropagation()}>
                                  <PriceInput
                                    label={`${PRICE_LABELS[key]} price for ${drink.name}`}
                                    value={draft[key]}
                                    placeholder={settings.defaults[key].toFixed(2)}
                                    disabled={isPending}
                                    onChange={(value) => setDraft(drink, key, value)}
                                    className="w-20"
                                  />
                                </td>
                              ))
                            ) : (
                              <td colSpan={4} className="py-1.5 pr-3 text-[13px] text-admin-muted">
                                No price yet
                              </td>
                            )}
                            <td className="py-1.5 pr-3 text-[11px] font-semibold">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 whitespace-nowrap",
                                  drink.linked ? "bg-admin-success-bg text-admin-success" : "bg-admin-surface text-admin-muted"
                                )}
                              >
                                {drink.linked ? "Linked" : "Not linked"}
                              </span>
                            </td>
                            <td className="py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                              {!isLive && hasDraftValue(draft) && (
                                <button
                                  type="button"
                                  aria-label={`Reset ${drink.name} to base pricing`}
                                  title="Reset to base"
                                  onClick={() => resetDraft(drink)}
                                  className={cn(ROW_ICON_BUTTON, "border-admin-line text-admin-muted hover:bg-admin-surface")}
                                >
                                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {instrument && (
                                <span className="inline-flex items-center justify-end gap-1.5">
                                  {editing ? (
                                    <>
                                      <PriceInput
                                        label={`New price for ${drink.name}`}
                                        value={priceEdit.value}
                                        autoFocus
                                        disabled={isPending}
                                        onChange={(value) => setPriceEdit({ instrumentId: instrument.id, value })}
                                        onSubmit={handleSetPrice}
                                        className="w-20"
                                      />
                                      <button
                                        type="button"
                                        aria-label={`Save price for ${drink.name}`}
                                        title="Save price"
                                        disabled={isPending}
                                        onClick={handleSetPrice}
                                        className={cn(ROW_ICON_BUTTON, "border-admin-primary bg-admin-primary text-white hover:bg-admin-primary-hover")}
                                      >
                                        <Check className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="Cancel price change"
                                        title="Cancel"
                                        onClick={() => setPriceEdit(null)}
                                        className={cn(ROW_ICON_BUTTON, "border-admin-line text-admin-muted hover:bg-admin-surface")}
                                      >
                                        <X className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        aria-label={`Set price for ${drink.name}`}
                                        title="Set price now"
                                        disabled={isPending || instrument.stockState === "out"}
                                        onClick={() => startPriceEdit(instrument)}
                                        className={cn(ROW_ICON_BUTTON, "border-admin-line text-admin-primary hover:bg-admin-primary-soft")}
                                      >
                                        <PoundSterling className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`Crash ${drink.name}`}
                                        title="Crash this drink"
                                        disabled={isPending || instrument.crashing || instrument.stockState === "out"}
                                        onClick={() => handleCrashDrink(drink, instrument)}
                                        className={cn(ROW_ICON_BUTTON, "border-admin-warning/40 bg-admin-warning-bg text-admin-warning hover:bg-admin-warning/15")}
                                      >
                                        <TrendingDown className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                    </>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <RecordSheet
        open={drinkSheet.open}
        onClose={drinkSheet.close}
        mode={drinkMode}
        title={drinkTitle}
        recordId={selectedDrink?.id}
        formId="event-drink-form"
        isPending={drinkSheet.isPending}
        onEdit={selectedDrink ? drinkSheet.startEdit : undefined}
        onDelete={selectedDrink ? handleRemove : undefined}
        onCancel={
          drinkMode === "add" || !selectedDrink
            ? drinkSheet.close
            : () => drinkSheet.openView(selectedDrink)
        }
        confirmUI={drinkSheet.ConfirmDialogUI}
        status={
          selectedDrink && (
            <StatusPill
              tone={selectedDrink.nightOnly ? "info" : "neutral"}
              showLabelOnMobile
            >
              {selectedDrink.nightOnly
                ? "Tonight only"
                : selectedDrink.categoryName}
            </StatusPill>
          )
        }
      >
        {!drinkShowForm && selectedDrink && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell dense label="Name" value={selectedDrink.name} />
              <DetailCell
                dense
                label="Category"
                value={selectedDrink.categoryName}
              />
              <DetailCell
                dense
                label="Serve"
                value={selectedDrink.serve ?? "-"}
              />
              <DetailCell
                dense
                label="Base price"
                value={
                  selectedDrink.basePrice != null
                    ? formatGbp(selectedDrink.basePrice)
                    : "-"
                }
              />
              <DetailCell
                dense
                label="Square"
                value={selectedDrink.linked ? "Linked" : "Not linked"}
              />
            </DetailCard>
            <h4 className="px-1 text-[12px] font-semibold text-admin-ink">
              Pricing on this event
            </h4>
            <DetailCard>
              {OVERRIDE_FIELDS.map((field) => {
                const overridden = selectedDrink.overrides[field.key] != null;
                return (
                  <DetailCell
                    key={field.key}
                    dense
                    label={field.label}
                    value={
                      selectedSettings ? (
                        <span className="tabular-nums">
                          {field.format(selectedSettings.effective[field.key])}
                          {!overridden && (
                            <span className="ml-1.5 text-[11px] font-medium text-admin-muted">
                              (event setting)
                            </span>
                          )}
                        </span>
                      ) : (
                        "-"
                      )
                    }
                  />
                );
              })}
            </DetailCard>
            {!selectedDrink.nightOnly && (
              <p className="px-1 text-[11px] text-admin-muted">
                This is a menu drink. Change its name, serves or base price on{" "}
                <Link
                  href="/settings/menu"
                  className="font-semibold text-admin-primary underline"
                >
                  Menu settings
                </Link>
                . Edit sets the pricing for this event only; Delete takes it
                off this event.
              </p>
            )}
            {drinkSheet.formError && (
              <ErrorBox message={drinkSheet.formError} />
            )}
          </div>
        )}
        {drinkShowForm && (
          <DrinkForm
            key={`${drinkMode}-${selectedDrink?.id ?? "new"}`}
            eventId={event.id}
            drink={drinkMode === "edit" ? selectedDrink : null}
            nightOnly={drinkMode === "add" || Boolean(selectedDrink?.nightOnly)}
            config={event.config}
            formError={drinkSheet.formError}
            onSubmit={submitDrink}
          />
        )}
      </RecordSheet>

      <RecordSheet
        open={addSheet.open}
        onClose={addSheet.close}
        mode={addSheet.mode}
        title="Add drinks from the menu"
        formId="add-drinks-form"
        isPending={addSheet.isPending}
        onCancel={addSheet.close}
        confirmUI={addSheet.ConfirmDialogUI}
      >
        {addSheet.mode === "add" && (
          <AddDrinksForm
            available={available}
            formError={addSheet.formError}
            onSubmit={submitAddDrinks}
          />
        )}
      </RecordSheet>

      <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-admin-ink">Market nights</h3>
          <Link
            href="/settings/market/history"
            className="flex items-center gap-1 text-[12px] font-semibold text-admin-primary hover:underline"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            All history
          </Link>
        </div>
        {sessions.length === 0 ? (
          <p className="text-[13px] text-admin-muted">
            This event has not been opened yet.
          </p>
        ) : (
          <ul className="divide-y divide-admin-line/60">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/settings/market/history?session=${session.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 hover:bg-admin-surface/60"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-admin-ink">
                      {formatStamp(session.startedAt)}
                      {session.endedAt
                        ? ` to ${formatStamp(session.endedAt)}`
                        : ""}
                    </p>
                    <p className="text-[11px] text-admin-muted">
                      {session.tickNo} price {session.tickNo === 1 ? "update" : "updates"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      session.status === "live"
                        ? "bg-admin-success-bg text-admin-success"
                        : "bg-admin-surface text-admin-muted",
                    )}
                  >
                    {session.status === "live" ? "Live" : "Ended"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
