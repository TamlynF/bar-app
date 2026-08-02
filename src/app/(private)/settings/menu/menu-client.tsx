"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
} from "lucide-react";
import {
  saveCategoryAction,
  deleteCategoryAction,
  saveItemAction,
  deleteItemAction,
} from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

type MenuItem = {
  id: number;
  category_id: number;
  name: string;
  price: string;
  display_order: number;
  is_active: boolean;
};

type MenuCategory = {
  id: number;
  name: string;
  note: string | null;
  display_order: number;
  is_active: boolean;
  menu_items: MenuItem[];
};

type SheetMode =
  | { type: "view-category"; category: MenuCategory }
  | { type: "edit-category"; category: MenuCategory | null } // null = new
  | { type: "view-item"; item: MenuItem; category: MenuCategory }
  | { type: "edit-item"; item: MenuItem | null; category: MenuCategory }; // null = new

export default function MenuClient({
  initialCategories = [],
}: {
  initialCategories: MenuCategory[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [sheet, setSheet] = useState<SheetMode | null>(null);

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

  const handleCategorySave = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveCategoryAction(formData);
      if (result?.error) setFormError(result.error);
      else closeSheet();
    });
  };

  const handleCategoryDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete category",
      description:
        "This will delete the category and all its items. Are you sure?",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (result?.error) setFormError(result.error);
      else closeSheet();
    });
  };

  const handleItemSave = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveItemAction(formData);
      if (result?.error) setFormError(result.error);
      else closeSheet();
    });
  };

  const handleItemDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete item",
      description: "Are you sure you want to remove this menu item?",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteItemAction(id);
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
          <h3 className="font-black text-base tracking-tight text-[#20231A] uppercase">
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
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D8D5C8] bg-white transition-colors hover:bg-[#F4F1E8]"
          >
            <Printer className="h-3.5 w-3.5 text-[#5E6654]" />
          </button>
          <button
            type="button"
            onClick={() => printMenuPage()}
            title="Save menu as PDF"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D8D5C8] bg-white transition-colors hover:bg-[#F4F1E8]"
          >
            <Download className="h-3.5 w-3.5 text-[#5E6654]" />
          </button>
          <button
            type="button"
            onClick={() =>
              setSheet({ type: "edit-category", category: null })
            }
            className="flex h-7 items-center gap-1.5 rounded-lg bg-[#34451F] px-2.5 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#283719]"
          >
            <Plus className="h-3.5 w-3.5" />
            Category
          </button>
        </div>
      </div>

      {initialCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D5C8] py-14 text-center">
          <UtensilsCrossed className="mx-auto mb-3 h-8 w-8 text-[#5E6654] opacity-30" />
          <p className="font-black text-sm text-[#20231A]">
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
                    <p className="truncate text-[11px] font-bold tracking-wide text-[#34451F] uppercase">
                      {cat.name}{" "}
                      <span className="text-[#5E6654]">
                        ({cat.menu_items.length})
                      </span>
                    </p>
                    {cat.note && (
                      <p className="mt-0.5 truncate text-[9px] font-medium text-[#5E6654]">
                        {cat.note}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSheet({ type: "view-category", category: cat })
                    }
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[#D8D5C8]"
                    title="Edit category"
                  >
                    <Pencil className="h-3 w-3 text-[#5E6654]" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSheet({
                        type: "edit-item",
                        item: null,
                        category: cat,
                      })
                    }
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
                            item,
                            category: cat,
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
            <SheetTitle className="font-black text-lg leading-tight tracking-tighter text-[#20231A] uppercase">
              {sheet?.type === "edit-category"
                ? sheet.category
                  ? "Edit Category"
                  : "New Category"
                : sheet?.type === "view-category"
                ? "Category"
                : sheet?.type === "edit-item"
                ? sheet.item
                  ? "Edit Item"
                  : "New Item"
                : "Item"}
            </SheetTitle>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {sheet?.type === "view-category" && (
              <div className="space-y-3">
                <DetailCell label="Name" value={sheet.category.name} />
                <DetailCell label="Note" value={sheet.category.note || "-"} />
                <DetailCell label="Order" value={String(sheet.category.display_order)} />
                <DetailCell label="Status" value={sheet.category.is_active ? "Active" : "Inactive"} />
                <DetailCell label="Items" value={String(sheet.category.menu_items.length)} />
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {sheet?.type === "edit-category" && (
              <form id="menu-form" action={handleCategorySave} className="space-y-3">
                {sheet.category && <input type="hidden" name="id" value={sheet.category.id} />}
                <div className="divide-y divide-[#D8D5C8]/50 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white">
                  <FormRow label="Name" required>
                    <input name="name" required placeholder="e.g. Cocktails" defaultValue={sheet.category?.name ?? ""} className="flex-1 bg-transparent text-right font-black text-sm text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>
                  <FormRow label="Note">
                    <input name="note" placeholder="e.g. +£1.45 for mixers" defaultValue={sheet.category?.note ?? ""} className="flex-1 bg-transparent text-right font-black text-sm text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>
                  <FormRow label="Order">
                    <input name="display_order" type="number" min="0" defaultValue={sheet.category?.display_order ?? 0} title="Order" placeholder="0" className="w-16 flex-1 bg-transparent text-right font-black text-sm text-[#20231A] outline-none" />
                  </FormRow>
                  <FormRow label="Status">
                    <select name="is_active" title="Status" defaultValue={sheet.category?.is_active === false ? "false" : "true"} className="dir-rtl flex-1 cursor-pointer appearance-none bg-transparent font-black text-sm text-[#20231A] outline-none">
                      <option value="true" className="dir-ltr">Active</option>
                      <option value="false" className="dir-ltr">Inactive</option>
                    </select>
                  </FormRow>
                </div>
                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            {sheet?.type === "view-item" && (
              <div className="space-y-3">
                <DetailCell label="Name" value={sheet.item.name} />
                <DetailCell label="Price" value={sheet.item.price} />
                <DetailCell label="Category" value={sheet.category.name} />
                <DetailCell label="Order" value={String(sheet.item.display_order)} />
                <DetailCell label="Status" value={sheet.item.is_active ? "Active" : "Inactive"} />
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {sheet?.type === "edit-item" && (
              <form id="menu-form" action={handleItemSave} className="space-y-3">
                {sheet.item && <input type="hidden" name="id" value={sheet.item.id} />}
                <input type="hidden" name="category_id" value={sheet.category.id} />
                <div className="divide-y divide-[#D8D5C8]/50 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white">
                  <FormRow label="Name" required>
                    <input name="name" required placeholder="e.g. Espresso Martini" defaultValue={sheet.item?.name ?? ""} className="flex-1 bg-transparent text-right font-black text-sm text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>
                  <FormRow label="Price" required>
                    <input name="price" required placeholder="e.g. £8.95" defaultValue={sheet.item?.price ?? ""} className="flex-1 bg-transparent text-right font-black text-sm text-[#20231A] outline-none placeholder:text-[#5E6654]/40" />
                  </FormRow>
                  <FormRow label="Order">
                    <input name="display_order" type="number" min="0" title="Order" defaultValue={sheet.item?.display_order ?? 0} className="w-16 flex-1 bg-transparent text-right font-black text-sm text-[#20231A] outline-none" />
                  </FormRow>
                  <FormRow label="Status">
                    <select name="is_active" title="Status" defaultValue={sheet.item?.is_active === false ? "false" : "true"} className="dir-rtl flex-1 cursor-pointer appearance-none bg-transparent font-black text-sm text-[#20231A] outline-none">
                      <option value="true" className="dir-ltr">Active</option>
                      <option value="false" className="dir-ltr">Inactive</option>
                    </select>
                  </FormRow>
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
                    if (sheet.type === "view-category") handleCategoryDelete(sheet.category.id);
                    else handleItemDelete(sheet.item.id);
                  }}
                  disabled={isPending}
                  className="h-12 rounded-2xl border-2 border-[#D8D5C8] bg-white font-black text-[10px] tracking-wide text-red-500 uppercase hover:border-red-200 hover:bg-red-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    setFormError(null);
                    if (sheet.type === "view-category")
                      setSheet({ type: "edit-category", category: sheet.category });
                    else
                      setSheet({ type: "edit-item", item: sheet.item, category: sheet.category });
                  }}
                  className="h-12 rounded-2xl border border-[#34451F] font-black text-[10px] tracking-widest text-[#34451F] uppercase hover:bg-[#E5EBD8] active:scale-95"
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
              </div>
            )}

            {(sheet?.type === "edit-category" || sheet?.type === "edit-item") && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeSheet}
                  disabled={isPending}
                  className="h-12 rounded-2xl border-2 border-[#D8D5C8] bg-white font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="menu-form"
                  disabled={isPending}
                  className="h-12 rounded-2xl bg-[#34451F] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#283719] active:scale-95"
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

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5E6654] opacity-60">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">{label}</span>
        {required && <span className="text-[10px] font-bold text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#D8D5C8] bg-white px-4 py-2.5">
      <span className="shrink-0 text-[10px] font-bold tracking-wide text-[#5E6654] uppercase opacity-60">{label}</span>
      <span className="flex-1 text-right font-black text-sm break-all text-[#20231A]">{value}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p className="text-xs leading-snug font-bold text-red-700">{message}</p>
    </div>
  );
}
