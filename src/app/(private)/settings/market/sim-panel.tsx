"use client";

import { useState, type ReactNode } from "react";
import { Beaker, ChevronDown, Eraser, ExternalLink, FastForward, Loader2, Receipt, Upload, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StatusPill } from "@/components/admin";
import { formatGbp } from "@/lib/price";
import type { RoundTenderMode } from "@/lib/market/square-sandbox";
import type { SeedMode } from "@/lib/market/types";
import { squareSandboxDashboardUrl, squareTransactionUrl } from "@/lib/market/simulate";
import type { SimMode } from "./actions";
import { ConfigHelp } from "./config-fields";
import type { SimTools } from "./sim-tools";
import type { InstrumentSummary, SquareSimSummary } from "./types";
import { NEUTRAL_BUTTON, OUTLINE_BUTTON, PRIMARY_BUTTON } from "./ui";

/* The Square note is four sentences of context that is read once and then in
   the way, so it collapses to a single ellipsised line. */
function SimNote({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={open ? "Hide the detail" : "Show the rest"}
      className="flex w-full items-start gap-1.5 text-left"
    >
      <span className={cn("min-w-0 flex-1 text-[12px] text-admin-muted", !open && "line-clamp-1")}>
        {children}
      </span>
      <ChevronDown
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0 text-admin-muted transition-transform duration-200",
          open && "rotate-180"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

/* Shaped like the event config fields so the same ConfigHelp tooltip renders
   them; these describe the simulator's controls, not anything stored. */
const SIM_FIELD_HELP = {
  roundSize: {
    label: "Sales in a round",
    hint: "How many separate sales one Busy round rings up",
    help: "A busy round fakes a rush. This is how many individual sales it makes - each one picks a drink at random from the board, weighted towards the favourite, and sells one or two of it. More sales means a bigger jolt to the prices on the next tick.",
  },
  stockToAdd: {
    label: "Stock per add",
    hint: "Units the Stock button adds to a drink in Square",
    help: "The Stock button on each drink row adds this many units to that drink's Square inventory. Use it to put stock back after sales have run a drink low, so the running low and back in stock alerts can be shown.",
  },
  roundTender: {
    label: "Round tender",
    hint: "How a busy round's sales are paid in Square",
    help: "Only applies to Busy round via Square. Mixed pays about a third of the round in cash and the rest by card, spread through the round like a real till; Card and Cash make every sale in the round the same. Selling a single drink from its row always rings as card. Under Queue only nothing reaches Square, so tender is not used at all.",
  },
} as const;

const SIM_INPUT =
  "h-11 rounded-lg border border-admin-line bg-admin-card px-3 text-base font-semibold text-admin-ink tabular-nums outline-none focus:border-admin-primary sm:h-9 sm:text-sm";

/* Test tool: fakes till sales so the market can be exercised without
   customers. Collapsed by default so a busy Saturday's control panel is not
   cluttered with +1 buttons. */
export function SimPanel({
  open,
  onToggle,
  tools,
  instruments,
  squareSim,
  isPending,
}: {
  open: boolean;
  onToggle: () => void;
  tools: SimTools;
  instruments: InstrumentSummary[];
  squareSim: SquareSimSummary;
  isPending: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const { viaSquare, sandboxAvailable, sandboxSeeded, anyMapped, simPendingTotal } = tools;

  return (
    <div className="mb-4 rounded-xl border border-dashed border-admin-line bg-admin-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left sm:px-4"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Beaker className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-admin-ink">Testing tools</span>
          <span className="hidden text-[11px] text-admin-muted sm:inline">
            · fake till sales feed the next tick like real ones
          </span>
        </span>
        <span className="flex items-center gap-2">
          {simPendingTotal > 0 && (
            <StatusPill tone="warning" showLabelOnMobile>
              {simPendingTotal} queued
            </StatusPill>
          )}
          <ChevronDown
            className={cn("h-4 w-4 text-admin-muted transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          />
        </span>
      </button>
      {open && (
        <TooltipProvider>
          <div className="space-y-3 border-t border-admin-line px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="radiogroup"
                aria-label="How simulated sales are recorded"
                className="flex rounded-lg border border-admin-line bg-admin-card p-0.5"
              >
                {(
                  [
                    { value: "queue", label: "Queue only" },
                    { value: "square", label: "Ring through Square" },
                  ] as { value: SimMode; label: string }[]
                ).map((option) => {
                  const disabled = option.value === "square" && !sandboxAvailable;
                  const active = tools.simMode === option.value && !disabled;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={disabled}
                      onClick={() => tools.setSimMode(option.value)}
                      className={cn(
                        "flex h-9 items-center rounded-md px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        active ? "bg-admin-primary text-white" : "text-admin-muted hover:bg-admin-surface"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <StatusPill tone={sandboxAvailable ? "info" : "warning"} showLabelOnMobile>
                Square: {squareSim.environment}
                {squareSim.locationId ? ` · ${squareSim.locationId}` : ""}
              </StatusPill>
            </div>

            <SimNote open={helpOpen} onToggle={() => setHelpOpen((value) => !value)}>
              {viaSquare ? (
                <>
                  Every sale becomes a real order and payment in the Square{" "}
                  <span className="font-semibold text-admin-ink">sandbox</span>. The market finds it the
                  same way it finds a till sale, moves the price, and writes the new price back into the
                  sandbox catalog - open the sandbox dashboard alongside the board to show the loop end to
                  end. Square takes stock off as sales ring through; Add stock puts it back so you can
                  show the restock alert. Any drink mapped to Square is sellable straight away on whatever
                  stock Square already holds - seeding below is only for setting a known stock level, or
                  for covering drinks with no mapping. Selling a single drink always rings as card; a busy
                  round follows the round tender below.
                </>
              ) : (
                <>
                  Sales go straight into the tick queue without touching Square. Use{" "}
                  <span className="font-semibold text-admin-ink">Ring through Square</span> when the app
                  is pointed at the sandbox to show the real integration.
                  {!sandboxAvailable && " Square is set to production here, so sandbox sales are locked."}
                </>
              )}
            </SimNote>

            {viaSquare && (
              <div className="rounded-lg border border-admin-info/40 bg-admin-info-bg px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <p className="flex min-w-0 items-center gap-0.5 text-[12px] font-semibold text-admin-ink">
                    {sandboxSeeded ? "Sandbox catalog seeded" : "Set the sandbox stock (optional)"}
                    <ConfigHelp
                      field={{
                        label: tools.seedMode === "reuse" ? "Stock mapped items" : "Seed temporary items",
                        hint:
                          tools.seedMode === "reuse"
                            ? "Sets the stock Square holds for this market's drinks"
                            : "Creates a throwaway catalog item per drink",
                        help:
                          tools.seedMode === "reuse"
                            ? "Mapped drinks already sell through Square, so nothing is created here - this only resets their sandbox stock to a known number so a demo has headroom."
                            : "Replaces the temporary items from the last seed with fresh ones, so nothing duplicates. Use this for drinks with no Square mapping. They are deleted again when the market closes.",
                      }}
                    />
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      role="radiogroup"
                      aria-label="How the sandbox catalog is seeded"
                      className="flex rounded-lg border border-admin-line bg-admin-card p-0.5"
                    >
                      {(
                        [
                          { value: "reuse", label: "Use mapped items" },
                          { value: "temp", label: "Temp items" },
                        ] as { value: SeedMode; label: string }[]
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={tools.seedMode === option.value}
                          onClick={() => tools.setSeedMode(option.value)}
                          className={cn(
                            "flex h-11 items-center rounded-md px-3 text-[12px] font-semibold transition-colors sm:h-9",
                            tools.seedMode === option.value
                              ? "bg-admin-primary text-white"
                              : "text-admin-muted hover:bg-admin-surface"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-admin-muted">
                      Stock each
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={tools.seedStock}
                        onChange={(event) => tools.setSeedStock(Number(event.target.value))}
                        className={cn(SIM_INPUT, "w-16 px-2")}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={tools.handleSeedSandbox}
                      disabled={isPending}
                      className={cn(sandboxSeeded ? NEUTRAL_BUTTON : PRIMARY_BUTTON, "whitespace-nowrap")}
                    >
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {tools.seedMode === "reuse" ? "Stock items" : sandboxSeeded ? "Re-seed" : "Seed sandbox"}
                    </button>
                    {/* Sits on the seed row wherever there is width for it
                        and wraps underneath when there is not. */}
                    <div className="flex items-center gap-1 rounded-lg border border-admin-info/30 bg-admin-card px-1">
                      {(
                        [
                          { key: "orders", label: "Orders" },
                          { key: "items", label: "Items & prices" },
                        ] as const
                      ).map((link) => (
                        <a
                          key={link.key}
                          href={squareSandboxDashboardUrl(link.key)}
                          target="_blank"
                          rel="noreferrer"
                          title={`Open the sandbox ${link.label.toLowerCase()} in the Square dashboard`}
                          className="flex h-11 items-center gap-1 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap text-admin-info transition-colors hover:bg-admin-info-bg sm:h-8"
                        >
                          {link.label}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-admin-muted">
                <span className="flex items-center gap-0.5">
                  Sales in a round
                  <ConfigHelp field={SIM_FIELD_HELP.roundSize} />
                </span>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={tools.roundSize}
                  onChange={(event) => tools.setRoundSize(Number(event.target.value))}
                  className={cn(SIM_INPUT, "w-24")}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-admin-muted">
                <span className="flex items-center gap-0.5">
                  Stock per add
                  <ConfigHelp field={SIM_FIELD_HELP.stockToAdd} />
                </span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={tools.stockToAdd}
                  onChange={(event) => tools.setStockToAdd(Number(event.target.value))}
                  className={cn(SIM_INPUT, "w-24")}
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold text-admin-muted sm:max-w-xs">
                Favourite (sells 3× as often)
                <select
                  value={tools.favouriteId ?? ""}
                  onChange={(event) =>
                    tools.setFavouriteId(event.target.value === "" ? null : Number(event.target.value))
                  }
                  className="h-11 rounded-lg border border-admin-line bg-admin-card px-3 text-base font-medium text-admin-ink outline-none focus:border-admin-primary sm:h-9 sm:text-sm"
                >
                  <option value="">No favourite</option>
                  {instruments.map((instrument) => (
                    <option key={instrument.id} value={instrument.id}>
                      {instrument.name} ({instrument.serve})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {viaSquare && (
              <div className="flex flex-col gap-1 text-[11px] font-semibold text-admin-muted">
                <span className="flex items-center gap-0.5">
                  Round tender
                  <ConfigHelp field={SIM_FIELD_HELP.roundTender} />
                </span>
                <div
                  role="radiogroup"
                  aria-label="How busy-round sales are paid in Square"
                  className="flex rounded-lg border border-admin-line bg-admin-card p-0.5"
                >
                  {(
                    [
                      { value: "mix", label: "Mixed" },
                      { value: "card", label: "Card" },
                      { value: "cash", label: "Cash" },
                    ] as { value: RoundTenderMode; label: string }[]
                  ).map((option) => {
                    const active = tools.roundTender === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => tools.setRoundTender(option.value)}
                        className={cn(
                          "flex h-10 items-center rounded-md px-3 text-[12px] font-semibold transition-colors sm:h-8",
                          active ? "bg-admin-primary text-white" : "text-admin-muted hover:bg-admin-surface"
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={tools.handleBusyRound}
                disabled={
                  isPending ||
                  !Number.isFinite(tools.roundSize) ||
                  tools.roundSize < 1 ||
                  (viaSquare && !anyMapped)
                }
                title={
                  viaSquare
                    ? "Rings a rush of sales into Square now. Prices do not move until the next tick."
                    : "Queues a rush of sales for the next tick. Prices do not move until then."
                }
                className={cn(PRIMARY_BUTTON, "flex-1 whitespace-nowrap sm:flex-none")}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Zap className="h-4 w-4" aria-hidden="true" />
                )}
                {viaSquare ? "Busy round via Square" : "Busy round"}
              </button>
              <button
                type="button"
                onClick={tools.handleTickNow}
                disabled={isPending}
                title="Runs the pricing engine straight away instead of waiting for the next tick, so sales already made show on the board now."
                className={cn(OUTLINE_BUTTON, "flex-1 whitespace-nowrap sm:flex-none")}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FastForward className="h-4 w-4" aria-hidden="true" />
                )}
                Tick now
              </button>
              <button
                type="button"
                onClick={tools.handleClearSim}
                disabled={isPending || simPendingTotal === 0}
                className={cn(NEUTRAL_BUTTON, "whitespace-nowrap")}
              >
                <Eraser className="h-4 w-4" aria-hidden="true" />
                Clear queue
              </button>
            </div>

            {squareSim.recentOrders.length > 0 && (
              <div className="rounded-lg border border-admin-line bg-admin-card">
                <button
                  type="button"
                  onClick={() => setOrdersOpen((value) => !value)}
                  aria-expanded={ordersOpen}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left",
                    ordersOpen && "border-b border-admin-line"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Receipt className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden="true" />
                    <span className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                      Latest sandbox orders
                    </span>
                    <span className="hidden text-[11px] text-admin-muted sm:inline">
                      · tap an order to open it in Square
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-admin-muted tabular-nums">
                      {squareSim.recentOrders.length}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-admin-muted transition-transform duration-200",
                        ordersOpen && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                {ordersOpen && (
                  <ul className="m-0 list-none divide-y divide-admin-line/60">
                    {squareSim.recentOrders.map((order) => {
                      const body = (
                        <>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-admin-ink">
                              {order.units} × {order.name}
                              <span className="font-normal text-admin-muted"> · {order.serve}</span>
                            </p>
                            <p className="truncate text-[11px] text-admin-muted">
                              {new Date(order.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              {order.tender ? ` · ${order.tender}` : ""}
                              {order.orderId ? ` · order ${order.orderId.slice(0, 8)}…` : ""}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-2">
                            {order.amount != null && (
                              <span className="text-[13px] font-semibold text-admin-ink tabular-nums">
                                {formatGbp(order.amount)}
                              </span>
                            )}
                            {order.paymentId && (
                              <ExternalLink className="h-3.5 w-3.5 text-admin-muted" aria-hidden="true" />
                            )}
                          </span>
                        </>
                      );
                      return (
                        <li key={order.id}>
                          {order.paymentId ? (
                            <a
                              href={squareTransactionUrl(squareSim.environment, order.paymentId, squareSim.locationId)}
                              target="_blank"
                              rel="noreferrer"
                              title="Open this transaction in Square"
                              className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-admin-surface"
                            >
                              {body}
                            </a>
                          ) : (
                            <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
