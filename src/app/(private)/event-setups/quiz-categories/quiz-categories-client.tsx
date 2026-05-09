"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  Save,
  Pencil,
  Trash2,
  ChevronRight,
  AlertCircle,
  Music,
  Hash,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { saveQuizCategoryAction, deleteQuizCategoryAction, QuizCategoryConfig } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function QuizCategoriesClient({
  initialConfigs = [],
}: {
  initialConfigs: QuizCategoryConfig[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<QuizCategoryConfig | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const isSheetOpen = !!selected || isAdding;
  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  const openView = (config: QuizCategoryConfig) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(config);
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
      const result = await saveQuizCategoryAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const handleDelete = async () => {
    if (!selected?.id) return;
    const ok = await confirm({
      title: "Delete category",
      description: "Delete this quiz category? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteQuizCategoryAction(selected.id!);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  return (
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">

      {/* Category list */}
      <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
        <div className="flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3 gap-2">
          <p className="flex-1 text-[11px] font-black uppercase tracking-widest text-[#26300D] truncate">
            Quiz Categories <span className="text-[#5F624F]">({initialConfigs.length})</span>
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="w-7 h-7 sm:h-7 sm:w-auto sm:px-2.5 rounded-lg bg-[#26300D] text-[#FDCC4B] hover:bg-[#26300D]/85 transition-colors flex items-center justify-center gap-1.5 shrink-0"
            title="Add category"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Create</span>
          </button>
        </div>

        {initialConfigs.length === 0 ? (
          <div className="py-14 text-center">
            <Hash className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
            <p className="text-sm font-black text-[#1F1F1A]">No categories yet</p>
            <p className="text-[11px] text-[#5F624F] mt-1">Add your first quiz category to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E6DFC8]/50">
            {initialConfigs.map((config) => {
              const inactive = !config.is_active;
              const muted = "text-[#5F624F]";
              return (
                <div
                  key={config.id}
                  onClick={() => openView(config)}
                  className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0 sm:hidden">
                    {/* Mobile row 1: name + active */}
                    <div className="flex items-center gap-2">
                      <p className={cn("text-xs font-black leading-snug truncate flex-1 min-w-0", inactive ? muted : "text-[#1F1F1A]")}>
                        {config.category_name}
                      </p>
                      <span className={cn(
                        "text-[10px] font-black shrink-0",
                        config.is_active ? "text-green-600" : "text-red-500"
                      )}>
                        {config.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {/* Mobile row 2: order | questions | points | spotify */}
                    <div className="flex items-center mt-0.5 gap-1">
                      <span className={cn("text-[10px] font-medium", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                        Round {config.order_no}
                      </span>
                      <span className="flex-1" />
                      <span className={cn("text-[10px] font-black w-10 text-right tabular-nums", muted)}>
                        {config.question_count}Q
                      </span>
                      <span className={cn("text-[10px] font-black w-10 text-right tabular-nums", muted)}>
                        {config.points_per_question}pt
                      </span>
                      <span className="w-5 flex items-center justify-center shrink-0">
                        {config.include_spotify && (
                          <Music className={cn("w-3.5 h-3.5", inactive ? muted : "text-green-600")} />
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden sm:block flex-1 min-w-0">
                    <p className={cn("text-sm font-black leading-snug truncate", inactive ? muted : "text-[#1F1F1A]")}>
                      {config.category_name}
                    </p>
                    <p className={cn("text-[11px] font-medium mt-0.5", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                      Round {config.order_no} · {config.question_count} questions · {config.points_per_question} pts each
                      {config.include_spotify && " · Spotify"}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {config.include_spotify && (
                      <span className={cn("flex items-center gap-1 text-[11px] font-black bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg", inactive ? muted : "text-green-700")}>
                        <Music className="w-3 h-3" /> Spotify
                      </span>
                    )}
                    <span className={cn(
                      "text-[11px] font-black px-2 py-1 rounded-lg border",
                      config.is_active
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : "text-red-500 bg-red-50 border-red-200"
                    )}>
                      {config.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
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
          {/* Sheet header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                  {isAdding ? "New Category" : isEditing ? "Edit Category" : "View Category"}
                </SheetTitle>
                {selected && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-xs font-black text-[#5F624F] uppercase tracking-widest tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <span className={cn(
                  "shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full border",
                  selected.is_active
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-red-100 text-red-600 border-red-300"
                )}>
                  {selected.is_active ? "Active" : "Inactive"}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4 sm:space-y-5">

            {/* View mode */}
            {!showForm && selected && (
              <div className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                  <DetailCell label="Category" value={selected.category_name} />
                  <DetailCell label="Short Name" value={selected.short_name || "—"} />
                  <DetailCell label="Round Order" value={String(selected.order_no)} />
                  <DetailCell label="Questions" value={String(selected.question_count)} />
                  <DetailCell label="Points / Q" value={String(selected.points_per_question)} />
                  <DetailCell label="Spotify" value={selected.include_spotify ? "Yes" : "No"} />
                </div>
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {/* Edit / Add form */}
            {showForm && (
              <form id="category-form" action={handleSubmit} className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                {formDefault?.id && <input type="hidden" name="id" value={formDefault.id} />}

                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  <FormRow label="Name" required>
                    <input
                      name="category_name"
                      required
                      placeholder="e.g. Movies"
                      defaultValue={formDefault?.category_name ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  <FormRow label="Short Name">
                    <input
                      name="short_name"
                      placeholder="e.g. MOV"
                      maxLength={5}
                      defaultValue={formDefault?.short_name ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40 uppercase"
                    />
                  </FormRow>

                  <FormRow label="Round Order" required>
                    <input
                      title="Round Order"
                      name="order_no"
                      type="number"
                      min="1"
                      required
                      defaultValue={formDefault?.order_no ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
                    />
                  </FormRow>

                  <FormRow label="Questions">
                    <input
                      title="Questions"
                      name="question_count"
                      type="number"
                      min="1"
                      max="50"
                      defaultValue={formDefault?.question_count ?? 10}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
                    />
                  </FormRow>

                  <FormRow label="Points / Q">
                    <input
                      title="Points per question"
                      name="points_per_question"
                      type="number"
                      min="1"
                      defaultValue={formDefault?.points_per_question ?? 1}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
                    />
                  </FormRow>

                  <FormRow label="Spotify">
                    <span className="flex-1" />
                    <input
                      title="Include Spotify"
                      id="include_spotify"
                      name="include_spotify"
                      type="checkbox"
                      defaultChecked={formDefault?.include_spotify ?? false}
                      className="w-5 h-5 rounded accent-[#26300D] cursor-pointer"
                    />
                  </FormRow>

                  <FormRow label="Active">
                    <span className="flex-1" />
                    <input
                      title="Active"
                      id="is_active"
                      name="is_active"
                      type="checkbox"
                      defaultChecked={formDefault?.is_active ?? true}
                      className="w-5 h-5 rounded accent-[#26300D] cursor-pointer"
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
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-widest text-[10px] bg-white hover:bg-red-50 hover:border-red-200"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-2" />Edit
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
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-widest text-[10px] bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="category-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  {isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Save className="w-4 h-4 mr-2" />Save</>}
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
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
          {label}
        </span>
        {required && <span className="text-red-500 text-[10px] font-black">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
          {label}
        </span>
      </div>
      <span className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug">
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
