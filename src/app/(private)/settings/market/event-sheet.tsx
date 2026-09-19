"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, PowerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DetailCard, ErrorBox, FormRow, RecordSheet, StatusPill, type useRecordSheet } from "@/components/admin";
import { formatGbp } from "@/lib/price";
import { DEFAULT_MARKET_CONFIG, type MarketConfig } from "@/lib/market/types";
import { formatTimeWindow, type StockMarketEventSummary } from "@/lib/market/stock-market-events";
import { WEEKDAY_NAMES } from "@/lib/market/normal-units";
import { groupServesForPicker, serveLabel, type ServeOption } from "@/lib/market/event-serves";
import type { EventReadiness } from "@/lib/market/event-readiness";
import {
  CONFIG_FIELDS,
  ConfigHelp,
  PRICING_MODES,
  PUSH_ALERTS_FIELD,
  TIER_BANDS,
  TIER_FIELDS,
  TIER_PCT_FIELDS,
  configSummary,
} from "./config-fields";
import { StepMark, drinksStepText, linksStepText, normalsStepText } from "./readiness-ui";
import type { EmployeeOption } from "./types";
import { FIELD_INPUT, formatRunDate } from "./ui";

/* Every settings value sits in the same fixed column, with the browser's
   number spinners hidden so the digits line up down the card. */
const CONFIG_VALUE =
  "w-20 flex-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function WeekdayPicker({ selected }: { selected: number[] }) {
  const [days, setDays] = useState<number[]>(selected);
  function toggle(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }
  return (
    <span className="flex flex-1 flex-wrap justify-end gap-1.5">
      {days.map((day) => (
        <input key={day} type="hidden" name="weekdays" value={day} />
      ))}
      {WEEKDAY_NAMES.map((name, day) => {
        const on = days.includes(day);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            aria-label={name}
            onClick={() => toggle(day)}
            className={cn(
              "h-9 min-w-11 rounded-full border px-3 text-[12px] font-semibold transition-colors sm:h-8",
              on
                ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
                : "border-admin-line text-admin-muted hover:bg-admin-surface"
            )}
          >
            {name.slice(0, 3)}
          </button>
        );
      })}
    </span>
  );
}

function TierPctInputs({ field, values }: { field: { key: string; label: string; help: string }; values: number[] }) {
  return (
    <span className="flex flex-1 items-center justify-end gap-1.5">
      {TIER_BANDS.map((band, index) => (
        <label key={band} className="flex items-center gap-1 text-[11px] font-semibold text-admin-muted">
          <span className="sr-only">{`${field.label} ranks ${band}`}</span>
          <span aria-hidden="true">{band}</span>
          <input
            type="number"
            name={`${field.key}${index}`}
            aria-label={`${field.label} ranks ${band}`}
            defaultValue={Math.round((values[index] ?? 0) * 100)}
            step="1"
            min="0"
            max="90"
            required
            className={cn(FIELD_INPUT, "w-12 flex-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
          />
        </label>
      ))}
    </span>
  );
}

function ConfigFormRows({ config }: { config: MarketConfig }) {
  const [mode, setMode] = useState<MarketConfig["pricingMode"]>(config.pricingMode);
  const numberFields = CONFIG_FIELDS.filter((field) => mode === "demand" || field.key !== "noiseSigma");
  return (
    <TooltipProvider>
      <FormRow label="Pricing" align="start" dense>
        <input type="hidden" name="pricingMode" value={mode} />
        <span className="flex flex-1 flex-col items-end gap-1.5">
          <span className="inline-flex rounded-lg border border-admin-line p-0.5" role="radiogroup" aria-label="Pricing mode">
            {PRICING_MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  "h-9 rounded-md px-3 text-[12px] font-semibold transition-colors sm:h-8",
                  mode === option.value ? "bg-admin-primary-soft text-admin-primary" : "text-admin-muted hover:bg-admin-surface"
                )}
              >
                {option.label}
              </button>
            ))}
          </span>
          <span className="text-[11px] text-admin-muted">{PRICING_MODES.find((o) => o.value === mode)?.hint}</span>
        </span>
      </FormRow>
      {mode === "tiers" && (
        <>
          {TIER_FIELDS.map((field) => (
            <FormRow key={field.key} label={field.label} dense>
              <ConfigHelp field={field} />
              <span className="flex flex-1 justify-end">
                <input
                  type="number"
                  name={field.key}
                  aria-label={field.label}
                  defaultValue={config[field.key]}
                  step={field.step}
                  min="0"
                  required
                  className={cn(FIELD_INPUT, CONFIG_VALUE)}
                />
              </span>
            </FormRow>
          ))}
          <FormRow label={TIER_PCT_FIELDS.up.label} dense>
            <ConfigHelp field={{ ...TIER_PCT_FIELDS.up, hint: "Ranks 1–5, 6–10, 11–15 from the top" }} />
            <TierPctInputs field={TIER_PCT_FIELDS.up} values={config.tierPcts.up} />
          </FormRow>
          <FormRow label={TIER_PCT_FIELDS.down.label} dense>
            <ConfigHelp field={{ ...TIER_PCT_FIELDS.down, hint: "Ranks 1–5, 6–10, 11–15 from the bottom" }} />
            <TierPctInputs field={TIER_PCT_FIELDS.down} values={config.tierPcts.down} />
          </FormRow>
          <Link
            href="/settings/market/how-it-works"
            className="flex min-h-11 items-center gap-1 text-[12px] font-semibold text-admin-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            How these dials set a price
          </Link>
        </>
      )}
      {mode === "tiers" && <input type="hidden" name="noiseSigma" value={config.noiseSigma} />}
      {numberFields.map((field) => (
        <FormRow key={field.key} label={field.label} dense>
          <ConfigHelp field={field} />
          <span className="flex flex-1 justify-end">
            <input
              type="number"
              name={field.key}
              aria-label={field.label}
              defaultValue={config[field.key]}
              step={field.step}
              min="0"
              required
              className={cn(FIELD_INPUT, CONFIG_VALUE)}
            />
          </span>
        </FormRow>
      ))}
      <FormRow label={PUSH_ALERTS_FIELD.label} dense>
        <ConfigHelp field={PUSH_ALERTS_FIELD} />
        <span className="flex flex-1 justify-end">
          <span className={cn(CONFIG_VALUE, "flex justify-end")}>
            <input
              type="checkbox"
              name="pushAlertsEnabled"
              aria-label={PUSH_ALERTS_FIELD.label}
              defaultChecked={config.pushAlertsEnabled}
              className="h-4 w-4 cursor-pointer accent-admin-primary"
            />
          </span>
        </span>
      </FormRow>
    </TooltipProvider>
  );
}

/* Each serve is its own checkbox: "Guinness · pint" and "Guinness · half"
   are different instruments with different Square links. */
function DrinkPicker({
  drinks,
  selected,
  onChange,
}: {
  drinks: ServeOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const groups = useMemo(() => groupServesForPicker(drinks), [drinks]);

  const selectedSet = new Set(selected);

  function toggleServe(id: number) {
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
        const ids = group.items.flatMap((item) => item.serves.map((serve) => serve.id));
        const onCount = ids.filter((id) => selectedSet.has(id)).length;
        const allOn = onCount === ids.length;
        return (
          <details key={group.id} className="group/cat">
            {/* The group checkbox lives in the summary but must not toggle it:
                its clicks stop before they reach the summary. */}
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-admin-bg px-4 py-1 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
              <label
                className="flex min-h-9 cursor-pointer items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={() => toggleGroup(ids, allOn)}
                  aria-label={`Select all ${group.name}`}
                  className="h-4 w-4 cursor-pointer accent-admin-primary"
                />
                <span className="text-[13px] font-bold text-admin-ink sm:text-sm">{group.name}</span>
              </label>
              <span className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-admin-muted tabular-nums">
                  {onCount}/{ids.length}
                </span>
                <ChevronDown
                  className="h-4 w-4 text-admin-muted transition-transform duration-200 group-open/cat:rotate-180"
                  aria-hidden="true"
                />
              </span>
            </summary>
            <div className="grid grid-cols-1 gap-x-4 bg-admin-card px-4 py-2 sm:grid-cols-2 sm:px-5">
              {group.items.flatMap((item) =>
                item.serves.map((serve) => (
                  <label
                    key={serve.id}
                    className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-admin-ink"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(serve.id)}
                      onChange={() => toggleServe(serve.id)}
                      aria-label={`Trade ${serveLabel(serve.name, serve.serve)}`}
                      className="h-4 w-4 cursor-pointer accent-admin-primary"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                      {item.serves.length > 1 || serve.serve.toLowerCase() !== "each" ? (
                        <span className="text-admin-muted"> · {serve.serve}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[11px] text-admin-muted tabular-nums">
                      {formatGbp(serve.amount)}
                      {!serve.linked && " · not linked"}
                    </span>
                  </label>
                ))
              )}
            </div>
          </details>
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
  drinks: ServeOption[];
  live: boolean;
  formError: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  const [selectedDrinks, setSelectedDrinks] = useState<number[]>(event?.menuItemPriceIds ?? []);
  const config = event?.config ?? DEFAULT_MARKET_CONFIG;

  return (
    <form
      id="stock-market-event-form"
      action={onSubmit}
      className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
    >
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="menu_item_price_ids" value={JSON.stringify(selectedDrinks)} />

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
        <FormRow label="Hours" required dense>
          <span className="flex flex-1 items-center justify-end gap-2">
            <input
              type="time"
              name="open_time"
              required
              aria-label="Opening time"
              defaultValue={event?.openTime || "19:00"}
              className={cn(FIELD_INPUT, "w-24 flex-none")}
            />
            <span className="text-[11px] font-semibold text-admin-muted">to</span>
            <input
              type="time"
              name="close_time"
              required
              aria-label="Closing time"
              defaultValue={event?.closeTime || "23:30"}
              className={cn(FIELD_INPUT, "w-24 flex-none")}
            />
          </span>
        </FormRow>
        <FormRow label="Runs on" align="start" dense>
          <WeekdayPicker selected={event?.weekdays ?? []} />
        </FormRow>
        <FormRow label="Bank holiday eve" dense>
          <select
            name="bank_holiday_profile"
            aria-label="Weekday profile to use on the eve of a bank holiday"
            defaultValue={event?.bankHolidayProfile ?? "6"}
            className={cn(FIELD_INPUT, "w-40 flex-none appearance-none")}
          >
            <option value="">Same as the actual day</option>
            {WEEKDAY_NAMES.map((name, index) => (
              <option key={name} value={index}>
                Trades like a {name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Skip market nights" dense>
          <span className="flex flex-1 items-center justify-end">
            <input type="hidden" name="exclude_market_nights" value="off" />
            <input
              type="checkbox"
              name="exclude_market_nights"
              value="on"
              aria-label="Leave previous market nights out of the sales history"
              defaultChecked={event?.excludeMarketNights ?? true}
              className="h-4 w-4 cursor-pointer accent-admin-primary"
            />
          </span>
        </FormRow>
        <p className="px-4 py-2.5 text-[11px] text-admin-muted sm:px-5">
          Each drink&rsquo;s &ldquo;normal&rdquo; is the average of its last six nights on that weekday over the last 12 weeks,
          from Square sales synced every night. A night runs from 6am to 6am, so sales after midnight count for the night
          before. Bank holidays and their eves are left out.
        </p>
      </DetailCard>

      {/* The seven tuning numbers are rarely touched, so they start folded
          behind a one-line summary of what they currently say. */}
      <DetailCard>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wide text-admin-muted">
                Market settings
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-admin-ink group-open:hidden">
                {configSummary(config)}
              </span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="divide-y divide-admin-line/50 border-t border-admin-line">
            <ConfigFormRows config={config} />
          </div>
          {live && (
            <p className="border-t border-admin-line px-4 py-2.5 text-[11px] text-admin-muted sm:px-5">
              The market is live now. These changes apply the next time it opens.
            </p>
          )}
        </details>
      </DetailCard>

      <DetailCard>
        <details open className="group/drinks">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-admin-surface px-4 py-2.5 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="text-[11px] font-semibold tracking-wide text-admin-muted sm:text-xs">Drinks on the board</span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-admin-muted tabular-nums">
                {selectedDrinks.length} selected
              </span>
              <ChevronDown
                className="h-4 w-4 text-admin-muted transition-transform duration-200 group-open/drinks:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>
          <div className="border-t border-admin-line">
            <DrinkPicker drinks={drinks} selected={selectedDrinks} onChange={setSelectedDrinks} />
          </div>
        </details>
      </DetailCard>

      {formError && <ErrorBox message={formError} />}
    </form>
  );
}

/* The seven raw config numbers, read as a person would say them. */
function settingTiles(config: MarketConfig): { label: string; value: string }[] {
  return [
    {
      label: "Pricing",
      value: PRICING_MODES.find((option) => option.value === config.pricingMode)?.label ?? config.pricingMode,
    },
    { label: "Prices move", value: `every ${config.tickIntervalSec}s` },
    { label: "Volatility", value: String(config.noiseSigma) },
    { label: "Price range", value: `${config.floorPct}× to ${config.ceilPct}× base` },
    { label: "Alert on a move of", value: `${Math.round(config.moveNotifyPct * 100)}%` },
    { label: "Low stock at", value: `${config.lowStockThreshold} left` },
    { label: "Leaderboard shows", value: config.leaderboardRows > 0 ? `top ${config.leaderboardRows}` : "as many as fit" },
    { label: "Phone alerts", value: config.pushAlertsEnabled ? "On" : "Off" },
  ];
}

type EventSheet = ReturnType<typeof useRecordSheet<StockMarketEventSummary>>;

/* Create an event, or read and edit its settings. Everything about the
   drinks themselves - prices, Square links, normal sales - lives on the
   event's own page, which the footer leads to. */
export function EventRecordSheet({
  sheet,
  order,
  drinks,
  employees,
  liveEventId,
  readiness,
  onClose,
  onSubmit,
  onDeactivate,
}: {
  sheet: EventSheet;
  // The events as the list beside the sheet shows them, for the step arrows.
  order: StockMarketEventSummary[];
  drinks: ServeOption[];
  employees: EmployeeOption[];
  liveEventId: number | null;
  readiness: EventReadiness | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  onDeactivate: () => void;
}) {
  const { selected, mode } = sheet;
  const showForm = mode === "add" || mode === "edit";
  const selectedIsLive = selected != null && selected.id === liveEventId;
  const title = mode === "add" ? "New stock market event" : mode === "edit" ? "Edit event" : "View event";

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  const steps =
    readiness == null
      ? []
      : [
          { key: "drinks", label: "Drinks", step: readiness.steps.drinks, text: drinksStepText(readiness) },
          { key: "links", label: "Square links", step: readiness.steps.links, text: linksStepText(readiness) },
          { key: "normals", label: "Normal sales", step: readiness.steps.normals, text: normalsStepText(readiness) },
        ];

  return (
    <RecordSheet
      open={sheet.open}
      onClose={onClose}
      mode={mode}
      navigate={sheet.navigateAcross(order)}
      title={title}
      recordId={selected?.id}
      formId="stock-market-event-form"
      isPending={sheet.isPending}
      onEdit={sheet.startEdit}
      onCancel={mode === "add" || !selected ? onClose : () => sheet.openView(selected)}
      confirmUI={sheet.ConfirmDialogUI}
      openHref={
        selected
          ? {
              href: `/settings/market/${selected.id}`,
              label: selectedIsLive ? "Drinks and prices" : readiness?.ready ? "Drinks and open" : "Set up and open",
            }
          : undefined
      }
      status={
        selected && (
          <StatusPill
            tone={selectedIsLive ? "success" : readiness?.ready ? "success" : "warning"}
            showLabelOnMobile
          >
            {selectedIsLive ? "Live now" : readiness?.ready ? "Ready to open" : "Needs setup"}
          </StatusPill>
        )
      }
      actions={
        mode === "view" && selected && !selectedIsLive
          ? [
              {
                label: "Deactivate",
                icon: <PowerOff className="h-4 w-4" />,
                onSelect: onDeactivate,
                disabled: sheet.isPending,
                destructive: true,
              },
            ]
          : undefined
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
          <DetailCard className="p-4 sm:p-5">
            <p className="text-lg leading-tight font-bold text-admin-ink sm:text-xl">{selected.name}</p>
            <p className="mt-1.5 text-[13px] text-admin-muted sm:text-sm">
              {formatTimeWindow(selected.openTime, selected.closeTime)}
              {selected.weekdays.length > 0 &&
                ` · ${selected.weekdays.map((day) => WEEKDAY_NAMES[day].slice(0, 3)).join(", ")}`}
            </p>
            <p className="mt-0.5 text-[13px] text-admin-muted sm:text-sm">
              {selected.lastRunAt ? `Last run ${formatRunDate(selected.lastRunAt)}` : "Never run"}
            </p>
          </DetailCard>

          {steps.length > 0 && (
            <DetailCard>
              <p className="border-b border-admin-line bg-admin-surface px-4 py-2.5 text-[11px] font-semibold tracking-wide text-admin-muted sm:px-5 sm:text-xs">
                Ready to open
              </p>
              <ul className="m-0 list-none divide-y divide-admin-line/50 p-0">
                {steps.map((row) => (
                  <li key={row.key} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <StepMark step={row.step} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-admin-ink">{row.label}</span>
                      <span className="block text-[11px] text-admin-muted">{row.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </DetailCard>
          )}

          <DetailCard className="p-4 sm:p-5">
            <p className="mb-3 text-[11px] font-semibold tracking-wide text-admin-muted sm:text-xs">Settings</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 sm:gap-y-4">
              {settingTiles(selected.config).map((tile) => (
                <div key={tile.label} className="min-w-0">
                  <dt className="text-[11px] text-admin-muted sm:text-xs">{tile.label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-admin-ink tabular-nums sm:text-base">{tile.value}</dd>
                </div>
              ))}
            </dl>
          </DetailCard>
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
          onSubmit={onSubmit}
        />
      )}
    </RecordSheet>
  );
}
