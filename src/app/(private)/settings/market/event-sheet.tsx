"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Info, PowerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailCard, ErrorBox, RecordSheet, StatusPill, type useRecordSheet } from "@/components/admin";
import { formatGbp } from "@/lib/price";
import { DEFAULT_MARKET_CONFIG, type MarketConfig } from "@/lib/market/types";
import { formatTimeWindow, type StockMarketEventSummary } from "@/lib/market/stock-market-events";
import { WEEKDAY_NAMES } from "@/lib/market/normal-units";
import { groupServesForPicker, serveLabel, type ServeOption } from "@/lib/market/event-serves";
import { serveMixerPrice, withMixer } from "@/lib/market/mixer";
import type { EventReadiness } from "@/lib/market/event-readiness";
import {
  CONFIG_FIELDS,
  PUSH_ALERTS_FIELD,
  TIER_BANDS,
  TIER_FIELDS,
  TIER_PCT_FIELDS,
  configSummary,
  type ConfigField,
} from "./config-fields";
import { StepMark, drinksStepText, linksStepText, normalsStepText } from "./readiness-ui";
import type { EmployeeOption } from "./types";
import { formatRunDate } from "./ui";

const INPUT =
  "min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40";
/* Every settings value sits in the same fixed column, with the browser's
   number spinners hidden so the digits line up down the card. */
const CONFIG_VALUE =
  "w-20 flex-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const HOURS_HELP =
  "When the market opens and closes on a market night. The length of the night sets how many ticks it has, which the pace maths divides a drink's normal sales across. Opening and closing is still done by hand.";
const SALES_HISTORY_DAYS_HELP =
  "Which weekdays of past Square sales feed each drink's normal. None picked means every day. A day runs from 9am to 6am the next morning, so Saturday covers 9am Saturday to 6am Sunday. This does not open or close the market.";
const SKIP_HOLIDAYS_HELP =
  "Leave bank holidays and the nights before them out of the sales history, so one roaring bank holiday Sunday does not inflate what counts as a normal Sunday.";
const SKIP_MARKET_NIGHTS_HELP =
  "Leave earlier market nights out of the sales history, so moving prices do not feed back into what counts as normal.";

/* The band booking sheet's section: a soft olive header with the title and
   a chevron, then rows that each read label left, value right. */
function Section({
  title,
  hint,
  defaultOpen = true,
  className,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-admin-line bg-white shadow-sm", className)}>
      <div
        className={cn(
          "flex min-h-12 w-full items-center gap-3 bg-admin-primary-soft px-4 py-2 transition-colors sm:px-5",
          open && "border-b border-[#D8D5C8]"
        )}
      >
        <div className="flex flex-1 items-center gap-1.5">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center text-left transition-all hover:brightness-95">
            <span className="font-bold text-[14px] text-admin-ink">{title}</span>
          </button>
          {hint && <RowHelp label={title} text={hint} />}
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setOpen((o) => !o)} className="min-h-8 flex-1 self-stretch" />
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="shrink-0 transition-all hover:brightness-95 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center"
        >
          <ChevronDown className={cn("h-4 w-4 text-[#5E6654] transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      <div className={cn(!open && "hidden")}>{children}</div>
    </div>
  );
}

function RowHelp({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-primary"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-72 leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function Row({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <span className="flex shrink-0 items-center gap-1">
        <span className="font-bold text-[12px] whitespace-nowrap text-[#5E6654]">{label}</span>
        {required && <span className="text-[11px] font-semibold text-admin-error">*</span>}
        {help && <RowHelp label={label} text={help} />}
      </span>
      {children}
    </div>
  );
}

function SkipToggle({
  name,
  label,
  help,
  defaultChecked,
}: {
  name: string;
  label: string;
  help: string;
  defaultChecked: boolean;
}) {
  const id = `market-${name}`;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <input type="hidden" name={name} value="off" />
      <input
        id={id}
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={defaultChecked}
        className="h-4 w-4 shrink-0 cursor-pointer accent-admin-primary"
      />
      <label htmlFor={id} className="cursor-pointer truncate font-bold text-[12px] text-[#5E6654]">
        {label}
      </label>
      <RowHelp label={label} text={help} />
    </span>
  );
}

function weekdaysSummary(days: number[]): string {
  if (days.length === 0 || days.length === 7) return "Every day";
  return days.map((day) => WEEKDAY_NAMES[day].slice(0, 3)).join(", ");
}

/* One dropdown with a tick per weekday, in place of a row of seven pills. */
function WeekdayDropdown({ selected }: { selected: number[] }) {
  const [days, setDays] = useState<number[]>(selected);
  function toggle(day: number, on: boolean) {
    setDays((prev) => (on ? [...new Set([...prev, day])].sort() : prev.filter((d) => d !== day)));
  }
  return (
    <>
      {days.map((day) => (
        <input key={day} type="hidden" name="weekdays" value={day} />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Sales history days"
            className="flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[#D8D5C8] bg-white px-3 text-[13px] font-semibold text-[#20231A] transition-colors hover:bg-admin-surface"
          >
            <span className="truncate">{weekdaysSummary(days)}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5E6654]" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-2xl border-2 border-[#D8D5C8] bg-white p-1.5 text-[#20231A]">
          <DropdownMenuLabel className="text-[11px] font-semibold text-[#5E6654]">
            {days.length === 0 ? "None picked - every day counts" : "Only these days count"}
          </DropdownMenuLabel>
          {WEEKDAY_NAMES.map((name, day) => (
            <DropdownMenuCheckboxItem
              key={name}
              checked={days.includes(day)}
              onCheckedChange={(on) => toggle(day, on === true)}
              onSelect={(event) => event.preventDefault()}
              className="min-h-9 cursor-pointer rounded-lg text-[13px] font-semibold focus:bg-admin-primary-soft focus:text-admin-primary"
            >
              {name}
            </DropdownMenuCheckboxItem>
          ))}
          {days.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setDays([]);
                }}
                className="min-h-9 cursor-pointer rounded-lg text-[12px] font-semibold text-[#5E6654] focus:bg-admin-surface"
              >
                Clear - use every day
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
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
            className={cn(INPUT, "w-12 flex-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
          />
        </label>
      ))}
    </span>
  );
}

function ConfigNumberRow({ field, value }: { field: ConfigField; value: number }) {
  return (
    <Row label={field.label} help={`${field.hint} ${field.help}`}>
      <span className="flex flex-1 justify-end">
        <input
          type="number"
          name={field.key}
          aria-label={field.label}
          defaultValue={value}
          step={field.step}
          min="0"
          required
          className={cn(INPUT, CONFIG_VALUE)}
        />
      </span>
    </Row>
  );
}

function ConfigFormRows({ config }: { config: MarketConfig }) {
  return (
    <>
      {TIER_FIELDS.map((field) => (
        <ConfigNumberRow key={field.key} field={field} value={config[field.key]} />
      ))}
      <Row label={TIER_PCT_FIELDS.up.label} help={`Ranks 1–5, 6–10, 11–15 from the top. ${TIER_PCT_FIELDS.up.help}`}>
        <TierPctInputs field={TIER_PCT_FIELDS.up} values={config.tierPcts.up} />
      </Row>
      <Row label={TIER_PCT_FIELDS.down.label} help={`Ranks 1–5, 6–10, 11–15 from the bottom. ${TIER_PCT_FIELDS.down.help}`}>
        <TierPctInputs field={TIER_PCT_FIELDS.down} values={config.tierPcts.down} />
      </Row>
      <Link
        href="/settings/market/how-it-works"
        className="flex min-h-11 items-center gap-1 border-b border-[#D8D5C8] px-4 text-[12px] font-semibold text-admin-primary hover:underline sm:px-5"
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        How these dials set a price
      </Link>
      {CONFIG_FIELDS.map((field) => (
        <ConfigNumberRow key={field.key} field={field} value={config[field.key]} />
      ))}
      <Row label={PUSH_ALERTS_FIELD.label} help={`${PUSH_ALERTS_FIELD.hint} ${PUSH_ALERTS_FIELD.help}`}>
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
      </Row>
    </>
  );
}

/* Each serve is its own checkbox: "Guinness · pint" and "Guinness · half"
   are different instruments with different Square links. */
function DrinkPicker({
  drinks,
  selected,
  mixerPrice,
  onChange,
}: {
  drinks: ServeOption[];
  selected: number[];
  mixerPrice: number;
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
                item.serves.map((serve) => {
                  const mixer = serveMixerPrice(serve, mixerPrice);
                  return (
                  <label
                    key={serve.id}
                    className="flex min-h-9 cursor-pointer items-center gap-2 py-0.5 text-[13px] text-admin-ink"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(serve.id)}
                      onChange={() => toggleServe(serve.id)}
                      aria-label={`Trade ${serveLabel(serve.name, serve.serve)}`}
                      className="h-4 w-4 cursor-pointer accent-admin-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {item.name}
                        {item.serves.length > 1 || serve.serve.toLowerCase() !== "each" ? (
                          <span className="text-admin-muted"> · {serve.serve}</span>
                        ) : null}
                      </span>
                      {mixer != null && (
                        <span className="block truncate text-[11px] text-admin-muted tabular-nums">
                          with mixer · {formatGbp(serve.amount)} + {formatGbp(mixer)}
                        </span>
                      )}
                    </span>
                    <span
                      className="shrink-0 text-[11px] text-admin-muted tabular-nums"
                    >
                      {formatGbp(withMixer(serve.amount, mixer))}
                      {!serve.linked && " · not linked"}
                    </span>
                  </label>
                  );
                })
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
    <TooltipProvider>
    <form
      id="stock-market-event-form"
      action={onSubmit}
      className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
    >
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="menu_item_price_ids" value={JSON.stringify(selectedDrinks)} />

      <div className="grid-cols-2 items-start gap-4 space-y-4 sm:space-y-5 lg:grid lg:space-y-0 lg:gap-5">
        <Section title="Stock market details" className="min-w-0">
          <Row label="Name" required>
            <input
              name="name"
              required
              maxLength={80}
              aria-label="Name"
              placeholder="e.g. Friday floor"
              defaultValue={event?.name ?? ""}
              className={INPUT}
            />
          </Row>
          <Row label="Hours" required help={HOURS_HELP}>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <input
                type="time"
                name="open_time"
                required
                aria-label="Opening time"
                defaultValue={event?.openTime || "19:00"}
                className={cn(INPUT, "w-22 flex-none")}
              />
              <span className="text-[11px] font-semibold text-[#5E6654]">to</span>
              <input
                type="time"
                name="close_time"
                required
                aria-label="Closing time"
                defaultValue={event?.closeTime || "23:30"}
                className={cn(INPUT, "w-22 flex-none")}
              />
            </span>
          </Row>
          <Row label="Sales history days" help={SALES_HISTORY_DAYS_HELP}>
            <WeekdayDropdown selected={event?.weekdays ?? []} />
          </Row>
          <div className="grid grid-cols-2 gap-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
            <SkipToggle
              name="skip_holidays"
              label="Skip bank holidays"
              help={SKIP_HOLIDAYS_HELP}
              defaultChecked={event?.skipHolidays ?? true}
            />
            <SkipToggle
              name="exclude_market_nights"
              label="Skip market nights"
              help={SKIP_MARKET_NIGHTS_HELP}
              defaultChecked={event?.excludeMarketNights ?? true}
            />
          </div>
        </Section>

        <Section title="Market settings" hint={configSummary(config)} className="min-w-0">
          <ConfigFormRows config={config} />
          {live && (
            <p className="border-t border-[#D8D5C8] px-4 py-2.5 text-[11px] text-admin-muted sm:px-5">
              The market is live now. These changes apply the next time it opens.
            </p>
          )}
        </Section>
      </div>

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
            <DrinkPicker
              drinks={drinks}
              selected={selectedDrinks}
              mixerPrice={config.mixerPrice}
              onChange={setSelectedDrinks}
            />
          </div>
        </details>
      </DetailCard>

      {formError && <ErrorBox message={formError} />}
    </form>
    </TooltipProvider>
  );
}

/* The seven raw config numbers, read as a person would say them. */
function settingTiles(config: MarketConfig): { label: string; value: string }[] {
  return [
    { label: "Sales read", value: `every ${config.tickIntervalSec}s` },
    { label: "Prices change", value: `every ${config.rerankEveryTicks} ticks` },
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
