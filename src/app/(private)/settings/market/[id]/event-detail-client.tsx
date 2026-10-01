"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CandlestickChart,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  SearchX,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  NormalUnitsCell,
  NormalUnitsKeepSwitch,
  NormalUnitsOverrideInput,
  type NormalUnitsView,
} from "./normal-units-card";
import { ReadyToOpenChecklist } from "./ready-to-open";
import { SheetRow, SheetSection } from "./sheet-section";
import { SwitchDisplay, SwitchField } from "./switch-field";
import SquareHistoryRows from "./square-history";
import ModifierListPopover from "../modifier-list-popover";
import { squareItemUrl } from "@/lib/market/simulate";
import type { SquareVariationDetail } from "@/lib/market/square-variation-details";
import { MarketNightsMenu, type EventSession } from "./market-nights-menu";
import { useSalesSyncCheck } from "../use-sales-sync-check";
import type { EventReadiness } from "@/lib/market/event-readiness";
import { FIELD_INPUT, OUTLINE_BUTTON, PRIMARY_BUTTON, formatStamp, salesSyncMessage } from "../ui";
import { cn } from "@/lib/utils";
import {
  DetailCard,
  ErrorBox,
  FormRow,
  ListSearchInput,
  RecordSheet,
  StatusPill,
  useRecordSheet,
} from "@/components/admin";
import { formatGbp } from "@/lib/price";
import type { MarketConfig } from "@/lib/market/types";
import { serveMixerPrice, withMixer } from "@/lib/market/mixer";
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
  openStockMarketEventAction,
  recalculateNormalUnitsAction,
  removeEventDrinkAction,
  saveEventDrinkPricesAction,
  saveEventDrinkPricingAction,
  saveNightOnlyDrinkAction,
  syncSquareSalesAction,
} from "../actions";

export type { EventSession } from "./market-nights-menu";

/* One serve on the event: `id` is the menu_item_prices row, which is what
   the event link and the overrides are keyed on. */
export type EventDrink = {
  id: number;
  menuItemId: number;
  name: string;
  isActive: boolean;
  categoryName: string;
  categoryOrder: number;
  nightOnly: boolean;
  serve: string;
  serveOrder: number;
  /* The menu's own price for the serve. */
  menuPrice: number | null;
  /* What the serve trades from: Square's price for the linked variation, or
     the menu price when Square has none. */
  basePrice: number | null;
  basePriceFromSquare: boolean;
  /* The event's normal units a night for this drink, null for the Square
     history figure; normalUnitsKeep keeps it after the next market night. */
  normalUnitsOverride: number | null;
  normalUnitsKeep: boolean;
  /* The name it trades under on this event; the menu item's name unless
     changed on the drink sheet. */
  displayName: string;
  /* Who created and last changed the serve behind this drink. */
  audit: { createdAt: string | null; createdBy: string | null; updatedAt: string | null; updatedBy: string | null };
  linked: boolean;
  squareVariationId: string | null;
  withMixer: boolean;
  squareMixerPrice: number | null;
  /* False when Square does not count this serve's stock; null when unknown. */
  stockTracked: boolean | null;
  overrides: DrinkOverrides;
};

export type AvailableDrink = {
  id: number;
  name: string;
  categoryName: string;
  serve: string;
  basePrice: number;
  linked: boolean;
  withMixer: boolean;
  squareMixerPrice: number | null;
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

/* Spirits sold with a mixer are priced on this page as guests pay for them,
   spirit + mixer. The event stores the spirit price the engine and the till
   move, so values are shifted by the mixer on the way in and out. */
function shiftPrice(value: string, by: number): string {
  if (value.trim() === "" || by === 0) return value;
  const n = Number(value);
  return Number.isFinite(n) ? String(withMixer(n, by)) : value;
}

function shiftedOverride(value: number | null | undefined, mixer: number): string {
  return value == null ? "" : String(withMixer(value, mixer));
}

function draftFromOverrides(overrides: DrinkOverrides, mixer = 0): PriceDraft {
  return {
    openingPrice: shiftedOverride(overrides.openingPrice, mixer),
    minPrice: shiftedOverride(overrides.minPrice, mixer),
    maxPrice: shiftedOverride(overrides.maxPrice, mixer),
    crashPrice: shiftedOverride(overrides.crashPrice, mixer),
  };
}

const PRICE_FIELD_NAMES = ["opening_price", "min_price", "max_price", "crash_price"];

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

function SquareLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Open in the Square dashboard"
      className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold break-all text-admin-primary underline-offset-2 hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

function formatMoney(amount: number, currency: string | null): string {
  if (!currency) return formatGbp(amount);
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `${formatGbp(amount)} ${currency}`;
  }
}

function NameAndId({ name, id, href }: { name: string; id: string; href: string }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5">
      <span>{name || "-"}</span>
      <span className="text-admin-muted" aria-hidden="true">
        -
      </span>
      <SquareLink href={href}>{id}</SquareLink>
    </span>
  );
}

/* Square's side of a linked serve, as the catalog copy last saw it. */
function SquareItemRows({
  detail,
  environment,
}: {
  detail: SquareVariationDetail;
  environment: "sandbox" | "production";
}) {
  const href = squareItemUrl(environment, detail.itemId);
  const quantity =
    detail.stockQuantity == null ? "-" : `${detail.stockQuantity}${detail.soldBy ? ` ${detail.soldBy}` : ""}`;
  const itemDefault = detail.stockTracking === "stock_count";
  return (
    <>
      <SheetRow label="Item" value={<NameAndId name={detail.itemName} id={detail.itemId} href={href} />} />
      <SheetRow label="Variation" value={<NameAndId name={detail.variationName} id={detail.variationId} href={href} />} />
      <SheetRow
        label="Price"
        value={
          <span className="tabular-nums">
            {detail.price == null ? "-" : formatMoney(detail.price, detail.currency)}
          </span>
        }
      />
      <SheetRow label="Reporting category" value={detail.reportingCategoryName ?? "-"} />
      {detail.modifierLists.length > 0 && (
        <SheetRow
          label="Modifier lists"
          value={
            <span className="inline-flex flex-wrap justify-end gap-1">
              {detail.modifierLists.map((list) => (
                <ModifierListPopover
                  key={list.id}
                  name={list.name}
                  options={list.options}
                  label={`Show the ${list.name} options`}
                />
              ))}
            </span>
          }
        />
      )}
      <SheetRow
        label="Stock tracking"
        value={
          <span className="inline-flex flex-col items-end">
            {detail.inventoryTrackingLocation ? "Counted at the venue" : "Not counted"}
            {itemDefault !== detail.inventoryTrackingLocation && (
              <span className="text-[11px] font-medium text-admin-muted">
                Venue setting overrides the item default ({itemDefault ? "counted" : "not counted"})
              </span>
            )}
          </span>
        }
      />
      <SheetRow label="Stock quantity" value={<span className="tabular-nums">{quantity}</span>} />
      <SheetRow
        label="Status"
        value={
          <span className="inline-flex items-center gap-1.5">
            {detail.status}
            <span className="h-1 w-1 rounded-full bg-admin-muted" aria-hidden="true" />
            <span className="font-medium text-admin-muted">{detail.statusExt}</span>
          </span>
        }
      />
      <SheetRow label="Synced at" value={formatStamp(detail.syncedAt)} />
      {detail.deletedAt && (
        <SheetRow label="Deleted at" value={`${formatStamp(detail.deletedAt)} - no longer in Square`} tone="error" />
      )}
    </>
  );
}

function GroupToggle({
  group,
  open,
  onToggle,
  className,
}: {
  group: DrinkGroup;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 bg-admin-surface text-left text-[11px] font-semibold tracking-wide text-admin-muted uppercase transition-colors hover:bg-admin-line/40 sm:min-h-8",
        className,
      )}
    >
      <ChevronDown
        className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", !open && "-rotate-90")}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">{group.name}</span>
      <span className="font-medium tracking-normal normal-case">
        {group.drinks.length} {group.drinks.length === 1 ? "drink" : "drinks"}
      </span>
    </button>
  );
}

function PriceInput({
  label,
  value,
  placeholder,
  disabled,
  onChange,
  className,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
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
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-10 w-full rounded-lg border border-admin-line bg-admin-card px-2 text-right text-sm font-semibold text-admin-ink tabular-nums outline-none placeholder:font-normal placeholder:text-admin-muted/50 focus:border-admin-primary disabled:opacity-60 [appearance:textfield] sm:h-9 sm:text-[13px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
    />
  );
}

const ROW_ICON_BUTTON =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9";

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
    defaults: defaultDrinkSettings(drink.overrides.openingPrice ?? drink.basePrice, config),
  };
}

function OverrideFields({
  drink,
  basePrice,
  config,
  mixer,
}: {
  drink: EventDrink | null;
  basePrice: number | null;
  config: MarketConfig;
  mixer: number | null;
}) {
  const isPrice = (key: OverrideField["key"]) => PRICE_KEYS.includes(key as PriceKey);
  const opening = drink?.overrides.openingPrice ?? basePrice;
  const [normalUnits, setNormalUnits] = useState(drink?.normalUnitsOverride?.toString() ?? "");
  const [keepNormals, setKeepNormals] = useState(drink?.normalUnitsOverride != null && drink.normalUnitsKeep);
  const defaults = opening != null ? defaultDrinkSettings(opening, config) : null;
  return (
    <>
      <DetailCard className="divide-y divide-admin-line/50">
        {drink && (
          <FormRow label="Display name" dense>
            <input
              type="text"
              name="display_name"
              maxLength={80}
              aria-label="Display name on this event"
              placeholder={drink.name}
              defaultValue={drink.displayName}
              className={FIELD_INPUT}
            />
          </FormRow>
        )}
        {OVERRIDE_FIELDS.map((field) => (
          <FormRow key={field.key} label={field.label} dense>
            <input
              type="number"
              name={field.name}
              min={field.min}
              step={field.step}
              aria-label={field.label}
              placeholder={
                defaults
                  ? `Event: ${field.format(isPrice(field.key) ? withMixer(defaults[field.key], mixer) : defaults[field.key])}`
                  : ""
              }
              defaultValue={
                isPrice(field.key)
                  ? shiftedOverride(drink?.overrides[field.key], mixer ?? 0)
                  : (drink?.overrides[field.key] ?? "")
              }
              className={FIELD_INPUT}
            />
          </FormRow>
        ))}
      </DetailCard>
      {drink && (
        <DetailCard className="divide-y divide-admin-line/50">
          <input type="hidden" name="normal_units_field" value="1" />
          <FormRow label="Normal / night override" dense>
            <input
              type="number"
              name="normal_units_per_night"
              min="0.1"
              step="0.1"
              aria-label="Normal units a night override"
              placeholder="auto"
              value={normalUnits}
              onChange={(event) => {
                setNormalUnits(event.target.value);
                if (event.target.value.trim() === "") setKeepNormals(false);
              }}
              className={FIELD_INPUT}
            />
          </FormRow>
          <FormRow label="Keep for future nights" dense>
            <SwitchField
              name="normal_units_keep"
              checked={keepNormals}
              onChange={setKeepNormals}
              disabled={normalUnits.trim() === ""}
              label="Keep the normal units override for future nights"
            />
          </FormRow>
        </DetailCard>
      )}
      <p className="px-1 text-[11px] text-admin-muted">
        Leave a field blank to use the event setting. Opening price defaults to
        the base price. A normal units override goes back to auto after the next
        market night unless Keep for future nights is ticked.{" "}
        {mixer != null &&
          `Prices here include the ${formatGbp(mixer)} mixer, as guests pay them; only the spirit part moves. `}
        Alert threshold is a fraction, so 0.05 alerts on a 5% move. Changes
        apply the next time this event is opened.
      </p>
    </>
  );
}

/* The spirit and the mixer that make up a with-mixer price. */
function SpiritPrice({ base, mixer }: { base: number | null; mixer: number | null }) {
  if (base == null || mixer == null) return null;
  return (
    <span className="block text-[11px] font-medium whitespace-nowrap text-admin-muted tabular-nums">
      {formatGbp(base)} + {formatGbp(mixer)} mixer
    </span>
  );
}

function UntrackedTag() {
  return (
    <span
      title="Square does not count this serve's stock. It never goes low or sold out on its own; mark it sold out on the trading floor."
      className="rounded-full bg-admin-surface px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-admin-muted"
    >
      Stock not tracked
    </span>
  );
}

function MixerTag() {
  return (
    <span className="rounded-full bg-admin-primary-soft px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-admin-primary">
      + mixer
    </span>
  );
}

function DrinkForm({
  eventId,
  drink,
  nightOnly,
  config,
  mixer,
  formError,
  onSubmit,
}: {
  eventId: number;
  drink: EventDrink | null;
  nightOnly: boolean;
  config: MarketConfig;
  mixer: number | null;
  formError: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  const [amount, setAmount] = useState(drink?.basePrice ?? null);
  const [servedWithMixer, setServedWithMixer] = useState(drink?.withMixer ?? false);
  return (
    <form
      id="event-drink-form"
      action={onSubmit}
      className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
    >
      <input type="hidden" name="event_id" value={eventId} />
      {drink && <input type="hidden" name="id" value={drink.menuItemId} />}
      {drink && <input type="hidden" name="menu_item_price_id" value={drink.id} />}
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
                defaultValue={drink?.menuPrice ?? ""}
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
      <DetailCard>
        <FormRow label="Served with a mixer" dense>
          <input type="hidden" name="with_mixer_field" value="1" />
          <SwitchField
            name="with_mixer"
            checked={servedWithMixer}
            onChange={setServedWithMixer}
            label="Always sold with a mixer"
          />
        </FormRow>
        <p className="px-4 py-2.5 text-[11px] text-admin-muted sm:px-5">
          Tick this for a spirit the till always rings with a mixer that Square does not already mark. Drinks that
          carry the mixer modifier chosen on{" "}
          <Link href="/settings/market/square-links" className="font-semibold text-admin-primary underline">
            Square links
          </Link>{" "}
          get it automatically at Square&rsquo;s price. A ticked drink adds {formatGbp(config.mixerPrice)} from the event
          settings. The board and phone page show spirit + mixer; only the spirit price moves.
        </p>
      </DetailCard>
      <h4 className="px-1 text-[12px] font-semibold text-admin-ink">
        Pricing on this event
      </h4>
      <OverrideFields drink={drink} basePrice={amount} config={config} mixer={mixer} />
      {formError && <ErrorBox message={formError} />}
    </form>
  );
}

function AddDrinksForm({
  available,
  mixerPrice,
  formError,
  onSubmit,
}: {
  available: AvailableDrink[];
  mixerPrice: number;
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
        name="menu_item_price_ids"
        value={JSON.stringify(selected)}
      />
      <ListSearchInput
        value={query}
        onChange={setQuery}
        label="Search the menu"
        placeholder="Search by drink or category"
      />
      <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-admin-muted">
        <span>{available.length} serves not yet on this event</span>
        <span className="tabular-nums">{selected.length} selected</span>
      </div>
      <DetailCard>
        {shown.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-admin-muted sm:px-5">
            {available.length === 0
              ? "Every priced serve on the menu is already on this event."
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
                  aria-label={`Add ${drink.name} (${drink.serve})`}
                  className="h-4 w-4 cursor-pointer accent-admin-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-admin-ink">
                    {drink.name}
                    <span className="font-medium text-admin-muted"> · {drink.serve}</span>
                    {serveMixerPrice(drink, mixerPrice) != null && (
                      <span className="font-medium text-admin-muted"> + mixer</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-admin-muted">
                    {drink.categoryName}
                    {!drink.linked && " · not linked to Square"}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[13px] text-admin-muted tabular-nums">
                  {formatGbp(withMixer(drink.basePrice, serveMixerPrice(drink, mixerPrice)))}
                  <SpiritPrice base={drink.basePrice} mixer={serveMixerPrice(drink, mixerPrice)} />
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

/* The event's own page: what it needs before it opens, the drinks on its
   board and the settings each one trades on. Live data and live actions -
   prices moving, crashes, stock overrides - belong to the trading floor on
   the Market page and never appear here. */
export default function EventDetailClient({
  event,
  drinks,
  available,
  sessions,
  isLive,
  anyLive,
  readiness,
  normalUnits,
  squareDetails,
  environment,
}: {
  event: StockMarketEventSummary;
  drinks: EventDrink[];
  available: AvailableDrink[];
  sessions: EventSession[];
  isLive: boolean;
  anyLive: boolean;
  readiness: EventReadiness;
  normalUnits: NormalUnitsView;
  squareDetails: Record<string, SquareVariationDetail>;
  environment: "sandbox" | "production";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { checkSalesSync, SalesSyncDialogUI } = useSalesSyncCheck();
  const [readingNormals, startReadingNormals] = useTransition();
  const [syncingSales, startSyncingSales] = useTransition();
  const [query, setQuery] = useState("");
  const [drinksOpen, setDrinksOpen] = useState(true);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, PriceDraft>>({});

  const drinkSheet = useRecordSheet<EventDrink>({
    records: drinks,
    getId: (drink) => drink.id,
  });
  const addSheet = useRecordSheet<AddPicker>();

  const needle = query.trim().toLowerCase();
  const shownDrinks = useMemo(
    () =>
      drinks.filter((drink) =>
        matches(needle, drink.displayName, drink.name, drink.categoryName, drink.serve),
      ),
    [drinks, needle],
  );
  const groups = useMemo(() => groupByCategory(shownDrinks), [shownDrinks]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const isGroupOpen = (name: string) => needle.length > 0 || !collapsed.has(name);
  const toggleGroup = (name: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const normalsById = useMemo(
    () => new Map(normalUnits.rows.map((row) => [row.menuItemPriceId, row])),
    [normalUnits.rows]
  );

  const mixerOf = (drink: EventDrink) => serveMixerPrice(drink, event.config.mixerPrice) ?? 0;

  const dirtyDrinks = drinks.filter((drink) => {
    const draft = priceDrafts[drink.id];
    return draft != null && !sameDraft(draft, draftFromOverrides(drink.overrides, mixerOf(drink)));
  });

  function draftFor(drink: EventDrink): PriceDraft {
    return priceDrafts[drink.id] ?? draftFromOverrides(drink.overrides, mixerOf(drink));
  }

  function setDraft(drink: EventDrink, key: PriceKey, value: string) {
    setPriceDrafts((prev) => ({
      ...prev,
      [drink.id]: { ...(prev[drink.id] ?? draftFromOverrides(drink.overrides, mixerOf(drink))), [key]: value },
    }));
  }

  function resetDraft(drink: EventDrink) {
    setPriceDrafts((prev) => ({ ...prev, [drink.id]: EMPTY_DRAFT }));
  }

  function handleSavePrices() {
    if (dirtyDrinks.length === 0) return;
    const rows = dirtyDrinks.map((drink) => {
      const draft = draftFor(drink);
      const spirit = Object.fromEntries(
        PRICE_KEYS.map((key) => [key, shiftPrice(draft[key], -mixerOf(drink))])
      ) as PriceDraft;
      return {
      menuItemPriceId: drink.id,
      overrides: {
        ...spirit,
        lowStockAt: drink.overrides.lowStockAt,
        alertThreshold: drink.overrides.alertThreshold,
      },
      };
    });
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

  async function handleOpen() {
    if (!(await checkSalesSync())) return;
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

  function handleReadNormals() {
    startReadingNormals(async () => {
      const result = await recalculateNormalUnitsAction(event.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const unmapped =
        result.unmappedServes > 0
          ? ` ${result.unmappedServes} serve(s) are not linked to Square and were skipped.`
          : "";
      if (result.serves === 0) {
        toast.warning(
          `No Square sales found for this event's drinks on the ${result.nights} night(s) sampled. Sync sales from Square, or check the Square links.${unmapped}`
        );
      } else {
        toast.success(`Worked out normal sales for ${result.serves} serve(s) over ${result.nights} night(s).${unmapped}`);
      }
      router.refresh();
    });
  }

  function handleSyncSales() {
    startSyncingSales(async () => {
      const result = await syncSquareSalesAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const message = salesSyncMessage(result);
      if (message.catalogFailed) toast.warning(message.text);
      else toast.success(message.text);
      if (normalUnits.weekdays.length > 0) handleReadNormals();
      else router.refresh();
    });
  }

  function handleRemove() {
    const drink = drinkSheet.selected;
    if (!drink) return;
    drinkSheet.confirmDelete({
      title: "Remove drink from event",
      description: drink.nightOnly
        ? `"${drink.name}" is a tonight-only drink and will be deleted.`
        : `"${drink.name} · ${drink.serve}" comes off this event. It stays on the menu.`,
      confirmLabel: "Remove",
      action: async () => {
        const result = await removeEventDrinkAction(event.id, drink.id);
        if (!result.error) router.refresh();
        return result;
      },
    });
  }

  const submitDrink = drinkSheet.submit(async (formData) => {
    const mixer = drinkSheet.mode === "edit" ? (selectedMixer ?? 0) : 0;
    for (const name of PRICE_FIELD_NAMES) {
      const value = formData.get(name)?.toString();
      if (value != null) formData.set(name, shiftPrice(value, -mixer));
    }
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
      ids = JSON.parse(formData.get("menu_item_price_ids")?.toString() || "[]");
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
        ? "Edit Drink"
        : "View Drink";
  const selectedMixer = selectedDrink ? serveMixerPrice(selectedDrink, event.config.mixerPrice) : null;
  const selectedSquare = selectedDrink?.squareVariationId ? squareDetails[selectedDrink.squareVariationId] : undefined;
  const [sectionOpen, setSectionOpen] = useState({ menu: true, history: true, square: true, pricing: true });
  const toggleSection = (key: keyof typeof sectionOpen) =>
    setSectionOpen((current) => ({ ...current, [key]: !current[key] }));
  const selectedSettings = selectedDrink
    ? drinkSettings(selectedDrink, event.config)
    : null;
  const liveSession = sessions.find((session) => session.status === "live") ?? null;

  return (
    <div className="w-full space-y-4 px-2 py-3 sm:px-4 sm:py-0 md:px-6">
      {SalesSyncDialogUI}
      <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="hidden text-base leading-tight font-bold text-admin-ink sm:block">
                {event.name}
              </h2>
              <StatusPill
                tone={isLive ? "success" : readiness.ready ? "success" : "warning"}
                showLabelOnMobile
              >
                {isLive ? "Live now" : readiness.ready ? "Ready to open" : "Needs setup"}
              </StatusPill>
            </div>
            <p className="mt-1.5 text-[13px] text-admin-muted">
              {formatTimeWindow(event.openTime, event.closeTime)} · {drinks.length}{" "}
              {drinks.length === 1 ? "drink" : "drinks"}
              {isLive ? " trading" : ""}
            </p>
            <p className="mt-0.5 text-[13px] text-admin-muted">
              {isLive
                ? `Opened ${formatStamp(liveSession?.startedAt ?? null)} · live prices and crashes are on the trading floor`
                : event.lastRunAt
                  ? `Last run ${formatStamp(event.lastRunAt)}`
                  : "Never run"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full [&_a]:max-sm:flex-1 [&_button]:max-sm:flex-1">
            {isLive && (
              <Link href="/settings/market" className={cn(OUTLINE_BUTTON, "whitespace-nowrap")}>
                <CandlestickChart className="h-4 w-4" aria-hidden="true" />
                Trading floor
              </Link>
            )}
            <MarketNightsMenu sessions={sessions} />
          </div>
        </div>

        {!isLive && (
          <ReadyToOpenChecklist
            readiness={readiness}
            eventId={event.id}
            anyLive={anyLive}
            isPending={isPending}
            readingNormals={readingNormals}
            syncingSales={syncingSales}
            salesSyncedAt={normalUnits.salesSyncedAt}
            canReadNormals={normalUnits.weekdays.length > 0}
            onOpen={handleOpen}
            onAddDrinks={addSheet.openAdd}
            onReadNormals={handleReadNormals}
            onSyncSales={handleSyncSales}
          />
        )}
      </section>

      <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <div className={cn("flex flex-wrap items-center justify-between gap-3", drinksOpen && "mb-3")}>
          <button
            type="button"
            onClick={() => setDrinksOpen((open) => !open)}
            aria-expanded={drinksOpen}
            className="flex min-h-11 items-center gap-2 text-left"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200",
                !drinksOpen && "-rotate-90"
              )}
              aria-hidden="true"
            />
            <h3 className="text-sm font-bold text-admin-ink">
              Drinks on the board{" "}
              <span className="font-medium text-admin-muted">
                ({shownDrinks.length})
              </span>
            </h3>
          </button>
          {drinksOpen && (
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
                className={cn(dirtyDrinks.length > 0 ? PRIMARY_BUTTON : OUTLINE_BUTTON, "whitespace-nowrap max-sm:w-full")}
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
          )}
        </div>
        {drinksOpen && (
        <>
        <div className="mb-3">
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search drinks on the board"
            placeholder="Search by drink, category or serve"
          />
        </div>
        {drinks.length > 0 && (
          <p className="mb-3 text-[11px] text-admin-muted">
            {isLive
              ? "Prices are locked while the market is live. Drinks added, removed or repriced now trade from the next time this event is opened."
              : "Set the opening, min, max and crash prices per drink, then Save prices. An empty box uses the event default shown in grey."}
          </p>
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
                  <GroupToggle
                    group={group}
                    open={isGroupOpen(group.name)}
                    onToggle={() => toggleGroup(group.name)}
                    className="mb-1 rounded-lg px-2.5"
                  />
                  {isGroupOpen(group.name) && (
                  <ul className="m-0 list-none divide-y divide-admin-line/60 p-0">
                    {group.drinks.map((drink) => {
                      const settings = drinkSettings(drink, event.config);
                      const draft = draftFor(drink);
                      const normals = normalsById.get(drink.id);
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
                                {drink.displayName}
                                {drink.displayName !== drink.name && (
                                  <span className="ml-1.5 text-[11px] font-medium text-admin-muted">{drink.name}</span>
                                )}
                                {!drink.isActive && (
                                  <span className="ml-1.5 text-[11px] font-medium text-admin-muted">(inactive)</span>
                                )}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-admin-muted">
                                <span>{drink.serve}</span>
                                {serveMixerPrice(drink, event.config.mixerPrice) != null && <MixerTag />}
                                {drink.stockTracked === false && <UntrackedTag />}
                                {drink.linked ? (
                                  <span className="rounded-full bg-admin-success-bg px-1.5 py-0.5 font-semibold text-admin-success">
                                    Square linked
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-admin-surface px-1.5 py-0.5 font-semibold">
                                    Not linked
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="shrink-0 text-right tabular-nums">
                              <span className="block text-sm font-semibold text-admin-ink">
                                {drink.basePrice != null ? formatGbp(withMixer(drink.basePrice, mixerOf(drink))) : "-"}
                              </span>
                              <span className="block text-[11px] text-admin-muted">base</span>
                              <SpiritPrice base={drink.basePrice} mixer={serveMixerPrice(drink, event.config.mixerPrice)} />
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-admin-muted opacity-40" aria-hidden="true" />
                          </div>
                          {settings && (
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
                                      placeholder={withMixer(settings.defaults[key], mixerOf(drink)).toFixed(2)}
                                      disabled={isPending || isLive}
                                      onChange={(value) => setDraft(drink, key, value)}
                                    />
                                  </label>
                                ))}
                              </div>
                              {normals && (
                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <span className="min-w-0 text-[11px] text-admin-muted">
                                    <span className="mb-0.5 block text-[10px] font-semibold">Normal per night</span>
                                    <NormalUnitsCell row={normals} weekdays={normalUnits.weekdays} />
                                  </span>
                                  <div className="flex shrink-0 items-end gap-3">
                                    <label className="block">
                                      <span className="mb-0.5 block text-right text-[10px] font-semibold text-admin-muted">
                                        Normal override
                                      </span>
                                      <NormalUnitsOverrideInput
                                        key={normals.override ?? "auto"}
                                        eventId={event.id}
                                        row={normals}
                                        className="h-11"
                                      />
                                    </label>
                                    {normals.override != null && (
                                      <div onClick={(e) => e.stopPropagation()}>
                                        <span className="mb-0.5 block text-[10px] font-semibold text-admin-muted">Keep</span>
                                        <NormalUnitsKeepSwitch
                                          key={`${normals.override}-${normals.keep}`}
                                          eventId={event.id}
                                          row={normals}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {!isLive && hasDraftValue(draft) && (
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
                        </li>
                      );
                    })}
                  </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-160 text-left">
                <thead>
                  <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                    <th className="py-2 pr-3">Drink</th>
                    <th className="py-2 pr-3">Serve</th>
                    <th
                      className="py-2 pr-3 text-right"
                      title="Average units sold per night on the event's weekday(s), worked out from Square sales, with nights sampled"
                    >
                      Normal / night
                    </th>
                    <th
                      className="py-2 pr-3 text-center"
                      title="Replaces the normal units a night worked out from Square history; blank uses history"
                    >
                      Normal override
                    </th>
                    <th
                      className="py-2 pr-3 text-center"
                      title="Keep the normal override for future market nights; otherwise it goes back to auto after the next one"
                    >
                      Keep
                    </th>
                    <th className="py-2 pr-3 text-right">Base</th>
                    <th className="py-2 pr-3 text-center">Opening</th>
                    <th className="py-2 pr-3 text-center">Min</th>
                    <th className="py-2 pr-3 text-center">Max</th>
                    <th className="py-2 pr-3 text-center">Crash</th>
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
                        <td colSpan={12} className="p-0">
                          <GroupToggle
                            group={group}
                            open={isGroupOpen(group.name)}
                            onToggle={() => toggleGroup(group.name)}
                            className="px-2"
                          />
                        </td>
                      </tr>
                      {isGroupOpen(group.name) && group.drinks.map((drink) => {
                        const settings = drinkSettings(drink, event.config);
                        const draft = draftFor(drink);
                        const normals = normalsById.get(drink.id);
                        return (
                          <tr
                            key={drink.id}
                            onClick={() => drinkSheet.openView(drink)}
                            className="cursor-pointer border-b border-admin-line/60 hover:bg-admin-surface/60"
                          >
                            <td className="py-1.5 pr-3 text-[13px] font-semibold text-admin-ink">
                              {drink.displayName}
                              {drink.displayName !== drink.name && (
                                <span className="block text-[11px] font-medium text-admin-muted">{drink.name}</span>
                              )}
                              {!drink.isActive && (
                                <span className="ml-1.5 text-[11px] font-medium text-admin-muted">(inactive)</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-[13px] text-admin-muted">
                              <span className="flex flex-wrap items-center gap-1.5">
                                {drink.serve}
                                {serveMixerPrice(drink, event.config.mixerPrice) != null && <MixerTag />}
                              </span>
                            </td>
                            <td className="py-1.5 pr-3 text-right text-[13px]">
                              {normals ? (
                                <NormalUnitsCell
                                  row={normals}
                                  weekdays={normalUnits.weekdays}
                                  className="items-end"
                                />
                              ) : (
                                <span className="text-admin-muted">-</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {normals && (
                                <NormalUnitsOverrideInput
                                  key={normals.override ?? "auto"}
                                  eventId={event.id}
                                  row={normals}
                                  className="mx-auto"
                                />
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {normals && (
                                <NormalUnitsKeepSwitch
                                  key={`${normals.override ?? "auto"}-${normals.keep}`}
                                  eventId={event.id}
                                  row={normals}
                                  className="mx-auto justify-center"
                                />
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-[13px] text-admin-ink tabular-nums">
                              {drink.basePrice != null ? formatGbp(withMixer(drink.basePrice, mixerOf(drink))) : "-"}
                              <SpiritPrice base={drink.basePrice} mixer={serveMixerPrice(drink, event.config.mixerPrice)} />
                            </td>
                            {settings ? (
                              PRICE_KEYS.map((key) => (
                                <td key={key} className="py-1.5 pr-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <PriceInput
                                    label={`${PRICE_LABELS[key]} price for ${drink.name}`}
                                    value={draft[key]}
                                    placeholder={withMixer(settings.defaults[key], mixerOf(drink)).toFixed(2)}
                                    disabled={isPending || isLive}
                                    onChange={(value) => setDraft(drink, key, value)}
                                    className="mx-auto w-20"
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
                              {drink.stockTracked === false && (
                                <span className="mt-1 block">
                                  <UntrackedTag />
                                </span>
                              )}
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
        </>
        )}
      </section>

      <RecordSheet
        open={drinkSheet.open}
        onClose={drinkSheet.close}
        mode={drinkMode}
        size={drinkShowForm ? "default" : "wide"}
        navigate={drinkSheet.navigateAcross(shownDrinks)}
        title={drinkTitle}
        systemInfo={
          selectedDrink
            ? {
                createdAt: selectedDrink.audit.createdAt,
                createdBy: selectedDrink.audit.createdBy,
                updatedAt: selectedDrink.audit.updatedAt,
                updatedBy: selectedDrink.audit.updatedBy,
                rows: [
                  { label: "Menu item ID", value: selectedDrink.menuItemId },
                  { label: "Event ID", value: event.id },
                  { label: "Square variation ID", value: selectedDrink.squareVariationId ?? "-" },
                ],
              }
            : undefined
        }
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
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start">
              <div className="space-y-4 sm:space-y-5">
              <SheetSection title="Menu item" open={sectionOpen.menu} onToggle={() => toggleSection("menu")}>
                <SheetRow label="Name" value={selectedDrink.name} />
                <SheetRow
                  label="Category"
                  value={selectedDrink.categoryName}
                />
                <SheetRow
                  label="Serve"
                  value={
                    serveMixerPrice(selectedDrink, event.config.mixerPrice) != null
                      ? `${selectedDrink.serve} + mixer`
                      : selectedDrink.serve
                  }
                />
                <SheetRow
                  label="Price"
                  value={
                    selectedDrink.menuPrice == null ? (
                      "-"
                    ) : (
                      <span className="tabular-nums">
                        {formatGbp(selectedDrink.menuPrice)}
                        <span className="ml-1.5 text-[11px] font-medium text-admin-muted">(menu)</span>
                      </span>
                    )
                  }
                />
                <SheetRow
                  label="Base price"
                  value={
                    selectedDrink.basePrice == null ? (
                      "-"
                    ) : (
                      <span className="tabular-nums">
                        {formatGbp(withMixer(selectedDrink.basePrice, selectedMixer))}
                        <span className="ml-1.5 text-[11px] font-medium text-admin-muted">
                          {selectedMixer != null
                            ? `(${formatGbp(selectedDrink.basePrice)}${selectedDrink.basePriceFromSquare ? " from Square" : " menu"} + ${formatGbp(selectedMixer)} mixer${selectedDrink.squareMixerPrice != null ? " from Square" : ""})`
                            : selectedDrink.basePriceFromSquare
                              ? "(from Square)"
                              : "(menu)"}
                        </span>
                      </span>
                    )
                  }
                />
                <SheetRow
                  label="Square"
                  value={
                    selectedDrink.linked ? (
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
                          <span className="inline-flex items-center gap-1 text-admin-success">
                            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Linked
                          </span>
                          {selectedDrink.squareVariationId &&
                            (selectedSquare ? (
                              <SquareLink href={squareItemUrl(environment, selectedSquare.itemId)}>
                                {selectedDrink.squareVariationId}
                              </SquareLink>
                            ) : (
                              <span className="font-mono text-[11px] font-normal break-all text-admin-muted">
                                {selectedDrink.squareVariationId}
                              </span>
                            ))}
                        </span>
                        {selectedDrink.stockTracked === false && (
                          <span className="text-[11px] font-normal text-admin-muted">
                            Stock not tracked in Square - mark it sold out on the trading floor when it runs out.
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-admin-error">
                        <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
                        Not linked
                      </span>
                    )
                  }
                />
              </SheetSection>
              <SheetSection title="Square history" open={sectionOpen.history} onToggle={() => toggleSection("history")}>
                <SquareHistoryRows
                  key={selectedDrink.id}
                  variationId={selectedDrink.squareVariationId}
                  normals={normalsById.get(selectedDrink.id)}
                  weekdays={normalUnits.weekdays}
                />
              </SheetSection>
              </div>
              {selectedDrink.squareVariationId && (
                <SheetSection title="Square item" open={sectionOpen.square} onToggle={() => toggleSection("square")}>
                  {selectedSquare ? (
                    <SquareItemRows detail={selectedSquare} environment={environment} />
                  ) : (
                    <p className="px-4 py-3 text-[12px] text-admin-muted sm:px-5">
                      This variation is not in the copy of the Square catalog yet. Refresh the catalog on Square links
                      to see it here.
                    </p>
                  )}
                </SheetSection>
              )}
            </div>
            <SheetSection
              title="Pricing on this event"
              open={sectionOpen.pricing}
              onToggle={() => toggleSection("pricing")}
            >
                <SheetRow
                label="Display name"
                value={
                  <span>
                    {selectedDrink.displayName}
                    {selectedDrink.displayName === selectedDrink.name && (
                      <span className="ml-1.5 text-[11px] font-medium text-admin-muted">(menu name)</span>
                    )}
                  </span>
                }
              />
              {OVERRIDE_FIELDS.map((field) => {
                  const overridden = selectedDrink.overrides[field.key] != null;
                  return (
                    <SheetRow
                      key={field.key}
                      label={field.label}
                      value={
                        selectedSettings ? (
                          <span className="tabular-nums">
                            {field.format(
                              PRICE_KEYS.includes(field.key as PriceKey)
                                ? withMixer(selectedSettings.effective[field.key], selectedMixer)
                                : selectedSettings.effective[field.key]
                            )}
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
              <SheetRow
                label="Normal / night override"
                value={
                  selectedDrink.normalUnitsOverride != null ? (
                    <span className="tabular-nums">{selectedDrink.normalUnitsOverride} a night</span>
                  ) : (
                    <span className="font-medium text-admin-muted">Auto (Square history)</span>
                  )
                }
              />
              <SheetRow
                label="Keep for future nights"
                value={
                  <span className="inline-flex items-center gap-2">
                    {selectedDrink.normalUnitsOverride != null && !selectedDrink.normalUnitsKeep && (
                      <span className="text-[11px] font-medium text-admin-muted">
                        Back to auto after the next market night
                      </span>
                    )}
                    <SwitchDisplay
                      on={selectedDrink.normalUnitsOverride != null && selectedDrink.normalUnitsKeep}
                      disabled={selectedDrink.normalUnitsOverride == null}
                      label="Keep for future nights"
                    />
                  </span>
                }
              />
            </SheetSection>
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
            mixer={drinkMode === "edit" ? selectedMixer : null}
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
            mixerPrice={event.config.mixerPrice}
            formError={addSheet.formError}
            onSubmit={submitAddDrinks}
          />
        )}
      </RecordSheet>
    </div>
  );
}
