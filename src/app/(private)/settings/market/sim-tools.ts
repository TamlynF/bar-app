"use client";

import { useState, type TransitionStartFunction } from "react";
import { toast } from "sonner";
import type { useConfirm } from "@/components/ui/confirm-dialog";
import { formatGbp } from "@/lib/price";
import type { RoundTenderMode } from "@/lib/market/square-sandbox";
import type { SeedMode } from "@/lib/market/types";
import {
  addStockAction,
  clearSimulatedSalesAction,
  runTickNowAction,
  seedSandboxCatalogAction,
  setSquareSyncEnabledAction,
  simulateBusyRoundAction,
  simulateSaleAction,
  type SimMode,
} from "./actions";
import type { InstrumentSummary, SessionSummary, SquareSimSummary } from "./types";

type Confirm = ReturnType<typeof useConfirm>["confirm"];

/* State and handlers for the demo tooling that fakes till sales. Shared by
   the Testing tools panel and the per-row Sell / Stock cells in the floor
   table, which is why it lives outside either component. */
export function useSimTools({
  session,
  instruments,
  squareSim,
  confirm,
  startTransition,
  refresh,
}: {
  session: SessionSummary;
  instruments: InstrumentSummary[];
  squareSim: SquareSimSummary;
  confirm: Confirm;
  startTransition: TransitionStartFunction;
  refresh: () => void;
}) {
  const [roundSize, setRoundSize] = useState(10);
  const [favouriteId, setFavouriteId] = useState<number | null>(null);
  const [simMode, setSimMode] = useState<SimMode>("queue");
  const [roundTender, setRoundTender] = useState<RoundTenderMode>("mix");
  const [seedStock, setSeedStock] = useState(40);
  const [seedMode, setSeedMode] = useState<SeedMode>("reuse");
  const [stockToAdd, setStockToAdd] = useState(12);

  /* Queued units land on the next tick; "Tick now" runs the engine at once so
     the effect is visible without waiting out the interval. */
  const simPendingTotal = instruments.reduce((sum, instrument) => sum + instrument.simPending, 0);

  const sandboxAvailable = squareSim.environment === "sandbox";
  const sandboxSeeded = squareSim.sandboxSeededAt !== null;
  /* A drink rings through Square on the variation id it already carries from
     the menu mapping; seeding only sets stock levels and covers unmapped
     drinks with temporary items. */
  const anyMapped = instruments.some((instrument) => instrument.mapped);
  const viaSquare = simMode === "square" && sandboxAvailable;
  const tillSyncOn = session.squareSyncEnabled;
  /* Queue-only sales still move prices, and with sync on those prices land on
     the real till when Square is production. Offer to pause sync first. */
  const queueTouchesRealTill = !viaSquare && !sandboxAvailable && tillSyncOn;

  async function confirmQueueSale(): Promise<boolean> {
    if (!queueTouchesRealTill) return true;
    const confirmed = await confirm({
      title: "Square is set to production",
      description:
        "Simulated sales move prices on the board, and till sync is on, so the real Square till would change price too. Pause till sync for this market before selling?",
      confirmLabel: "Pause till sync and sell",
    });
    if (!confirmed) return false;
    const result = await setSquareSyncEnabledAction(false);
    if (result?.error) {
      toast.error(result.error);
      return false;
    }
    return true;
  }

  /* Confirm dialogs run before the transition starts: a state update raised
     inside startTransition waits for the transition itself to finish, so a
     dialog opened in there never appears. */
  async function handleSimSale(instrument: InstrumentSummary, units: number) {
    if (!(await confirmQueueSale())) return;
    startTransition(async () => {
      const result = await simulateSaleAction(instrument.id, units, viaSquare ? "square" : "queue");
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("amount" in result && typeof result.amount === "number") {
        toast.success(
          `${units} × ${instrument.name} rung through Square sandbox - ${formatGbp(result.amount)} paid. The next tick picks it up.`
        );
      } else {
        toast.success(`${units} × ${instrument.name} queued for the next tick.`);
      }
      refresh();
    });
  }

  async function handleAddStock(instrument: InstrumentSummary) {
    const quantity = Math.floor(stockToAdd);
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error("Enter how much stock to add.");
      return;
    }
    if (!sandboxAvailable) {
      const confirmed = await confirm({
        title: `Add ${quantity} to Square inventory for ${instrument.name}?`,
        description: "This is a real stock change on the production Square account.",
        confirmLabel: "Add stock",
      });
      if (!confirmed) return;
    }
    startTransition(async () => {
      const result = await addStockAction(instrument.id, quantity);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${quantity} added to ${instrument.name} in Square.`);
      refresh();
    });
  }

  async function handleBusyRound() {
    if (!(await confirmQueueSale())) return;
    startTransition(async () => {
      const result = await simulateBusyRoundAction(
        roundSize,
        favouriteId,
        viaSquare ? "square" : "queue",
        roundTender
      );
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const sales = "sales" in result ? result.sales : 0;
      const units = "units" in result ? result.units : 0;
      if ("takings" in result && typeof result.takings === "number") {
        const split =
          "cash" in result && "card" in result ? ` (${result.card} card, ${result.cash} cash)` : "";
        toast.success(
          `${sales} sandbox orders paid${split} - ${units} drinks, ${formatGbp(result.takings)} in the Square sandbox.`
        );
        if ("partialError" in result && result.partialError) toast.error(`Round stopped early: ${result.partialError}`);
      } else {
        toast.success(`Busy round rung up - ${sales} sales, ${units} drinks queued.`);
      }
      refresh();
    });
  }

  async function handleSeedSandbox() {
    const confirmed = await confirm({
      title: seedMode === "reuse" ? "Stock the mapped sandbox items?" : "Seed temporary sandbox items?",
      description:
        seedMode === "reuse"
          ? `Overwrites the sandbox stock count for this market's drinks, setting each to ${seedStock}. Nothing is created in the catalog. Drinks with no mapping get a temporary item.`
          : `Deletes the temporary items a previous seed created, then makes a fresh one per drink at the menu price with ${seedStock} in stock. Mapped catalog items are never touched.`,
      confirmLabel: seedMode === "reuse" ? "Stock items" : "Seed sandbox",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await seedSandboxCatalogAction(seedStock, seedMode);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const reused = "reused" in result ? result.reused : 0;
      const created = "created" in result ? result.created : 0;
      const deleted = "deleted" in result ? result.deleted : 0;
      const parts = [
        reused > 0 ? `${reused} existing` : null,
        created > 0 ? `${created} new` : null,
        deleted > 0 ? `${deleted} replaced` : null,
      ].filter(Boolean);
      toast.success(
        parts.length > 0
          ? `Sandbox ready - ${parts.join(", ")}.`
          : "Nothing to seed on this market."
      );
      setSimMode("square");
      refresh();
    });
  }

  function handleTickNow() {
    startTransition(async () => {
      const result = await runTickNowAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const tickNo = "tickNo" in result ? result.tickNo : null;
      toast.success(tickNo != null ? `Tick ${tickNo} run - board updated.` : "Tick run - board updated.");
      refresh();
    });
  }

  function handleClearSim() {
    startTransition(async () => {
      const result = await clearSimulatedSalesAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Queued simulated sales cleared.");
      refresh();
    });
  }

  return {
    roundSize,
    setRoundSize,
    favouriteId,
    setFavouriteId,
    simMode,
    setSimMode,
    roundTender,
    setRoundTender,
    seedStock,
    setSeedStock,
    seedMode,
    setSeedMode,
    stockToAdd,
    setStockToAdd,
    simPendingTotal,
    sandboxAvailable,
    sandboxSeeded,
    anyMapped,
    viaSquare,
    handleSimSale,
    handleAddStock,
    handleBusyRound,
    handleSeedSandbox,
    handleTickNow,
    handleClearSim,
  };
}

export type SimTools = ReturnType<typeof useSimTools>;
