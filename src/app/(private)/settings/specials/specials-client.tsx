"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  ChevronRight,
  ChevronDown,
  Save,
  Pencil,
  Trash2,
  Hash,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { saveSpecialAction, deleteSpecialAction } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type SpecialRecord = {
  id: number;
  title: string;
  description: string | null;
  badges: string[];
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SpecialsClient({
  initialSpecials = [],
}: {
  initialSpecials: SpecialRecord[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<SpecialRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isSheetOpen = !!selected || isAdding;

  const openView = (s: SpecialRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(s);
  };

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setIsAdding(true);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
  };

  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveSpecialAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Delete special",
      description:
        "Are you sure you want to delete this special? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteSpecialAction(selected.id);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  return (
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">
      {/* List */}
      {initialSpecials.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <Sparkles className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No specials yet</p>
          <p className="text-[11px] text-[#5F624F] mt-1">
            Add your first special to display on the homepage
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 h-8 px-4 rounded-lg bg-[#26300D] text-[#FDCC4B] text-[10px] font-bold uppercase tracking-wide hover:bg-[#26300D]/85 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Create Special
          </button>
        </div>
      ) : (
        <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
          <div className="flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3 gap-2">
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#26300D] truncate">
                Specials{" "}
                <span className="text-[#5F624F]">
                  ({initialSpecials.length})
                </span>
              </p>
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="w-7 h-7 sm:h-7 sm:w-auto sm:px-2.5 rounded-lg bg-[#26300D] text-[#FDCC4B] hover:bg-[#26300D]/85 transition-colors flex items-center justify-center gap-1.5 shrink-0"
              title="Add Special"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wide">
                Create
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="shrink-0"
              title="Toggle group"
            >
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-[#5F624F] transition-transform duration-200",
                  !isCollapsed && "rotate-180"
                )}
              />
            </button>
          </div>

          {!isCollapsed && (
            <div className="divide-y divide-[#E6DFC8]/50">
              {initialSpecials.map((special) => {
                const inactive = !special.is_active;
                return (
                  <div
                    key={special.id}
                    onClick={() => openView(special)}
                    className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "text-xs sm:text-sm font-black leading-snug truncate flex-1 min-w-0",
                            inactive ? "text-[#5F624F]" : "text-[#1F1F1A]"
                          )}
                        >
                          {special.title}
                        </p>
                        <span
                          className={cn(
                            "text-[10px] font-bold shrink-0",
                            special.is_active
                              ? "text-green-600"
                              : "text-red-500"
                          )}
                        >
                          {special.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center mt-0.5 gap-1.5">
                        {special.badges.length > 0 && (
                          <div className="flex items-center gap-1">
                            {special.badges.slice(0, 3).map((b) => (
                              <span
                                key={b}
                                className="text-[9px] font-bold text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-1.5 py-0.5 rounded"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-[#5F624F] font-medium truncate">
                          Order: {special.display_order}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Bottom Sheet */}
      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px]
            sm:h-auto sm:max-h-[80vh] sm:rounded-[2rem] sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                  {isAdding
                    ? "New Special"
                    : isEditing
                    ? "Edit Special"
                    : "View Special"}
                </SheetTitle>
                {selected && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-xs font-bold text-[#5F624F] uppercase tracking-wide tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4 sm:space-y-5">
            {/* View mode */}
            {!showForm && selected && (
              <div className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                  <DetailCell label="Title" value={selected.title} />
                  <DetailCell
                    label="Description"
                    value={selected.description || "—"}
                  />
                  <DetailCell
                    label="Badges"
                    value={
                      selected.badges.length > 0
                        ? selected.badges.join(", ")
                        : "—"
                    }
                  />
                  <DetailCell
                    label="Image URL"
                    value={selected.image_url || "—"}
                  />
                  <DetailCell
                    label="Start Date"
                    value={formatDate(selected.start_date)}
                  />
                  <DetailCell
                    label="End Date"
                    value={formatDate(selected.end_date)}
                  />
                  <DetailCell
                    label="Status"
                    value={selected.is_active ? "Active" : "Inactive"}
                  />
                  <DetailCell
                    label="Display Order"
                    value={String(selected.display_order)}
                  />
                </div>

                {selected.image_url && (
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ImageIcon className="w-3 h-3 text-[#5F624F]" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]">
                        Preview
                      </span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.image_url}
                      alt={selected.title}
                      className="w-full h-40 object-cover rounded-xl"
                    />
                  </div>
                )}

                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {/* Form */}
            {showForm && (
              <form
                id="special-form"
                action={handleSubmit}
                className="animate-in fade-in duration-200 space-y-4 sm:space-y-5"
              >
                {formDefault && (
                  <input type="hidden" name="id" value={formDefault.id} />
                )}

                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  <FormRow label="Title" required>
                    <input
                      name="title"
                      required
                      placeholder="e.g. 2-for-1 Cocktails"
                      defaultValue={formDefault?.title ?? ""}
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  <FormRow label="Description">
                    <input
                      name="description"
                      placeholder="e.g. Every Friday 5-8pm"
                      defaultValue={formDefault?.description ?? ""}
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  <FormRow label="Badges">
                    <input
                      name="badges"
                      placeholder="e.g. NEW, FRIDAY (comma-separated)"
                      defaultValue={formDefault?.badges.join(", ") ?? ""}
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  <FormRow label="Image URL">
                    <input
                      name="image_url"
                      placeholder="https://..."
                      defaultValue={formDefault?.image_url ?? ""}
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  <FormRow label="Start Date">
                    <input
                      title="Start Date"
                      name="start_date"
                      type="date"
                      defaultValue={
                        formDefault?.start_date
                          ? new Date(formDefault.start_date)
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
                    />
                  </FormRow>

                  <FormRow label="End Date">
                    <input
                      title="End Date"
                      name="end_date"
                      type="date"
                      defaultValue={
                        formDefault?.end_date
                          ? new Date(formDefault.end_date)
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
                    />
                  </FormRow>

                  <FormRow label="Status">
                    <select
                      title="Status"
                      name="is_active"
                      defaultValue={
                        formDefault?.is_active === false ? "false" : "true"
                      }
                      className="text-base sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
                    >
                      <option value="true" className="dir-ltr">
                        Active
                      </option>
                      <option value="false" className="dir-ltr">
                        Inactive
                      </option>
                    </select>
                  </FormRow>

                  <FormRow label="Order">
                    <input
                      title="Order"
                      name="display_order"
                      type="number"
                      min="0"
                      defaultValue={formDefault?.display_order ?? 0}
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none w-16"
                    />
                  </FormRow>
                </div>

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-wide text-[10px] bg-white hover:bg-red-50 hover:border-red-200"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    setFormError(null);
                    setIsEditing(true);
                  }}
                  className="h-14 flex-1 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormError(null);
                    if (isAdding) closeSheet();
                    else setIsEditing(false);
                  }}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="special-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
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

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
        {required && (
          <span className="text-red-500 text-[10px] font-bold">*</span>
        )}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
      </div>
      <span className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug break-all">
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 font-bold leading-snug">{message}</p>
    </div>
  );
}
