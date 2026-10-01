"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Ellipsis,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  SearchX,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FilterChip,
  ListSearchInput,
  RecordList,
  StatusPill,
} from "@/components/admin";
import { formatGbp } from "@/lib/price";
import { squareItemUrl } from "@/lib/market/simulate";
import type {
  MenuCategoryOption,
  MenuItemOption,
  MixerOnItem,
  ServeOption,
  SquareItemRow,
} from "@/lib/market/square-item-rows";
import {
  autoMatchMappingsAction,
  linkVariationToServeAction,
  loadCatalogVariationsAction,
  setVariationMenuCategoryAction,
  syncSquareSalesAction,
} from "../actions";
import { NEUTRAL_BUTTON, OUTLINE_BUTTON, formatStamp, salesSyncMessage } from "../ui";
import { saleLinesTitle, type SaleLineCount } from "./square-links-client";
import CreateServeDialog from "./create-serve-dialog";
import ModifierListPopover from "../modifier-list-popover";

type ItemFilter = "all" | "unlinked" | "linked" | "suggested" | "mixer";

type Group = { key: string; name: string; rows: SquareItemRow[] };

const NO_CATEGORY = "none";
const COLUMN_COUNT = 8;
const SELECT =
  "h-11 w-full cursor-pointer rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none disabled:opacity-60 sm:h-9";

function serveLabel(serve: ServeOption): string {
  return `${serve.itemName} · ${serve.serve} · ${formatGbp(serve.amount)}`;
}

function SaleLines({
  variationId,
  counts,
}: {
  variationId: string;
  counts: Record<string, SaleLineCount> | null;
}) {
  if (!counts) return <span className="text-admin-muted">-</span>;
  const count = counts[variationId];
  if (!count) {
    return (
      <span className="text-admin-muted" title="No Square sales synced for this variation yet">
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

function MixerPills({ mixers, itemName }: { mixers: MixerOnItem[]; itemName: string }) {
  if (mixers.length === 0) return <span className="text-admin-muted">-</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {mixers.map((mixer) => (
        <ModifierListPopover
          key={mixer.name}
          name={mixer.name}
          options={mixer.options}
          label={`Show the ${mixer.name} options for ${itemName}`}
          suffix={mixer.price != null && mixer.price > 0 ? ` +${formatGbp(mixer.price)}` : ""}
        />
      ))}
    </span>
  );
}

function ItemStatus({
  row,
  environment,
}: {
  row: SquareItemRow;
  environment: "sandbox" | "production";
}) {
  const pill = row.archived ? (
    <StatusPill tone="neutral" showLabelOnMobile>
      Archived
    </StatusPill>
  ) : row.statusExt === "Sold out" ? (
    <StatusPill tone="warning" showLabelOnMobile>
      Sold out
    </StatusPill>
  ) : (
    <StatusPill tone="success" showLabelOnMobile>
      {row.statusExt}
    </StatusPill>
  );
  return (
    <span className="inline-flex items-center gap-1">
      {pill}
      <a
        href={squareItemUrl(environment, row.itemId)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${row.itemName} in the Square dashboard`}
        title="Open in the Square dashboard"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink max-sm:h-11 max-sm:w-11"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </span>
  );
}

const NEW_SERVE = "new";

function ServeSelect({
  row,
  serves,
  suggestion,
  disabled,
  onChange,
  onNew,
}: {
  row: SquareItemRow;
  serves: ServeOption[];
  suggestion: ServeOption | undefined;
  disabled: boolean;
  onChange: (menuItemPriceId: number | null) => void;
  onNew: () => void;
}) {
  const byCategory = useMemo(() => {
    const out: { name: string; serves: ServeOption[] }[] = [];
    for (const serve of serves) {
      const last = out[out.length - 1];
      if (last && last.name === serve.categoryName) last.serves.push(serve);
      else out.push({ name: serve.categoryName, serves: [serve] });
    }
    return out;
  }, [serves]);
  return (
    <select
      aria-label={`Menu serve for ${row.itemName} ${row.variationName}`}
      value={row.linkedServeId ?? ""}
      disabled={disabled}
      onChange={(event) => {
        if (event.target.value === NEW_SERVE) onNew();
        else onChange(event.target.value ? Number(event.target.value) : null);
      }}
      className={cn(
        SELECT,
        "min-w-0 flex-1 sm:max-w-64 sm:min-w-40",
        suggestion && "border-dashed font-medium text-admin-muted",
      )}
    >
      <option value="">{suggestion ? `Suggested: ${suggestion.itemName} · ${suggestion.serve}` : "Not linked"}</option>
      {byCategory.map((group) => (
        <optgroup key={group.name} label={group.name}>
          {group.serves.map((serve) => (
            <option key={serve.menuItemPriceId} value={serve.menuItemPriceId}>
              {serveLabel(serve)}
              {serve.hidden ? " (hidden from menu)" : ""}
              {serve.squareVariationId && serve.squareVariationId !== row.variationId
                ? " (linked elsewhere)"
                : ""}
            </option>
          ))}
        </optgroup>
      ))}
      {row.linkedServeId == null && row.price != null && (
        <option value={NEW_SERVE}>New hidden serve…</option>
      )}
    </select>
  );
}

const ACTION = "h-11 w-26 shrink-0 px-2 text-[12px] sm:h-9";

/* One action beside the serve on every unlinked row, so the rows keep one
   height: take the suggestion, or give the variation a hidden menu serve of
   its own. Linked rows keep the slot empty so the columns stay aligned. */
function ServeAction({
  row,
  suggestion,
  disabled,
  onAccept,
  onNew,
}: {
  row: SquareItemRow;
  suggestion: ServeOption | undefined;
  disabled: boolean;
  onAccept: () => void;
  onNew: () => void;
}) {
  const label = `${row.itemName} ${row.variationName}`;
  if (row.linkedServeId != null) return <span className="hidden w-26 shrink-0 sm:block" aria-hidden="true" />;
  if (suggestion) {
    return (
      <button
        type="button"
        onClick={onAccept}
        disabled={disabled}
        aria-label={`Accept ${suggestion.itemName} ${suggestion.serve} for ${label}`}
        title={`Link to ${serveLabel(suggestion)}`}
        className={cn(OUTLINE_BUTTON, ACTION)}
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Accept
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onNew}
      disabled={disabled || row.price == null}
      aria-label={`New hidden serve for ${label}`}
      title={
        row.price == null
          ? "Square has no fixed price for this variation"
          : "Add this to the menu as a hidden serve and link it"
      }
      className={cn(NEUTRAL_BUTTON, ACTION)}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      New serve
    </button>
  );
}

function CategorySelect({
  row,
  categories,
  disabled,
  onChange,
}: {
  row: SquareItemRow;
  categories: MenuCategoryOption[];
  disabled: boolean;
  onChange: (categoryId: number | null) => void;
}) {
  const linkedName = categories.find((category) => category.id === row.linkedCategoryId)?.name;
  const manual = row.menuCategoryManual && row.menuCategoryId != null;
  return (
    <select
      aria-label={`Menu category for ${row.itemName} ${row.variationName}`}
      value={manual ? String(row.menuCategoryId) : "auto"}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value === "auto" ? null : Number(event.target.value))
      }
      className={cn(SELECT, "sm:max-w-52 sm:min-w-40", !manual && "font-medium text-admin-muted")}
    >
      <option value="auto">{linkedName ? `${linkedName} (from link)` : "None (from link)"}</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}

function GroupToggle({
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
  const linked = group.rows.filter((row) => row.linkedServeId != null).length;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 bg-admin-surface text-left text-[11px] font-semibold tracking-wide text-admin-muted uppercase transition-colors hover:bg-admin-line/40 sm:min-h-9",
        className,
      )}
    >
      <ChevronDown
        className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", !open && "-rotate-90")}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">{group.name}</span>
      <span className="font-medium tracking-normal normal-case">
        {group.rows.length} {group.rows.length === 1 ? "variation" : "variations"} · {linked} linked
      </span>
    </button>
  );
}

function matches(needle: string, row: SquareItemRow, serve: ServeOption | undefined, category: string): boolean {
  if (!needle) return true;
  return [
    row.itemName,
    row.variationName,
    row.reportingCategory ?? "",
    category,
    serve?.itemName ?? "",
    ...row.mixers.map((mixer) => mixer.name),
  ].some((field) => field.toLowerCase().includes(needle));
}

/* Every variation in the Square catalog copy against the menu: which serve
   it feeds, which menu category it belongs to, and whether it carries a
   mixer. Square holds far more than the menu (merchandise, happy-hour
   bottles), so most rows are expected to stay unlinked. */
export default function SquareItemsClient({
  rows,
  serves,
  items,
  categories,
  environment,
  saleLineCounts,
  salesSyncedAt,
  catalogSyncedAt,
}: {
  rows: SquareItemRow[] | null;
  serves: ServeOption[];
  items: MenuItemOption[];
  categories: MenuCategoryOption[];
  environment: "sandbox" | "production";
  saleLineCounts: Record<string, SaleLineCount> | null;
  salesSyncedAt: string | null;
  catalogSyncedAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ItemFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [creating, setCreating] = useState<SquareItemRow | null>(null);

  const serveById = useMemo(() => new Map(serves.map((serve) => [serve.menuItemPriceId, serve])), [serves]);
  const categoryName = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const allRows = useMemo(() => rows ?? [], [rows]);
  const live = allRows.filter((row) => showArchived || !row.archived);
  const linkedCount = live.filter((row) => row.linkedServeId != null).length;
  const suggestedCount = live.filter((row) => row.suggestedServeId != null).length;

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allRows.filter((row) => {
      if (!showArchived && row.archived) return false;
      const category = row.menuCategoryId != null ? (categoryName.get(row.menuCategoryId) ?? "") : "";
      const serve = row.linkedServeId != null ? serveById.get(row.linkedServeId) : undefined;
      if (!matches(needle, row, serve, category)) return false;
      if (filter === "unlinked") return row.linkedServeId == null;
      if (filter === "linked") return row.linkedServeId != null;
      if (filter === "suggested") return row.suggestedServeId != null;
      if (filter === "mixer") return row.mixers.length > 0;
      return true;
    });
  }, [allRows, query, filter, showArchived, categoryName, serveById]);

  const groups = useMemo(() => {
    const byKey = new Map<string, SquareItemRow[]>();
    for (const row of shown) {
      const key =
        row.menuCategoryId != null && categoryName.has(row.menuCategoryId)
          ? String(row.menuCategoryId)
          : NO_CATEGORY;
      byKey.set(key, [...(byKey.get(key) ?? []), row]);
    }
    const loose = byKey.get(NO_CATEGORY);
    const out: Group[] = loose ? [{ key: NO_CATEGORY, name: "No menu category", rows: loose }] : [];
    for (const category of categories) {
      const groupRows = byKey.get(String(category.id));
      if (groupRows) out.push({ key: String(category.id), name: category.name, rows: groupRows });
    }
    return out;
  }, [shown, categories, categoryName]);

  const searching = query.trim().length > 0;
  const isOpen = (key: string) => searching || !collapsed.has(key);
  const toggleGroup = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allCollapsed = groups.length > 0 && groups.every((group) => collapsed.has(group.key));
  const toggleAllGroups = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(groups.map((group) => group.key)));

  function run(action: () => Promise<{ error?: string } | void>, success: string) {
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

  const linkServe = (row: SquareItemRow, serveId: number | null) =>
    run(
      () => linkVariationToServeAction(row.variationId, serveId),
      serveId == null ? "Link removed." : "Link saved.",
    );
  const setCategory = (row: SquareItemRow, categoryId: number | null) =>
    run(
      () => setVariationMenuCategoryAction(row.variationId, categoryId),
      categoryId == null ? "Category follows the link again." : "Category saved.",
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

  async function refreshCatalog() {
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

  const serveCell = (row: SquareItemRow) => {
    const suggestion =
      row.linkedServeId == null && row.suggestedServeId != null ? serveById.get(row.suggestedServeId) : undefined;
    return (
      <div className="flex items-center gap-2">
        <ServeSelect
          row={row}
          serves={serves}
          suggestion={suggestion}
          disabled={isPending}
          onChange={(id) => linkServe(row, id)}
          onNew={() => setCreating(row)}
        />
        <ServeAction
          row={row}
          suggestion={suggestion}
          disabled={isPending}
          onAccept={() => suggestion && linkServe(row, suggestion.menuItemPriceId)}
          onNew={() => setCreating(row)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <CreateServeDialog
        key={creating?.variationId ?? "closed"}
        row={creating}
        categories={categories}
        items={items}
        onOpenChange={(open) => {
          if (!open) setCreating(null);
        }}
      />
      {rows === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-error/30 bg-admin-error-bg px-4 py-3 text-[13px] sm:px-5">
          <p className="text-admin-ink">
            <span className="font-semibold">The Square catalog has not been copied yet.</span>{" "}
            <span className="text-admin-muted">The nightly sync copies it, or copy it now.</span>
          </p>
          <button type="button" onClick={refreshCatalog} disabled={loadingCatalog} className={NEUTRAL_BUTTON}>
            {loadingCatalog ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Copy from Square
          </button>
        </div>
      )}

      <RecordList
        variant="panel"
        title="Square items"
        count={shown.length}
        subtitle={`${linkedCount} of ${live.length} variations linked${suggestedCount ? ` · ${suggestedCount} suggested` : ""} · sales synced ${salesSyncedAt ? formatStamp(salesSyncedAt) : "never"} · catalog copied ${catalogSyncedAt ? formatStamp(catalogSyncedAt) : "never"}`}
        collapsible={false}
        activeFilterCount={(filter === "all" ? 0 : 1) + (showArchived ? 1 : 0)}
        toolbar={
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search Square items"
            placeholder="Search items, drinks or categories"
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
            <FilterChip active={filter === "linked"} onClick={() => setFilter("linked")}>
              Linked
            </FilterChip>
            <FilterChip active={filter === "suggested"} onClick={() => setFilter("suggested")}>
              Suggested
            </FilterChip>
            <FilterChip active={filter === "mixer"} onClick={() => setFilter("mixer")}>
              Has mixer
            </FilterChip>
            <FilterChip active={showArchived} onClick={() => setShowArchived((value) => !value)}>
              Show archived
            </FilterChip>
          </div>
        }
        actions={
          <>
            <div className="hidden items-center gap-1.5 sm:flex">
              <button
                type="button"
                onClick={handleSyncSales}
                disabled={isSyncing}
                className={cn(NEUTRAL_BUTTON, "hidden h-8 px-3 text-[11px] whitespace-nowrap 2xl:flex")}
              >
                <Download className={cn("h-3.5 w-3.5", isSyncing && "animate-pulse")} aria-hidden="true" />
                Sync sales from Square
              </button>
              <button
                type="button"
                onClick={handleAutoMatch}
                disabled={isPending || rows === null}
                className={cn(OUTLINE_BUTTON, "h-8 px-3 text-[11px]")}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Auto-map
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More Square actions"
                  title="More Square actions"
                  className={cn(NEUTRAL_BUTTON, "h-9 w-9 px-0 sm:h-8 sm:w-8")}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Ellipsis className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled={isSyncing} onSelect={handleSyncSales} className="min-h-11 2xl:hidden">
                  <Download className="h-4 w-4" />
                  Sync sales from Square
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isPending || rows === null}
                  onSelect={handleAutoMatch}
                  className="min-h-11 sm:hidden"
                >
                  <Wand2 className="h-4 w-4" />
                  Auto-map
                </DropdownMenuItem>
                <DropdownMenuItem disabled={loadingCatalog} onSelect={refreshCatalog} className="min-h-11">
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
          </>
        }
      >
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <SearchX className="h-6 w-6 text-admin-muted" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-admin-ink">No Square items match</p>
            <p className="text-[11px] text-admin-muted">Try a different search or filter.</p>
          </div>
        ) : (
          <>
            <ul className="m-0 list-none p-0 sm:hidden">
              {groups.map((group) => (
                <li key={group.key}>
                  <GroupToggle
                    group={group}
                    open={isOpen(group.key)}
                    onToggle={() => toggleGroup(group.key)}
                    className="px-3"
                  />
                  {isOpen(group.key) && (
                    <ul className="m-0 list-none divide-y divide-admin-line/60 p-0">
                      {group.rows.map((row) => (
                        <li key={row.variationId} className="space-y-2 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-admin-ink">
                                {row.itemName}
                                {row.variationName && (
                                  <span className="font-medium text-admin-muted"> · {row.variationName}</span>
                                )}
                              </p>
                              <p className="text-[11px] text-admin-muted">
                                {row.price != null ? formatGbp(row.price) : "Variable price"}
                                {row.reportingCategory && ` · ${row.reportingCategory}`}
                                {saleLineCounts && (
                                  <>
                                    {" · "}
                                    <SaleLines variationId={row.variationId} counts={saleLineCounts} /> sales lines
                                  </>
                                )}
                              </p>
                              {row.mixers.length > 0 && (
                                <div className="pt-1">
                                  <MixerPills mixers={row.mixers} itemName={row.itemName} />
                                </div>
                              )}
                            </div>
                            <ItemStatus row={row} environment={environment} />
                          </div>
                          {serveCell(row)}
                          <CategorySelect
                            row={row}
                            categories={categories}
                            disabled={isPending}
                            onChange={(id) => setCategory(row, id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-220 text-left">
                <thead>
                  <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                    <th className="py-2 pr-3 pl-4 sm:pl-5">Square item</th>
                    <th className="py-2 pr-3 text-right">Price</th>
                    <th className="py-2 pr-3">Reporting category</th>
                    <th className="py-2 pr-3">Mixer</th>
                    <th
                      className="py-2 pr-3 text-right"
                      title="Square order lines synced for this variation, across every night"
                    >
                      Sales lines
                    </th>
                    <th className="py-2 pr-3">Menu serve</th>
                    <th className="py-2 pr-3">Menu category</th>
                    <th className="py-2 pr-4 sm:pr-5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <GroupRows
                      key={group.key}
                      group={group}
                      open={isOpen(group.key)}
                      onToggle={() => toggleGroup(group.key)}
                      render={(row) => (
                        <tr key={row.variationId} className="border-b border-admin-line/60 align-middle">
                          <td className="min-w-36 py-1.5 pr-3 pl-4 text-[13px] sm:pl-5">
                            <span className="font-semibold text-admin-ink">{row.itemName}</span>
                            {row.variationName && (
                              <span className="block text-[12px] text-admin-muted">{row.variationName}</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-right text-[13px] text-admin-ink tabular-nums">
                            {row.price != null ? formatGbp(row.price) : "-"}
                          </td>
                          <td className="py-1.5 pr-3 text-[12px] text-admin-muted">{row.reportingCategory ?? "-"}</td>
                          <td className="py-1.5 pr-3 text-[12px]">
                            <MixerPills mixers={row.mixers} itemName={row.itemName} />
                          </td>
                          <td className="py-1.5 pr-3 text-right text-[13px]">
                            <SaleLines variationId={row.variationId} counts={saleLineCounts} />
                          </td>
                          <td className="py-1.5 pr-3">{serveCell(row)}</td>
                          <td className="py-1.5 pr-3">
                            <CategorySelect
                              row={row}
                              categories={categories}
                              disabled={isPending}
                              onChange={(id) => setCategory(row, id)}
                            />
                          </td>
                          <td className="py-1.5 pr-4 sm:pr-5">
                            <ItemStatus row={row} environment={environment} />
                          </td>
                        </tr>
                      )}
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
  open,
  onToggle,
  render,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  render: (row: SquareItemRow) => React.ReactNode;
}) {
  return (
    <>
      <tr>
        <td colSpan={COLUMN_COUNT} className="p-0">
          <GroupToggle group={group} open={open} onToggle={onToggle} className="px-4 sm:px-5" />
        </td>
      </tr>
      {open && group.rows.map(render)}
    </>
  );
}
