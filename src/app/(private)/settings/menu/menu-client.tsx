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
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">
      {/* Hidden iframe for printing the public menu page */}
      <iframe
        id="menu-print-frame"
        src="/menu"
        className="hidden"
        title="Menu print frame"
      />

      {/* Header + Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-black text-[#1F1F1A] uppercase tracking-tight">
            Menu
          </h3>
          <p className="text-[11px] text-[#5F624F] font-medium">
            {initialCategories.length} categories &middot;{" "}
            {initialCategories.reduce(
              (sum, c) => sum + c.menu_items.length,
              0
            )}{" "}
            items
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => printMenuPage()}
            title="Print menu"
            className="w-7 h-7 rounded-lg border border-[#E6DFC8] bg-white hover:bg-[#F7F4EA] transition-colors flex items-center justify-center"
          >
            <Printer className="w-3.5 h-3.5 text-[#5F624F]" />
          </button>
          <button
            type="button"
            onClick={() => printMenuPage()}
            title="Save menu as PDF"
            className="w-7 h-7 rounded-lg border border-[#E6DFC8] bg-white hover:bg-[#F7F4EA] transition-colors flex items-center justify-center"
          >
            <Download className="w-3.5 h-3.5 text-[#5F624F]" />
          </button>
          <button
            type="button"
            onClick={() =>
              setSheet({ type: "edit-category", category: null })
            }
            className="h-7 px-2.5 rounded-lg bg-[#1B4332] text-white hover:bg-[#1B4332]/85 transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
          >
            <Plus className="w-3.5 h-3.5" />
            Category
          </button>
        </div>
      </div>

      {/* Categories */}
      {initialCategories.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <UtensilsCrossed className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">
            No menu categories yet
          </p>
          <p className="text-[11px] text-[#5F624F] mt-1">
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
                className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden"
              >
                {/* Category header */}
                <div className="flex items-center bg-[#F7F4EA] px-3 sm:px-4 py-2.5 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((p) => ({
                        ...p,
                        [cat.id]: !isCollapsed,
                      }))
                    }
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#5C4033] truncate">
                      {cat.name}{" "}
                      <span className="text-[#5F624F]">
                        ({cat.menu_items.length})
                      </span>
                    </p>
                    {cat.note && (
                      <p className="text-[9px] text-[#5F624F] font-medium truncate mt-0.5">
                        {cat.note}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSheet({ type: "view-category", category: cat })
                    }
                    className="shrink-0 w-6 h-6 rounded-md hover:bg-[#E6DFC8] flex items-center justify-center transition-colors"
                    title="Edit category"
                  >
                    <Pencil className="w-3 h-3 text-[#5F624F]" />
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
                    className="shrink-0 w-6 h-6 rounded-md bg-[#1B4332] text-white flex items-center justify-center hover:bg-[#1B4332]/85 transition-colors"
                    title="Add item"
                  >
                    <Plus className="w-3 h-3" />
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
                        "w-4 h-4 text-[#5F624F] transition-transform duration-200",
                        !isCollapsed && "rotate-180"
                      )}
                    />
                  </button>
                </div>

                {/* Items */}
                {!isCollapsed && cat.menu_items.length > 0 && (
                  <div className="divide-y divide-[#E6DFC8]/50">
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
                          "px-3 sm:px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors",
                          !item.is_active && "opacity-40"
                        )}
                      >
                        <GripVertical className="w-3 h-3 text-[#E6DFC8] shrink-0" />
                        <span className="text-xs font-bold text-[#1F1F1A] flex-1 min-w-0 truncate">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-bold text-[#5F624F] shrink-0 text-right">
                          {item.price}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!isCollapsed && cat.menu_items.length === 0 && (
                  <div className="px-4 py-4 text-center text-[11px] text-[#5F624F]">
                    No items — tap + to add
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Sheet ── */}
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
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-auto max-h-[75vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-140
            sm:max-h-[70vh] sm:rounded-4xl sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-4xl">
            <SheetTitle className="text-lg font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight">
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

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 min-h-0 touch-pan-y space-y-4">
            {/* View Category */}
            {sheet?.type === "view-category" && (
              <div className="space-y-3">
                <DetailCell label="Name" value={sheet.category.name} />
                <DetailCell label="Note" value={sheet.category.note || "—"} />
                <DetailCell label="Order" value={String(sheet.category.display_order)} />
                <DetailCell label="Status" value={sheet.category.is_active ? "Active" : "Inactive"} />
                <DetailCell label="Items" value={String(sheet.category.menu_items.length)} />
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {/* Edit Category Form */}
            {sheet?.type === "edit-category" && (
              <form id="menu-form" action={handleCategorySave} className="space-y-3">
                {sheet.category && <input type="hidden" name="id" value={sheet.category.id} />}
                <div className="bg-white border-2 border-[#E6DFC8] rounded-2xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  <FormRow label="Name" required>
                    <input name="name" required placeholder="e.g. Cocktails" defaultValue={sheet.category?.name ?? ""} className="text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                  </FormRow>
                  <FormRow label="Note">
                    <input name="note" placeholder="e.g. +£1.45 for mixers" defaultValue={sheet.category?.note ?? ""} className="text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                  </FormRow>
                  <FormRow label="Order">
                    <input name="display_order" type="number" min="0" defaultValue={sheet.category?.display_order ?? 0} title="Order" placeholder="0" className="text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none w-16" />
                  </FormRow>
                  <FormRow label="Status">
                    <select name="is_active" title="Status" defaultValue={sheet.category?.is_active === false ? "false" : "true"} className="text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl">
                      <option value="true" className="dir-ltr">Active</option>
                      <option value="false" className="dir-ltr">Inactive</option>
                    </select>
                  </FormRow>
                </div>
                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            {/* View Item */}
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

            {/* Edit Item Form */}
            {sheet?.type === "edit-item" && (
              <form id="menu-form" action={handleItemSave} className="space-y-3">
                {sheet.item && <input type="hidden" name="id" value={sheet.item.id} />}
                <input type="hidden" name="category_id" value={sheet.category.id} />
                <div className="bg-white border-2 border-[#E6DFC8] rounded-2xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  <FormRow label="Name" required>
                    <input name="name" required placeholder="e.g. Espresso Martini" defaultValue={sheet.item?.name ?? ""} className="text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                  </FormRow>
                  <FormRow label="Price" required>
                    <input name="price" required placeholder="e.g. £8.95" defaultValue={sheet.item?.price ?? ""} className="text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
                  </FormRow>
                  <FormRow label="Order">
                    <input name="display_order" type="number" min="0" title="Order" defaultValue={sheet.item?.display_order ?? 0} className="text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none w-16" />
                  </FormRow>
                  <FormRow label="Status">
                    <select name="is_active" title="Status" defaultValue={sheet.item?.is_active === false ? "false" : "true"} className="text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl">
                      <option value="true" className="dir-ltr">Active</option>
                      <option value="false" className="dir-ltr">Inactive</option>
                    </select>
                  </FormRow>
                </div>
                {formError && <ErrorBox message={formError} />}
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 pb-8 sm:pb-4 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-4xl">
            {(sheet?.type === "view-category" || sheet?.type === "view-item") && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (sheet.type === "view-category") handleCategoryDelete(sheet.category.id);
                    else handleItemDelete(sheet.item.id);
                  }}
                  disabled={isPending}
                  className="h-12 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-wide text-[10px] bg-white hover:bg-red-50 hover:border-red-200"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
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
                  className="h-12 rounded-2xl bg-[#B45309] hover:bg-[#B45309]/85 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-1.5" />
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
                  className="h-12 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="menu-form"
                  disabled={isPending}
                  className="h-12 rounded-2xl bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" />Save</>}
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
      <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">{label}</span>
        {required && <span className="text-red-500 text-[10px] font-bold">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-[#E6DFC8] rounded-xl px-4 py-2.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] opacity-60 shrink-0">{label}</span>
      <span className="text-sm font-black text-[#1F1F1A] text-right flex-1 break-all">{value}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-xs text-red-700 font-bold leading-snug">{message}</p>
    </div>
  );
}
