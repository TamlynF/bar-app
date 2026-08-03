"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Loader2,
  ChevronDown,
  Save,
  Pencil,
  Trash2,
  AlertCircle,
  UtensilsCrossed,
  GripVertical,
  Printer,
  Download,
  Info,
} from "lucide-react";
import {
  saveCategoryAction,
  deleteCategoryAction,
  saveItemAction,
  deleteItemAction,
} from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
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

export type MenuItem = AuditFields & {
  id: number;
  category_id: number;
  name: string;
  price: string;
  display_order: number;
  is_active: boolean;
};

export type MenuCategory = AuditFields & {
  id: number;
  name: string;
  note: string | null;
  display_order: number;
  is_active: boolean;
  menu_items: MenuItem[];
};

export type EmployeeOption = { id: number; full_name: string | null };

type SheetMode =
  | { type: "view-category"; categoryId: number }
  | { type: "edit-category"; categoryId: number | null }
  | { type: "view-item"; categoryId: number; itemId: number }
  | { type: "edit-item"; categoryId: number; itemId: number | null };

const SHEET_PILL =
  "inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold tracking-wide sm:h-8 sm:gap-2 sm:px-3.5 sm:text-[12px]";

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

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MenuClient({
  initialCategories = [],
  employees = [],
}: {
  initialCategories: MenuCategory[];
  employees?: EmployeeOption[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState(1);

  const employeeById = new Map(
    employees.map((e) => [e.id, e.full_name ?? "-"] as const)
  );
  const employeeName = (id?: number | null) =>
    id ? employeeById.get(id) ?? "-" : "-";

  const categoryRows = initialCategories.map(toOrderRow);
  const itemRowsFor = (cat: MenuCategory | null) =>
    (cat?.menu_items ?? []).map(toOrderRow);

  const sheetCategory =
    sheet && sheet.categoryId != null
      ? initialCategories.find((c) => c.id === sheet.categoryId) ?? null
      : null;

  const sheetItem =
    sheet &&
    (sheet.type === "view-item" || sheet.type === "edit-item") &&
    sheet.itemId != null
      ? sheetCategory?.menu_items.find((i) => i.id === sheet.itemId) ?? null
      : null;

  const isItemSheet =
    sheet?.type === "view-item" || sheet?.type === "edit-item";
  const isEditing =
    sheet?.type === "edit-category" || sheet?.type === "edit-item";

  const entityLabel = isItemSheet ? "menu item" : "category";
  const orderRows = isItemSheet ? itemRowsFor(sheetCategory) : categoryRows;
  const activeCount = orderRows.filter((row) => row.is_active).length;

  const editingRecord =
    sheet?.type === "edit-category"
      ? sheetCategory
      : sheet?.type === "edit-item"
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

  const sheetTitle =
    sheet?.type === "view-category"
      ? "View Category"
      : sheet?.type === "edit-category"
      ? sheet.categoryId
        ? "Edit Category"
        : "New Category"
      : sheet?.type === "view-item"
      ? "View Menu Item"
      : sheet?.type === "edit-item"
      ? sheet.itemId
        ? "Edit Menu Item"
        : "New Menu Item"
      : "";

  const closeSheet = () => {
    setSheet(null);
    setFormError(null);
  };

  const printMenuPage = () => {
    const frame = document.getElementById("menu-print-frame") as HTMLIFrameElement | null;
    if (frame?.contentWindow) {
      frame.contentWindow.print();
    }
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
    setSheet({
      type: "edit-item",
      categoryId: category.id,
      itemId: item?.id ?? null,
    });
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
        else closeSheet();
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

  return (
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      <iframe
        id="menu-print-frame"
        src="/menu"
        className="hidden"
        title="Menu print frame"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-[#20231A]">
            Menu
          </h3>
          <p className="text-[11px] font-medium text-[#5E6654]">
            {initialCategories.length} categories &middot;{" "}
            {initialCategories.reduce(
              (sum, c) => sum + c.menu_items.length,
              0
            )}{" "}
            items
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => printMenuPage()}
            title="Print menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#D8D5C8] bg-white transition-colors hover:bg-[#F4F1E8] sm:h-9 sm:w-9"
          >
            <Printer className="h-4 w-4 text-[#5E6654]" />
          </button>
          <button
            type="button"
            onClick={() => printMenuPage()}
            title="Save menu as PDF"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#D8D5C8] bg-white transition-colors hover:bg-[#F4F1E8] sm:h-9 sm:w-9"
          >
            <Download className="h-4 w-4 text-[#5E6654]" />
          </button>
          <button
            type="button"
            onClick={() => startEditCategory(null)}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-[#34451F] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#283719] sm:h-9"
          >
            <Plus className="h-4 w-4" />
            Category
          </button>
        </div>
      </div>

      {initialCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D5C8] py-14 text-center">
          <UtensilsCrossed className="mx-auto mb-3 h-8 w-8 text-[#5E6654] opacity-30" />
          <p className="text-sm font-bold text-[#20231A]">
            No menu categories yet
          </p>
          <p className="mt-1 text-[11px] text-[#5E6654]">
            Add a category to start building your menu
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialCategories.map((cat) => {
            const isCollapsed = collapsed[cat.id] ?? false;
            return (
              <section
                key={cat.id}
                className="overflow-hidden rounded-2xl border border-[#D8D5C8] bg-white"
              >
                <div className="flex items-center gap-1.5 bg-[#F4F1E8] px-3 py-2.5 sm:px-4">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((p) => ({
                        ...p,
                        [cat.id]: !isCollapsed,
                      }))
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-[11px] font-bold tracking-wide uppercase",
                          cat.is_active ? "text-[#34451F]" : "text-[#5E6654]"
                        )}
                      >
                        {cat.name}{" "}
                        <span className="text-[#5E6654]">
                          ({cat.menu_items.length})
                        </span>
                      </span>
                      <StatusPill active={cat.is_active} compact />
                    </span>
                    {cat.note && (
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-[#5E6654]">
                        {cat.note}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSheet({ type: "view-category", categoryId: cat.id })
                    }
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[#D8D5C8]"
                    title="View category"
                  >
                    <Pencil className="h-3 w-3 text-[#5E6654]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditItem(cat, null)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#34451F] text-white transition-colors hover:bg-[#283719]"
                    title="Add item"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((p) => ({
                        ...p,
                        [cat.id]: !isCollapsed,
                      }))
                    }
                    className="shrink-0"
                    title="Toggle category items"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-[#5E6654] transition-transform duration-200",
                        !isCollapsed && "rotate-180"
                      )}
                    />
                  </button>
                </div>

                {!isCollapsed && cat.menu_items.length > 0 && (
                  <div className="divide-y divide-[#D8D5C8]/50">
                    {cat.menu_items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          setSheet({
                            type: "view-item",
                            categoryId: cat.id,
                            itemId: item.id,
                          })
                        }
                        className={cn(
                          "flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-[#F4F1E8]/50 sm:px-4",
                          !item.is_active && "opacity-40"
                        )}
                      >
                        <GripVertical className="h-3 w-3 shrink-0 text-[#D8D5C8]" />
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#20231A]">
                          {item.name}
                        </span>
                        <span className="shrink-0 text-right text-[11px] font-bold text-[#5E6654]">
                          {item.price}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!isCollapsed && cat.menu_items.length === 0 && (
                  <div className="px-4 py-4 text-center text-[11px] text-[#5E6654]">
                    No items - tap + to add
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Sheet
        open={!!sheet}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-auto max-h-[75vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#D8D5C8]
            bg-[#F4F1E8] p-0 shadow-2xl outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:max-h-[70vh]
            sm:w-140 sm:-translate-x-1/2 sm:rounded-4xl
            sm:border-2 sm:border-[#D8D5C8]"
        >
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#D8D5C8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg leading-tight font-bold tracking-tight text-[#20231A]">
                  {sheetTitle}
                </SheetTitle>
                {headerRecord && (
                  <p className="mt-0.5 text-[12px] font-medium text-[#5E6654] tabular-nums">
                    #{headerRecord.id}
                  </p>
                )}
              </div>
              {headerRecord && (
                <div className="flex shrink-0 items-center gap-2">
                  {!isEditing && <StatusPill active={headerRecord.is_active} />}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="System information"
                        title="Creation and modification details"
                        className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#D8D5C8] bg-[#ECE9DE] px-3 text-[#20231A] transition-colors hover:bg-[#D8D5C8]"
                      >
                        <Info className="h-4.5 w-4.5 shrink-0" />
                        <span className="hidden text-[13px] font-semibold sm:inline">
                          System
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-80 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white p-0"
                    >
                      <span className="block border-b border-[#D8D5C8] bg-[#D8D5C8] px-4 py-2.5 text-[12px] font-bold text-[#34451F]">
                        System Information
                      </span>
                      <InfoRow
                        label="ID"
                        value={
                          <span className="tabular-nums">
                            #{headerRecord.id}
                          </span>
                        }
                      />
                      <InfoRow
                        label="Created"
                        value={formatDateTime(headerRecord.created_at)}
                      />
                      <InfoRow
                        label="Created By"
                        value={employeeName(headerRecord.created_by)}
                      />
                      <InfoRow
                        label="Last Modified"
                        value={formatDateTime(headerRecord.updated_at)}
                      />
                      <InfoRow
                        label="Modified By"
                        value={employeeName(headerRecord.updated_by)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {sheet?.type === "view-category" && sheetCategory && (
              <div className="space-y-3">
                <DetailCell label="Name" value={sheetCategory.name} />
                <DetailCell label="Note" value={sheetCategory.note || "-"} />
                <DetailCell
                  label="Order"
                  value={
                    sheetCategory.is_active
                      ? String(sheetCategory.display_order)
                      : "0 (inactive)"
                  }
                />
                <DetailCell
                  label="Items"
                  value={String(sheetCategory.menu_items.length)}
                />
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {sheet?.type === "edit-category" && (
              <form id="menu-form" onSubmit={handleSubmit} className="space-y-3">
                {sheetCategory && (
                  <input type="hidden" name="id" value={sheetCategory.id} />
                )}
                <input
                  type="hidden"
                  name="is_active"
                  value={isActive ? "true" : "false"}
                />
                <div className="divide-y divide-[#D8D5C8]/50 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white">
                  <FormRow label="Name" required>
                    <input name="name" required aria-label="Name" placeholder="e.g. Cocktails" defaultValue={sheetCategory?.name ?? ""} className="flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>
                  <FormRow label="Note">
                    <input name="note" aria-label="Note" placeholder="e.g. +£1.45 for mixers" defaultValue={sheetCategory?.note ?? ""} className="flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
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
                </div>
                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            {sheet?.type === "view-item" && sheetItem && sheetCategory && (
              <div className="space-y-3">
                <DetailCell label="Name" value={sheetItem.name} />
                <DetailCell label="Price" value={sheetItem.price} />
                <DetailCell label="Category" value={sheetCategory.name} />
                <DetailCell
                  label="Order"
                  value={
                    sheetItem.is_active
                      ? String(sheetItem.display_order)
                      : "0 (inactive)"
                  }
                />
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {sheet?.type === "edit-item" && sheetCategory && (
              <form id="menu-form" onSubmit={handleSubmit} className="space-y-3">
                {sheetItem && (
                  <input type="hidden" name="id" value={sheetItem.id} />
                )}
                <input type="hidden" name="category_id" value={sheetCategory.id} />
                <input
                  type="hidden"
                  name="is_active"
                  value={isActive ? "true" : "false"}
                />
                <div className="divide-y divide-[#D8D5C8]/50 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white">
                  <FormRow label="Name" required>
                    <input name="name" required aria-label="Name" placeholder="e.g. Espresso Martini" defaultValue={sheetItem?.name ?? ""} className="flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>
                  <FormRow label="Price" required>
                    <input name="price" required aria-label="Price" placeholder="e.g. £8.95" defaultValue={sheetItem?.price ?? ""} className="flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
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
                </div>
                {formError && <ErrorBox message={formError} />}
              </form>
            )}
          </div>

          <div className="z-40 shrink-0 border-t-2 border-[#D8D5C8] bg-white/80 px-6 py-4 pb-8 backdrop-blur-md sm:rounded-b-4xl sm:pb-4">
            {(sheet?.type === "view-category" || sheet?.type === "view-item") && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (sheet.type === "view-category" && sheetCategory)
                      handleCategoryDelete(sheetCategory);
                    else if (sheetCategory && sheetItem)
                      handleItemDelete(sheetCategory, sheetItem);
                  }}
                  disabled={isPending}
                  className="h-12 rounded-2xl border border-[#D8D5C8] bg-white text-[13px] font-semibold text-[#B33A32] hover:border-[#B33A32]/30 hover:bg-[#FDECEA] hover:text-[#B33A32]"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (sheet.type === "view-category" && sheetCategory)
                      startEditCategory(sheetCategory);
                    else if (sheetCategory && sheetItem)
                      startEditItem(sheetCategory, sheetItem);
                  }}
                  className="h-12 rounded-2xl border border-[#34451F] bg-white text-[13px] font-semibold text-[#34451F] hover:bg-[#E5EBD8] hover:text-[#34451F] active:scale-95"
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
              </div>
            )}

            {isEditing && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeSheet}
                  disabled={isPending}
                  className="h-12 rounded-2xl border border-[#D8D5C8] bg-white text-[13px] font-semibold text-[#5E6654] hover:bg-[#ECE9DE]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="menu-form"
                  disabled={isPending}
                  className="h-12 rounded-2xl bg-[#34451F] text-[13px] font-semibold text-white shadow-lg hover:bg-[#283719] active:scale-95"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1.5 h-4 w-4" />Save</>}
                </Button>
              </div>
            )}
          </div>
          {ConfirmDialogUI}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusPill({ active, compact }: { active: boolean; compact?: boolean }) {
  const tone = active
    ? "border-[#22613F]/30 bg-[#E7F3EC] text-[#22613F]"
    : "border-[#B33A32]/30 bg-[#FDECEA] text-[#B33A32]";
  if (compact) {
    return (
      <span
        className={cn(
          "shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
          tone
        )}
      >
        {active ? "Active" : "Inactive"}
      </span>
    );
  }
  return (
    <span className={cn(SHEET_PILL, tone)}>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2",
          active ? "bg-[#22613F]" : "bg-[#B33A32]"
        )}
      />
      {active ? "Active" : "Inactive"}
    </span>
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
      <span className="text-[13px] font-semibold text-[#20231A]">
        {value ? "Active" : "Inactive"}
      </span>
      <span
        className={cn(
          "relative h-6.5 w-11 shrink-0 rounded-full transition-colors",
          value ? "bg-[#34451F]" : "bg-[#DCD5C0]"
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
        className="flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none tabular-nums"
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
      className="flex-1 cursor-not-allowed bg-transparent text-right text-[13px] font-semibold text-[#5E6654] opacity-60 outline-none tabular-nums"
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
      <p className="text-[11px] font-medium text-[#5E6654]">{text}</p>
    </div>
  );
}

function ChangeList({ changes }: { changes: ChangeDescription[] }) {
  return (
    <ul className="divide-y divide-[#D8D5C8] overflow-hidden rounded-2xl border border-[#D8D5C8] bg-white">
      {changes.map((change) => (
        <li
          key={change.id}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#20231A]">
            {change.name}
          </span>
          <span className="shrink-0 text-[12px] font-semibold text-[#5E6654] tabular-nums">
            {change.from} → {change.to}
          </span>
        </li>
      ))}
    </ul>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0">
      <span className="shrink-0 pt-0.5 text-[12px] font-bold text-[#5E6654]">
        {label}
      </span>
      <span className="text-right text-[13px] font-semibold text-[#20231A]">
        {value || "-"}
      </span>
    </div>
  );
}

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5E6654] opacity-60">
        <span className="text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase">{label}</span>
        {required && <span className="text-[11px] font-semibold text-[#B33A32]">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#D8D5C8] bg-white px-4 py-2.5">
      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-[#5E6654] uppercase opacity-60">{label}</span>
      <span className="flex-1 text-right text-[13px] font-semibold break-all text-[#20231A]">{value}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#B33A32]/30 bg-[#FDECEA] p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B33A32]" />
      <p className="text-[13px] leading-snug font-semibold text-[#B33A32]">{message}</p>
    </div>
  );
}
