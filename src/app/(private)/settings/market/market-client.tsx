"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useRecordSheet } from "@/components/admin";
import type { StockMarketEventSummary } from "@/lib/market/stock-market-events";
import type { ServeOption } from "@/lib/market/event-serves";
import type { EventReadiness } from "@/lib/market/event-readiness";
import {
  deactivateStockMarketEventAction,
  openStockMarketEventAction,
  restoreTillPricesAction,
  saveStockMarketEventAction,
} from "./actions";
import { EventListPanel } from "./event-list";
import { EventRecordSheet } from "./event-sheet";
import { LiveFloorCard } from "./live-floor";
import { SquareLinksSummaryCard } from "./square-links-summary";
import { TillRestoreBanner } from "./till-restore-banner";
import type {
  CategoryOption,
  EmployeeOption,
  InstrumentSummary,
  SessionSummary,
  SquareLinksSummary,
  SquareSimSummary,
  TillRestoreSummary,
} from "./types";

export default function MarketClient({
  session,
  instruments,
  categories,
  drinks,
  events,
  employees,
  readinessById,
  squareLinks,
  tillRestore,
  squareSim,
  initialEditId,
  initialOpenId,
}: {
  session: SessionSummary | null;
  instruments: InstrumentSummary[];
  categories: CategoryOption[];
  drinks: ServeOption[];
  events: StockMarketEventSummary[];
  employees: EmployeeOption[];
  readinessById: Record<number, EventReadiness>;
  squareLinks: SquareLinksSummary;
  tillRestore: TillRestoreSummary | null;
  squareSim: SquareSimSummary;
  initialEditId: number | null;
  initialOpenId: number | null;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();

  const sheet = useRecordSheet<StockMarketEventSummary>({
    records: events,
    getId: (record) => record.id,
  });
  const { selected } = sheet;

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

  /* The open sheet is mirrored into the URL (?open=id) so a deep link, and
     the browser's back, can land straight in it. */
  useEffect(() => {
    if (openedFromUrl.current || initialOpenId == null) return;
    const target = events.find((event) => event.id === initialOpenId);
    if (!target) return;
    openedFromUrl.current = true;
    openView(target);
  }, [initialOpenId, events, openView]);

  function openEventSheet(event: StockMarketEventSummary) {
    sheet.openView(event);
    router.replace(`/settings/market?open=${event.id}`, { scroll: false });
  }

  function closeEventSheet() {
    sheet.close();
    router.replace("/settings/market", { scroll: false });
  }

  const live = session !== null;
  const liveEventId = session?.stockMarketEventId ?? null;
  const liveEvent = events.find((event) => event.id === liveEventId) ?? null;
  const otherEvents = live ? events.filter((event) => event.id !== liveEventId) : events;
  const tradeableCount = categories.reduce((sum, cat) => sum + cat.tradeableCount, 0);

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

  /* A new event lands on its own page, where the drinks, links and normal
     sales it still needs are laid out as a checklist. */
  const creating = sheet.mode === "add";
  const submitEvent = sheet.submit(async (formData) => {
    const result = await saveStockMarketEventAction(formData);
    if (result.error) return result;
    if (creating && "id" in result && result.id != null) {
      router.push(`/settings/market/${result.id}`);
      return result;
    }
    router.refresh();
    return result;
  });

  const listPanel = (
    <EventListPanel
      events={otherEvents}
      readinessById={readinessById}
      liveEventId={liveEventId}
      selectedId={selected?.id ?? null}
      tradeableCount={tradeableCount}
      isPending={isPending}
      title={live ? "Other events" : "Market events"}
      defaultCollapsed={live}
      onOpenSheet={openEventSheet}
      onAdd={sheet.openAdd}
      onOpenMarket={handleOpen}
    />
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-3 sm:px-4 sm:py-0 md:px-6 xl:max-w-6xl 2xl:max-w-[100rem]">
      {ConfirmDialogUI}

      {tillRestore && (
        <TillRestoreBanner tillRestore={tillRestore} onRestore={handleRestoreTill} isPending={isPending} />
      )}

      {session && (
        <LiveFloorCard
          session={session}
          instruments={instruments}
          liveEvent={liveEvent ? { id: liveEvent.id, name: liveEvent.name } : null}
          squareSim={squareSim}
          onOpenSettings={liveEvent ? () => openEventSheet(liveEvent) : undefined}
        />
      )}

      {listPanel}

      <SquareLinksSummaryCard summary={squareLinks} />

      <EventRecordSheet
        sheet={sheet}
        drinks={drinks}
        employees={employees}
        liveEventId={liveEventId}
        readiness={selected ? (readinessById[selected.id] ?? null) : null}
        onClose={closeEventSheet}
        onSubmit={submitEvent}
        onDeactivate={handleDeactivate}
      />
    </div>
  );
}
