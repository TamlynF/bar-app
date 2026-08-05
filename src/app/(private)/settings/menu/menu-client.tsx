"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  UtensilsCrossed,
  Printer,
  Wand2,
  ChevronRight,
  ListOrdered,
  X,
  Check,
  SearchX,
  FileUp,
} from "lucide-react";
import MenuImportSheet from "./menu-import-sheet";
import { toast } from "sonner";
import {
  saveCategoryAction,
  deleteCategoryAction,
  saveItemAction,
  deleteItemAction,
  autoFillBenchmarkKeysAction,
  backfillServesAction,
} from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { NOT_COMPARED, resolveBenchmark } from "@/app/(private)/marketing/lib/compare";
import type { PriceBenchmark } from "@/app/(private)/marketing/lib/types";
import {
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
  type SheetMode as RecordSheetMode,
} from "@/components/admin";
import {
  SERVES,
  formatPriceText,
  parsePriceText,
  type MenuItemPrice,
} from "@/lib/menu-price";
import {
  planSave,
  planDelete,
  describeChanges,
  nextPosition,
  type ChangeDescription,
  type OrderRow,
} from "@/lib/merchandise-order";

type AuditFields = {
  created_at?: string | null;
  created_by?: number | null;
  updated_at?: string | null;
  updated_by?: number | null;
};

export type MenuItemPriceRow = {
  id: number;
  serve: string;
  amount: number;
  display_order: number;
};

export type MenuItem = AuditFields & {
  id: number;
  category_id: number;
  name: string;
  price: string;
  display_order: number;
  is_active: boolean;
  benchmark_key: string | null;
  menu_item_prices: MenuItemPriceRow[];
};

type ServeDraft = { serve: string; amount: string };

function nextUnusedServe(rows: ServeDraft[]): string {
  const used = new Set(rows.map((r) => r.serve));
  return SERVES.find((serve) => !used.has(serve)) ?? "each";
}

function serveSummary(rows: ServeDraft[]): string {
  const prices = draftPrices(rows);
  if (prices.length === 0) return "None yet";
  return prices.map((p) => p.serve).join(", ");
}

function draftPrices(rows: ServeDraft[]): MenuItemPrice[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const amount = Number(row.amount);
    if (!row.serve || !Number.isFinite(amount) || amount <= 0) return [];
    if (seen.has(row.serve)) return [];
    seen.add(row.serve);
    return [{ serve: row.serve, amount: Math.round(amount * 100) / 100 }];
  });
}

export type MenuCategory = AuditFields & {
  id: number;
  name: string;
  note: string | null;
  mixer_surcharge: number | null;
  display_order: number;
  is_active: boolean;
  menu_items: MenuItem[];
};

export type EmployeeOption = { id: number; full_name: string | null };

type SheetState =
  | { type: "view-category"; categoryId: number }
  | { type: "edit-category"; categoryId: number | null }
  | { type: "view-item"; categoryId: number; itemId: number }
  | { type: "edit-item"; categoryId: number; itemId: number | null }
  | { type: "edit-serves"; categoryId: number; itemId: number | null };

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-admin-line bg-admin-card transition-colors hover:bg-admin-surface disabled:opacity-50 sm:h-9 sm:w-9";

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-[13px] font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";

function toOrderRow(row: {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
}): OrderRow {
  return {
    id: row.id,
    name: row.name,
    display_order: row.display_order,
    is_active: row.is_active,
  };
}

function benchmarkSummary(
  item: MenuItem,
  categoryName: string,
  benchmarks: PriceBenchmark[]
): string {
  if (item.benchmark_key === NOT_COMPARED) return "Not compared";
  const resolved = resolveBenchmark(
    {
      id: item.id,
      name: item.name,
      price: item.price,
      category: categoryName,
      benchmark_key: item.benchmark_key,
    },
    benchmarks
  );
  if (!resolved) return "Not compared - nothing matched";
  return item.benchmark_key ? resolved.label : `${resolved.label} (auto)`;
}

function servesOf(item: MenuItem): string {
  if (!item.menu_item_prices.length) return "No serves";
  return item.menu_item_prices.map((p) => p.serve).join(", ");
}

function ActivePill({
  active,
  showLabelOnMobile,
}: {
  active: boolean;
  showLabelOnMobile?: boolean;
}) {
  return (
    <StatusPill
      tone={active ? "success" : "error"}
      icon={active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      showLabelOnMobile={showLabelOnMobile}
    >
      {active ? "Active" : "Inactive"}
    </StatusPill>
  );
}

export default function MenuClient({
  initialCategories = [],
  employees = [],
  benchmarks = [],
}: {
  initialCategories: MenuCategory[];
  employees?: EmployeeOption[];
  benchmarks?: PriceBenchmark[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [isFilling, startFill] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState(1);
  // The item form keeps its values in state so drilling into the serves and
  // back does not wipe what has been typed.
  const [itemName, setItemName] = useState("");
  const [priceText, setPriceText] = useState("");
  const [benchmarkKey, setBenchmarkKey] = useState("");
  const [serveDrafts, setServeDrafts] = useState<ServeDraft[]>([]);
  // What the serves looked like on the way in, so backing out undoes the edits.
  const [servesBefore, setServesBefore] = useState<ServeDraft[]>([]);

  const employeeById = new Map(
    employees.map((e) => [e.id, e.full_name ?? "-"] as const)
  );
  const employeeName = (id?: number | null) =>
    id ? employeeById.get(id) ?? "-" : "-";

  const categoryRows = initialCategories.map(toOrderRow);
  const itemRowsFor = (cat: MenuCategory | null) =>
    (cat?.menu_items ?? []).map(toOrderRow);

  const itemCount = initialCategories.reduce(
    (sum, c) => sum + c.menu_items.length,
    0
  );

  const searching = query.trim().length > 0;

  // A category matching by name carries all of its items; otherwise only the
  // items that match come through, so a hit is never buried in its group.
  const needle = query.trim().toLowerCase();
  const matchesCategory = (cat: MenuCategory) =>
    cat.name.toLowerCase().includes(needle) ||
    (cat.note ?? "").toLowerCase().includes(needle);

  const shownGroups = !needle
    ? initialCategories.map((cat) => ({ cat, items: cat.menu_items }))
    : initialCategories
        .map((cat) => ({
          cat,
          items: matchesCategory(cat)
            ? cat.menu_items
            : cat.menu_items.filter(
                (item) =>
                  item.name.toLowerCase().includes(needle) ||
                  item.price.toLowerCase().includes(needle)
              ),
        }))
        .filter(({ cat, items }) => items.length > 0 || matchesCategory(cat));

  const sheetCategory =
    sheet && sheet.categoryId != null
      ? initialCategories.find((c) => c.id === sheet.categoryId) ?? null
      : null;

  const sheetItem =
    sheet &&
    (sheet.type === "view-item" ||
      sheet.type === "edit-item" ||
      sheet.type === "edit-serves") &&
    sheet.itemId != null
      ? sheetCategory?.menu_items.find((i) => i.id === sheet.itemId) ?? null
      : null;

  const isItemSheet =
    sheet?.type === "view-item" ||
    sheet?.type === "edit-item" ||
    sheet?.type === "edit-serves";
  const isEditing =
    sheet?.type === "edit-category" || sheet?.type === "edit-item";

  const entityLabel = isItemSheet ? "menu item" : "category";
  const orderRows = isItemSheet ? itemRowsFor(sheetCategory) : categoryRows;
  const activeCount = orderRows.filter((row) => row.is_active).length;

  const editingRecord =
    sheet?.type === "edit-category"
      ? sheetCategory
      : sheet?.type === "edit-item" || sheet?.type === "edit-serves"
      ? sheetItem
      : null;
  const editingId = editingRecord?.id ?? null;
  const wasActive = editingRecord?.is_active ?? false;
  const canChoosePosition = !!editingRecord && wasActive && isActive;

  const plan = planSave(orderRows, {
    id: editingId,
    isActive,
    targetPosition: canChoosePosition ? position : null,
  });
  const affected = describeChanges(orderRows, plan.changes);

  const headerRecord = isItemSheet ? sheetItem : sheetCategory;

  // An item priced by no serve cannot be compared against anything, so neither
  // the item form nor the serves editor will save while the set is empty.
  const servesMissing = draftPrices(serveDrafts).length === 0;
  const saveDisabled =
    (sheet?.type === "edit-item" || sheet?.type === "edit-serves") && servesMissing;

  const isNewRecord =
    (sheet?.type === "edit-category" && sheet.categoryId == null) ||
    (sheet?.type === "edit-item" && sheet.itemId == null);

  const sheetMode: RecordSheetMode = !sheet
    ? "closed"
    : sheet.type === "view-category" || sheet.type === "view-item"
    ? "view"
    : isNewRecord
    ? "add"
    : "edit";

  const sheetTitle =
    sheet?.type === "view-category"
      ? "View category"
      : sheet?.type === "edit-category"
      ? sheet.categoryId
        ? "Edit category"
        : "New category"
      : sheet?.type === "view-item"
      ? "View menu item"
      : sheet?.type === "edit-item"
      ? sheet.itemId
        ? "Edit menu item"
        : "New menu item"
      : sheet?.type === "edit-serves"
      ? "Prices by serve"
      : "";

  const closeSheet = () => {
    setSheet(null);
    setFormError(null);
  };

  // Leaving an edit drops back to the record rather than dismissing the sheet -
  // you asked to change it, not to leave. A new record has nothing to fall back
  // to, so that one closes.
  const backToView = () => {
    setFormError(null);
    if (sheet?.type === "edit-category" && sheet.categoryId != null) {
      setSheet({ type: "view-category", categoryId: sheet.categoryId });
    } else if (sheet?.type === "edit-item" && sheet.itemId != null) {
      setSheet({ type: "view-item", categoryId: sheet.categoryId, itemId: sheet.itemId });
    } else {
      setSheet(null);
    }
  };

  const printMenuPage = () => {
    const frame = document.getElementById("menu-print-frame") as HTMLIFrameElement | null;
    if (frame?.contentWindow) {
      frame.contentWindow.print();
    }
  };

  const handleAutoFill = () => {
    startFill(async () => {
      const result = await autoFillBenchmarkKeysAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const leftover = result.unmatched
        ? ` ${result.unmatched} still match no round - set those by hand.`
        : "";
      if (result.filled === 0) {
        toast.success(
          result.unmatched
            ? `Nothing to fill.${leftover}`
            : "Every item already has a round."
        );
        return;
      }
      toast.success(
        `Set the round on ${result.filled} item${result.filled === 1 ? "" : "s"}.${leftover}`
      );
    });
  };

  const handleBackfillServes = () => {
    startFill(async () => {
      const result = await backfillServesAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.filled === 0) {
        toast.success("Every item already lists its serves.");
        return;
      }
      const notes = [
        result.partial ? `${result.partial} had extra wording left in place` : "",
        result.skipped ? `${result.skipped} had no readable price` : "",
      ].filter(Boolean);
      toast.success(
        `Read serves for ${result.filled} item${result.filled === 1 ? "" : "s"}.` +
          (notes.length ? ` ${notes.join("; ")}.` : "")
      );
    });
  };

  const startEditCategory = (category: MenuCategory | null) => {
    setFormError(null);
    setIsActive(category?.is_active ?? true);
    setPosition(
      category?.is_active ? category.display_order : nextPosition(categoryRows)
    );
    setSheet({ type: "edit-category", categoryId: category?.id ?? null });
  };

  const startEditItem = (category: MenuCategory, item: MenuItem | null) => {
    setFormError(null);
    setIsActive(item?.is_active ?? true);
    setPosition(
      item?.is_active
        ? item.display_order
        : nextPosition(itemRowsFor(category))
    );
    setItemName(item?.name ?? "");
    setPriceText(item?.price ?? "");
    setBenchmarkKey(item?.benchmark_key ?? "");
    // An item with no serves recorded yet gets them read off its display text,
    // so the editor opens on what the menu already says rather than blank.
    const existing = item?.menu_item_prices?.length
      ? item.menu_item_prices.map((p) => ({ serve: p.serve, amount: p.amount }))
      : parsePriceText(item?.price);
    setServeDrafts(existing.map((p) => ({ serve: p.serve, amount: p.amount.toFixed(2) })));
    setSheet({
      type: "edit-item",
      categoryId: category.id,
      itemId: item?.id ?? null,
    });
  };

  const openServes = () => {
    if (!sheetCategory) return;
    setServesBefore(serveDrafts);
    setSheet({
      type: "edit-serves",
      categoryId: sheetCategory.id,
      itemId: sheetItem?.id ?? null,
    });
  };

  const backToItem = () => {
    if (sheet?.type !== "edit-serves") return;
    setSheet({ type: "edit-item", categoryId: sheet.categoryId, itemId: sheet.itemId });
  };

  const cancelServes = () => {
    setServeDrafts(servesBefore);
    backToItem();
  };

  // Coming back from the serves, the display text is rewritten from them, so
  // what the public menu shows and what the comparison reads cannot drift.
  const applyServes = () => {
    const prices = draftPrices(serveDrafts);
    setServeDrafts(prices.map((p) => ({ serve: p.serve, amount: p.amount.toFixed(2) })));
    if (prices.length) setPriceText(formatPriceText(prices));
    backToItem();
  };

  const reorderPrompt = (name: string) => {
    if (wasActive && !isActive) {
      return `Making "${name}" inactive will set its display order to 0 and update:`;
    }
    if (!wasActive && isActive) {
      return `Making "${name}" active will place it at display order ${plan.position} and update:`;
    }
    return `Moving "${name}" to display order ${plan.position} will also update:`;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sheet?.type !== "edit-category" && sheet?.type !== "edit-item") return;

    const formData = new FormData(e.currentTarget);
    setFormError(null);

    const isCategory = sheet.type === "edit-category";
    const name = formData.get("name")?.toString().trim() || `this ${entityLabel}`;

    const submit = () =>
      startTransition(async () => {
        const result = isCategory
          ? await saveCategoryAction(formData)
          : await saveItemAction(formData);
        if (result?.error) setFormError(result.error);
        else backToView();
      });

    if (affected.length === 0) {
      submit();
      return;
    }

    void (async () => {
      const ok = await confirm({
        title: isCategory ? "Reorder categories" : "Reorder menu items",
        description: reorderPrompt(name),
        content: <ChangeList changes={affected} />,
        confirmLabel: "Update order",
      });
      if (ok) submit();
    })();
  };

  const handleCategoryDelete = async (category: MenuCategory) => {
    const cascade = describeChanges(
      categoryRows,
      planDelete(categoryRows, category.id)
    );
    const ok = await confirm({
      title: "Delete category",
      description:
        cascade.length > 0
          ? "This will delete the category and all its items. These display orders will shift up:"
          : "This will delete the category and all its items. Are you sure?",
      content: cascade.length > 0 ? <ChangeList changes={cascade} /> : undefined,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (result?.error) setFormError(result.error);
      else closeSheet();
    });
  };

  const handleItemDelete = async (category: MenuCategory, item: MenuItem) => {
    const rows = itemRowsFor(category);
    const cascade = describeChanges(rows, planDelete(rows, item.id));
    const ok = await confirm({
      title: "Delete item",
      description:
        cascade.length > 0
          ? "Are you sure you want to remove this menu item? These display orders will shift up:"
          : "Are you sure you want to remove this menu item?",
      content: cascade.length > 0 ? <ChangeList changes={cascade} /> : undefined,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteItemAction(item.id);
      if (result?.error) setFormError(result.error);
      else closeSheet();
    });
  };

  const handleSheetEdit = () => {
    if (sheet?.type === "view-category" && sheetCategory) startEditCategory(sheetCategory);
    else if (sheetCategory && sheetItem) startEditItem(sheetCategory, sheetItem);
  };

  const handleSheetDelete = () => {
    if (sheet?.type === "view-category" && sheetCategory) void handleCategoryDelete(sheetCategory);
    else if (sheetCategory && sheetItem) void handleItemDelete(sheetCategory, sheetItem);
  };

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      <iframe
        id="menu-print-frame"
        src="/menu"
        className="hidden"
        title="Menu print frame"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 sm:flex-1">
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search the menu"
            placeholder="Search by category or item"
          />
        </div>
        <p className="hidden shrink-0 text-[11px] font-medium text-admin-muted sm:block">
          {initialCategories.length} categories &middot; {itemCount} items
        </p>
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => printMenuPage()}
            title="Print menu"
            className={ICON_BUTTON}
          >
            <Printer className="h-4 w-4 text-admin-muted" />
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            title="Import a menu from a PDF or photo"
            className={ICON_BUTTON}
          >
            <FileUp className="h-4 w-4 text-admin-muted" />
          </button>
          <button
            type="button"
            onClick={handleBackfillServes}
            disabled={isFilling}
            title="Read serves from existing prices"
            className={cn(ICON_BUTTON, "hidden sm:flex")}
          >
            <ListOrdered className="h-4 w-4 text-admin-muted" />
          </button>
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={isFilling}
            title="Auto-fill price comparison rounds"
            className={cn(ICON_BUTTON, "hidden sm:flex")}
          >
            {isFilling ? (
              <Loader2 className="h-4 w-4 animate-spin text-admin-muted" />
            ) : (
              <Wand2 className="h-4 w-4 text-admin-muted" />
            )}
          </button>
          <button
            type="button"
            onClick={() => startEditCategory(null)}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-admin-primary px-3 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover sm:h-9"
          >
            <Plus className="h-4 w-4" />
            Category
          </button>
        </div>
      </div>

      {initialCategories.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No menu categories yet"
          description="Add a category to start building your menu"
        />
      ) : shownGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-admin-line px-4 py-12 text-center">
          <SearchX className="mb-1 h-7 w-7 text-admin-muted opacity-30" />
          <p className="text-sm font-semibold text-admin-ink">No matches</p>
          <p className="text-[11px] text-admin-muted">
            Nothing on the menu matches &ldquo;{query.trim()}&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shownGroups.map(({ cat, items }) => (
            <RecordList
              key={cat.id}
              variant="panel"
              title={cat.name}
              count={items.length}
              badge={<ActivePill active={cat.is_active} />}
              subtitle={cat.note}
              // Searching forces every group open - a hit behind a collapsed
              // header reads as no result at all.
              collapsible={!searching}
              actions={
                <button
                  type="button"
                  onClick={() => setSheet({ type: "view-category", categoryId: cat.id })}
                  title={`View ${cat.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary sm:h-8 sm:w-8"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              }
              onAdd={() => startEditItem(cat, null)}
              addLabel="Item"
            >
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-[11px] text-admin-muted">
                  No items - use the add button to create one
                </p>
              ) : (
                items.map((item) => (
                  <ListRow
                    key={item.id}
                    onClick={() =>
                      setSheet({ type: "view-item", categoryId: cat.id, itemId: item.id })
                    }
                    status={<ActivePill active={item.is_active} />}
                  >
                    {/* Fixed tracks, not content-sized ones - an "auto" column
                        takes its width from that row's own badges, which is what
                        leaves every price starting somewhere different. */}
                    <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[3rem_minmax(0,1fr)_16rem_11rem] sm:items-center sm:gap-3">
                      <p className="hidden text-[11px] font-medium text-admin-muted sm:block">
                        <span className="sr-only">Display order</span>
                        <span className="tabular-nums">
                          {item.is_active ? `#${item.display_order}` : "-"}
                        </span>
                      </p>

                      <p
                        className={cn(
                          "min-w-0 truncate text-sm leading-snug font-semibold",
                          item.is_active ? "text-admin-ink" : "text-admin-muted"
                        )}
                      >
                        {item.name}
                      </p>

                      <p className="mt-0.5 truncate text-[11px] font-semibold text-admin-muted sm:mt-0 sm:text-[12px]">
                        {item.price}
                      </p>

                      <div className="hidden items-center gap-2 sm:flex">
                        <InfoBadge icon={null}>{servesOf(item)}</InfoBadge>
                      </div>
                    </div>
                  </ListRow>
                ))
              )}
            </RecordList>
          ))}
        </div>
      )}

      <MenuImportSheet open={importOpen} onClose={() => setImportOpen(false)} />

      <RecordSheet
        open={!!sheet}
        onClose={closeSheet}
        mode={sheetMode}
        title={sheetTitle}
        recordId={headerRecord?.id}
        formId={sheet?.type === "edit-serves" ? "serves-form" : "menu-form"}
        isPending={isPending}
        saveDisabled={saveDisabled}
        onEdit={sheetMode === "view" ? handleSheetEdit : undefined}
        onDelete={sheetMode === "view" ? handleSheetDelete : undefined}
        onCancel={
          sheet?.type === "edit-serves"
            ? cancelServes
            : isNewRecord
            ? closeSheet
            : backToView
        }
        confirmUI={ConfirmDialogUI}
        status={headerRecord && !isEditing && <ActivePill active={headerRecord.is_active} showLabelOnMobile />}
        systemInfo={
          headerRecord == null
            ? undefined
            : {
                createdAt: headerRecord.created_at,
                createdBy: employeeName(headerRecord.created_by),
                updatedAt: headerRecord.updated_at,
                updatedBy: employeeName(headerRecord.updated_by),
              }
        }
      >
        {sheet?.type === "view-category" && sheetCategory && (
          <div className="animate-in space-y-4 duration-200 fade-in">
            <DetailCard>
              <DetailCell label="Name" value={sheetCategory.name} />
              <DetailCell label="Note" value={sheetCategory.note || "-"} />
              <DetailCell
                label="Mixer extra"
                value={
                  sheetCategory.mixer_surcharge
                    ? `£${sheetCategory.mixer_surcharge.toFixed(2)}`
                    : "-"
                }
              />
              <DetailCell
                label="Order"
                value={
                  sheetCategory.is_active
                    ? String(sheetCategory.display_order)
                    : "0 (inactive)"
                }
              />
              <DetailCell label="Items" value={String(sheetCategory.menu_items.length)} />
            </DetailCard>
            {formError && <ErrorBox message={formError} />}
          </div>
        )}

        {sheet?.type === "edit-category" && (
          <form
            id="menu-form"
            onSubmit={handleSubmit}
            className="animate-in space-y-4 duration-200 fade-in"
          >
            {sheetCategory && <input type="hidden" name="id" value={sheetCategory.id} />}
            <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />
            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Name" required>
                <input
                  name="name"
                  required
                  aria-label="Name"
                  placeholder="e.g. Cocktails"
                  defaultValue={sheetCategory?.name ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Note">
                <input
                  name="note"
                  aria-label="Note"
                  placeholder="e.g. +£1.45 for mixers"
                  defaultValue={sheetCategory?.note ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Mixer extra">
                <input
                  name="mixer_surcharge"
                  type="number"
                  step="0.05"
                  min="0"
                  inputMode="decimal"
                  aria-label="Mixer surcharge"
                  placeholder="e.g. 1.45"
                  defaultValue={sheetCategory?.mixer_surcharge ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Status">
                <StatusToggle value={isActive} onChange={setIsActive} />
              </FormRow>
              <FormRow label="Order">
                <OrderField
                  canChoose={canChoosePosition}
                  value={position}
                  onChange={setPosition}
                  resolved={plan.position}
                  max={activeCount}
                />
              </FormRow>
              <OrderHint
                isActive={isActive}
                canChoose={canChoosePosition}
                activeCount={activeCount}
                resolved={plan.position}
                entityLabel="Categories"
              />
            </DetailCard>
            {formError && <ErrorBox message={formError} />}
          </form>
        )}

        {sheet?.type === "view-item" && sheetItem && sheetCategory && (
          <div className="animate-in space-y-4 duration-200 fade-in">
            <DetailCard>
              <DetailCell label="Name" value={sheetItem.name} />
              <DetailCell label="Price" value={sheetItem.price} />
              <DetailCell label="Category" value={sheetCategory.name} />
              <DetailCell
                label="Serves"
                value={
                  sheetItem.menu_item_prices.length
                    ? sheetItem.menu_item_prices.map((p) => p.serve).join(", ")
                    : "None recorded"
                }
              />
              <DetailCell
                label="Compares as"
                value={benchmarkSummary(sheetItem, sheetCategory.name, benchmarks)}
              />
              <DetailCell
                label="Order"
                value={
                  sheetItem.is_active ? String(sheetItem.display_order) : "0 (inactive)"
                }
              />
            </DetailCard>
            {formError && <ErrorBox message={formError} />}
          </div>
        )}

        {sheet?.type === "edit-item" && sheetCategory && (
          <form
            id="menu-form"
            onSubmit={handleSubmit}
            className="animate-in space-y-4 duration-200 fade-in"
          >
            {sheetItem && <input type="hidden" name="id" value={sheetItem.id} />}
            <input type="hidden" name="category_id" value={sheetCategory.id} />
            <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />
            <input type="hidden" name="serves" value={JSON.stringify(draftPrices(serveDrafts))} />
            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Name" required>
                <input
                  name="name"
                  required
                  aria-label="Name"
                  placeholder="e.g. Espresso Martini"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Price" required>
                <input
                  name="price"
                  required
                  aria-label="Price"
                  placeholder="e.g. £8.95"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Serves" required>
                <button
                  type="button"
                  onClick={openServes}
                  className={cn(
                    "flex flex-1 items-center justify-end gap-1.5 text-right text-[13px] font-semibold",
                    servesMissing ? "text-admin-error" : "text-admin-primary"
                  )}
                >
                  {serveSummary(serveDrafts)}
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              </FormRow>
              <FormRow label="Compares as">
                <select
                  name="benchmark_key"
                  aria-label="Price comparison round"
                  value={benchmarkKey}
                  onChange={(e) => setBenchmarkKey(e.target.value)}
                  className="flex-1 cursor-pointer appearance-none bg-transparent text-right text-[13px] font-semibold text-admin-ink outline-none"
                >
                  <option value="">Auto - set from the name on save</option>
                  {benchmarks
                    .filter((b) => b.is_active)
                    .map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  <option value={NOT_COMPARED}>Not compared</option>
                </select>
              </FormRow>
              <FormRow label="Status">
                <StatusToggle value={isActive} onChange={setIsActive} />
              </FormRow>
              <FormRow label="Order">
                <OrderField
                  canChoose={canChoosePosition}
                  value={position}
                  onChange={setPosition}
                  resolved={plan.position}
                  max={activeCount}
                />
              </FormRow>
              <OrderHint
                isActive={isActive}
                canChoose={canChoosePosition}
                activeCount={activeCount}
                resolved={plan.position}
                entityLabel="Items in this category"
              />
            </DetailCard>
            {servesMissing && (
              <p className="px-1 text-[11px] font-medium text-admin-error">
                At least one serve and price is needed before this item can be saved.
              </p>
            )}
            {formError && <ErrorBox message={formError} />}
          </form>
        )}

        {sheet?.type === "edit-serves" && (
          <form
            id="serves-form"
            onSubmit={(e) => {
              e.preventDefault();
              applyServes();
            }}
            className="animate-in space-y-4 duration-200 fade-in"
          >
            <p className="text-[12px] leading-snug text-admin-muted">
              One row per measure you sell it in. The price comparison takes the serve
              each round asks for, so a half pint never stands in for the pint.
            </p>

            <DetailCard className="divide-y divide-admin-line/50">
              {serveDrafts.length === 0 && (
                <p className="px-4 py-4 text-center text-[12px] text-admin-error">
                  No serves yet - add at least one below.
                </p>
              )}
              {serveDrafts.map((row, index) => (
                <div key={index} className="flex items-center gap-2 px-4 py-2.5">
                  <select
                    aria-label={`Serve ${index + 1}`}
                    value={row.serve}
                    onChange={(e) =>
                      setServeDrafts((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, serve: e.target.value } : r))
                      )
                    }
                    className="min-w-0 flex-1 cursor-pointer bg-transparent text-[13px] font-semibold text-admin-ink outline-none"
                  >
                    {SERVES.map((serve) => (
                      <option key={serve} value={serve}>
                        {serve}
                      </option>
                    ))}
                  </select>
                  <span className="text-[13px] font-semibold text-admin-muted">£</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    inputMode="decimal"
                    aria-label={`Amount for serve ${index + 1}`}
                    value={row.amount}
                    onChange={(e) =>
                      setServeDrafts((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r))
                      )
                    }
                    className="w-20 bg-transparent text-right text-[13px] font-semibold text-admin-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setServeDrafts((prev) => prev.filter((_, i) => i !== index))}
                    title={`Remove serve ${index + 1}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-admin-error hover:bg-admin-error-bg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </DetailCard>

            <button
              type="button"
              onClick={() =>
                setServeDrafts((prev) => [
                  ...prev,
                  { serve: nextUnusedServe(prev), amount: "" },
                ])
              }
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-admin-primary bg-admin-card text-[13px] font-semibold text-admin-primary hover:bg-admin-primary-soft"
            >
              <Plus className="h-4 w-4" />
              Add serve
            </button>

            <div className="rounded-2xl border border-admin-line bg-admin-surface px-4 py-3">
              <p className="text-[11px] font-semibold tracking-wide text-admin-muted">
                Price will read
              </p>
              <p className="mt-1 text-[14px] font-bold text-admin-ink">
                {formatPriceText(draftPrices(serveDrafts)) || "-"}
              </p>
            </div>
          </form>
        )}
      </RecordSheet>
    </div>
  );
}

function StatusToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label="Status"
      onClick={() => onChange(!value)}
      className="flex h-11 flex-1 items-center justify-end gap-2.5"
    >
      <span className="text-[13px] font-semibold text-admin-ink">
        {value ? "Active" : "Inactive"}
      </span>
      <span
        className={cn(
          "relative h-6.5 w-11 shrink-0 rounded-full transition-colors",
          value ? "bg-admin-primary" : "bg-admin-line"
        )}
      >
        <span
          className={cn(
            "absolute top-0.75 left-0.75 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform",
            value && "translate-x-4.5"
          )}
        />
      </span>
    </button>
  );
}

function OrderField({
  canChoose,
  value,
  onChange,
  resolved,
  max,
}: {
  canChoose: boolean;
  value: number;
  onChange: (next: number) => void;
  resolved: number;
  max: number;
}) {
  if (canChoose) {
    return (
      <input
        name="display_order"
        type="number"
        min={1}
        max={max}
        inputMode="numeric"
        aria-label="Display order"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 bg-transparent text-right text-[13px] font-semibold text-admin-ink outline-none tabular-nums"
      />
    );
  }
  return (
    <input
      name="display_order"
      type="number"
      readOnly
      aria-label="Display order"
      value={resolved}
      className="flex-1 cursor-not-allowed bg-transparent text-right text-[13px] font-semibold text-admin-muted opacity-60 outline-none tabular-nums"
    />
  );
}

function OrderHint({
  isActive,
  canChoose,
  activeCount,
  resolved,
  entityLabel,
}: {
  isActive: boolean;
  canChoose: boolean;
  activeCount: number;
  resolved: number;
  entityLabel: string;
}) {
  const text = !isActive
    ? "Inactive records have display order 0 and are hidden from the public menu."
    : canChoose
    ? `${entityLabel} run 1 to ${activeCount}. Changing this reorders the others.`
    : `Added to the end of the list at display order ${resolved}.`;

  return (
    <div className="px-4 pt-0 pb-3">
      <p className="text-[11px] font-medium text-admin-muted">{text}</p>
    </div>
  );
}

function ChangeList({ changes }: { changes: ChangeDescription[] }) {
  return (
    <ul className="divide-y divide-admin-line overflow-hidden rounded-2xl border border-admin-line bg-admin-card">
      {changes.map((change) => (
        <li
          key={change.id}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-admin-ink">
            {change.name}
          </span>
          <span className="shrink-0 text-[12px] font-semibold text-admin-muted tabular-nums">
            {change.from} → {change.to}
          </span>
        </li>
      ))}
    </ul>
  );
}
