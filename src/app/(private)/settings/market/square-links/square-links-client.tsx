"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, Loader2, RefreshCw, SearchX, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterChip, ListSearchInput, RecordList, StatusPill } from "@/components/admin";
import { formatGbp } from "@/lib/price";
import type { CatalogVariation } from "@/lib/market/mapping";
import type { MappingRow } from "@/lib/market/mapping-rows";
import { autoMatchMappingsAction, loadCatalogVariationsAction, pushMenuToSquareAction, saveMappingAction } from "../actions";
import { NEUTRAL_BUTTON, OUTLINE_BUTTON } from "../ui";

type LinkFilter = "all" | "unlinked" | "board" | "event";

function matches(needle: string, row: MappingRow): boolean {
  if (!needle) return true;
  return [row.itemName, row.categoryName, row.serve, ...row.onEvents].some((field) =>
    field.toLowerCase().includes(needle)
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
        className
      )}
    >
      <option value="">Not linked</option>
      {row.squareVariationId && !variations?.some((v) => v.variationId === row.squareVariationId) && (
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
export default function SquareLinksClient({
  rows,
  variations: initialVariations,
  focusEvent,
}: {
  rows: MappingRow[];
  variations: CatalogVariation[] | null;
  focusEvent: { id: number; name: string } | null;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [variations, setVariations] = useState<CatalogVariation[] | null>(initialVariations);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LinkFilter>(focusEvent ? "event" : "all");

  const linkedCount = rows.filter((row) => row.squareVariationId).length;
  const onBoard = rows.filter((row) => row.onEvents.length > 0);
  const unlinkedOnBoard = onBoard.filter((row) => !row.squareVariationId).length;

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matches(needle, row)) return false;
      if (filter === "unlinked") return !row.squareVariationId;
      if (filter === "board") return row.onEvents.length > 0;
      if (filter === "event") return focusEvent != null && row.onEvents.includes(focusEvent.name);
      return true;
    });
  }, [rows, query, filter, focusEvent]);

  const groups = useMemo(() => {
    const out: { name: string; rows: MappingRow[] }[] = [];
    for (const row of shown) {
      const last = out[out.length - 1];
      if (last && last.name === row.categoryName) last.rows.push(row);
      else out.push({ name: row.categoryName, rows: [row] });
    }
    return out;
  }, [shown]);

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

  async function retryCatalog() {
    setLoadingCatalog(true);
    const result = await loadCatalogVariationsAction();
    setLoadingCatalog(false);
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
      await retryCatalog();
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
      router.refresh();
    });
  }

  const eventsLabel = (row: MappingRow) =>
    row.onEvents.length === 0 ? "" : row.onEvents.length <= 2 ? row.onEvents.join(", ") : `${row.onEvents.length} events`;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-3 sm:px-4 sm:py-0 md:px-6 xl:max-w-6xl">
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
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-admin-warning" aria-hidden="true" />
          <p>
            <span className="font-semibold">
              {unlinkedOnBoard} {unlinkedOnBoard === 1 ? "serve" : "serves"} on the board {unlinkedOnBoard === 1 ? "is" : "are"} not linked.
            </span>{" "}
            <span className="text-admin-muted">
              Unlinked serves get no till demand, no stock alerts, and their market price never reaches the till.
            </span>
          </p>
        </div>
      )}

      {variations === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-error/30 bg-admin-error-bg px-4 py-3 text-[13px] sm:px-5">
          <p className="text-admin-ink">
            <span className="font-semibold">Could not reach the Square catalog.</span>{" "}
            <span className="text-admin-muted">Links are shown but cannot be changed until it loads.</span>
          </p>
          <button type="button" onClick={retryCatalog} disabled={loadingCatalog} className={NEUTRAL_BUTTON}>
            {loadingCatalog ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Retry
          </button>
        </div>
      )}

      <RecordList
        variant="panel"
        title="Square links"
        count={shown.length}
        subtitle={`${linkedCount} of ${rows.length} serves linked · till sales drive demand for linked serves`}
        collapsible={false}
        activeFilterCount={filter === "all" ? 0 : 1}
        toolbar={
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search serves"
            placeholder="Search by drink, category, serve or event"
          />
        }
        filters={
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            <FilterChip active={filter === "unlinked"} onClick={() => setFilter("unlinked")}>
              Not linked
            </FilterChip>
            <FilterChip active={filter === "board"} onClick={() => setFilter("board")}>
              On the board
            </FilterChip>
            {focusEvent && (
              <FilterChip active={filter === "event"} onClick={() => setFilter("event")}>
                On {focusEvent.name}
              </FilterChip>
            )}
          </div>
        }
        actions={
          <>
            <div className="hidden items-center gap-1.5 sm:flex">
              <button type="button" onClick={handleAutoMatch} disabled={isPending} className={cn(OUTLINE_BUTTON, "h-8 px-3 text-[11px]")}>
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Auto-match
              </button>
              <button type="button" onClick={handlePushToSquare} disabled={isPending} className={cn(OUTLINE_BUTTON, "h-8 px-3 text-[11px]")}>
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Send menu to Square
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More Square actions"
                  title="More Square actions"
                  className={cn(NEUTRAL_BUTTON, "h-9 w-9 px-0 sm:hidden")}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled={isPending} onSelect={handleAutoMatch} className="min-h-11">
                  <Wand2 className="h-4 w-4" />
                  Auto-match serves
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isPending} onSelect={handlePushToSquare} className="min-h-11">
                  <Upload className="h-4 w-4" />
                  Send menu to Square
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <SearchX className="h-6 w-6 text-admin-muted" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-admin-ink">No serves match</p>
            <p className="text-[11px] text-admin-muted">Try a different search or filter.</p>
          </div>
        ) : (
          <>
            <ul className="m-0 list-none p-0 sm:hidden">
              {groups.map((group) => (
                <li key={group.name}>
                  <p className="bg-admin-surface px-3 py-1.5 text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                    {group.name}
                  </p>
                  <ul className="m-0 list-none divide-y divide-admin-line/60 p-0">
                    {group.rows.map((row) => (
                      <li key={row.menuItemPriceId} className="space-y-2 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-admin-ink">
                              {row.itemName}
                              <span className="font-medium text-admin-muted"> · {row.serve}</span>
                            </p>
                            <p className="text-[11px] text-admin-muted">
                              {formatGbp(row.amount)}
                              {row.onEvents.length > 0 && ` · ${eventsLabel(row)}`}
                            </p>
                          </div>
                          <StatusPill tone={row.squareVariationId ? "success" : "neutral"} showLabelOnMobile>
                            {row.squareVariationId ? "Linked" : "Not linked"}
                          </StatusPill>
                        </div>
                        <VariationSelect
                          row={row}
                          variations={variations}
                          disabled={isPending}
                          onChange={(id) => run(() => saveMappingAction(row.menuItemPriceId, id), "Link saved.")}
                        />
                      </li>
                    ))}
                  </ul>
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
                    <th className="py-2 pr-4 sm:pr-5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <GroupRows
                      key={group.name}
                      group={group}
                      variations={variations}
                      isPending={isPending}
                      eventsLabel={eventsLabel}
                      onChange={(row, id) => run(() => saveMappingAction(row.menuItemPriceId, id), "Link saved.")}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </RecordList>
    </div>
  );
}

function GroupRows({
  group,
  variations,
  isPending,
  eventsLabel,
  onChange,
}: {
  group: { name: string; rows: MappingRow[] };
  variations: CatalogVariation[] | null;
  isPending: boolean;
  eventsLabel: (row: MappingRow) => string;
  onChange: (row: MappingRow, variationId: string | null) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={6} className="bg-admin-surface px-4 py-1.5 text-[11px] font-semibold tracking-wide text-admin-muted uppercase sm:px-5">
          {group.name}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.menuItemPriceId} className="border-b border-admin-line/60">
          <td className="py-1.5 pr-3 pl-4 text-[13px] font-semibold text-admin-ink sm:pl-5">{row.itemName}</td>
          <td className="py-1.5 pr-3 text-[13px] text-admin-muted">{row.serve}</td>
          <td className="py-1.5 pr-3 text-right text-[13px] text-admin-ink tabular-nums">{formatGbp(row.amount)}</td>
          <td className="py-1.5 pr-3 text-[12px] text-admin-muted">{eventsLabel(row) || "—"}</td>
          <td className="py-1.5 pr-3">
            <VariationSelect
              row={row}
              variations={variations}
              disabled={isPending}
              onChange={(id) => onChange(row, id)}
              className="max-w-64"
            />
          </td>
          <td className="py-1.5 pr-4 sm:pr-5">
            <StatusPill tone={row.squareVariationId ? "success" : "neutral"} showLabelOnMobile>
              {row.squareVariationId ? "Linked" : "Not linked"}
            </StatusPill>
          </td>
        </tr>
      ))}
    </>
  );
}
