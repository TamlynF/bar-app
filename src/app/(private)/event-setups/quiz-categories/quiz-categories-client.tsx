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
  ImageIcon,
  ArrowUpDown,
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
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">

      {/* Category list */}
      <section className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
        <div className="flex items-center gap-2 bg-[#F7F4EA] px-4 py-3 sm:px-5">
          <p className="flex-1 truncate font-black text-[11px] tracking-wide text-[#5C4033] uppercase">
            Quiz Categories <span className="text-[#5F624F]">({initialConfigs.length})</span>
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="flex h-7 w-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] text-white transition-colors hover:bg-[#1B4332]/85 sm:h-7 sm:w-auto sm:px-2.5"
            title="Add category"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden font-black text-[10px] tracking-widest uppercase sm:inline">Create</span>
          </button>
        </div>

        {initialConfigs.length === 0 ? (
          <div className="py-14 text-center">
            <Hash className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
            <p className="font-black text-sm text-[#1F1F1A]">No categories yet</p>
            <p className="mt-1 text-[11px] text-[#5F624F]">Add your first quiz category to get started</p>
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
                  className="flex cursor-pointer items-center gap-2 px-3 py-3 transition-colors hover:bg-[#F7F4EA]/50 active:scale-[0.99] sm:gap-3 sm:px-4"
                >
                  <div className="min-w-0 flex-1 sm:hidden">
                    {/* Mobile row 1: name + active */}
                    <div className="flex items-center gap-2">
                      <p className={cn("min-w-0 flex-1 truncate font-black text-xs leading-snug", inactive ? muted : "text-[#1F1F1A]")}>
                        {config.category_name}
                      </p>
                      <span className={cn(
                        "shrink-0 font-black text-[10px]",
                        config.is_active ? "text-green-600" : "text-red-500"
                      )}>
                        {config.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {/* Mobile row 2: order | questions | points | spotify */}
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className={cn("text-[10px] font-medium", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                        Round {config.order_no}
                      </span>
                      <span className="flex-1" />
                      <span className={cn("w-10 text-right font-black text-[10px] tabular-nums", muted)}>
                        {config.question_count}Q
                      </span>
                      <span className={cn("w-10 text-right font-black text-[10px] tabular-nums", muted)}>
                        {config.points_per_question}pt
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {config.include_spotify && (
                          <Music className={cn("h-3.5 w-3.5", inactive ? muted : "text-green-600")} />
                        )}
                        {config.is_higher_lower && (
                          <ArrowUpDown className={cn("h-3.5 w-3.5", inactive ? muted : "text-amber-600")} />
                        )}
                        {config.is_picture && (
                          <ImageIcon className={cn("h-3.5 w-3.5", inactive ? muted : "text-blue-600")} />
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <p className={cn("truncate font-black text-sm leading-snug", inactive ? muted : "text-[#1F1F1A]")}>
                      {config.category_name}
                    </p>
                    <p className={cn("mt-0.5 text-[11px] font-medium", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                      Round {config.order_no} · {config.question_count} questions · {config.points_per_question} pts each
                      {config.include_spotify && " · Spotify"}
                    </p>
                  </div>

                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    {config.include_spotify && (
                      <span className={cn("flex items-center gap-1 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 font-black text-[11px]", inactive ? muted : "text-green-700")}>
                        <Music className="h-3 w-3" /> Spotify
                      </span>
                    )}
                    {config.is_higher_lower && (
                      <span className={cn("flex items-center gap-1 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 font-black text-[11px]", inactive ? muted : "text-amber-700")}>
                        <ArrowUpDown className="h-3 w-3" /> Higher/Lower
                      </span>
                    )}
                    {config.is_picture && (
                      <span className={cn("flex items-center gap-1 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 font-black text-[11px]", inactive ? muted : "text-blue-700")}>
                        <ImageIcon className="h-3 w-3" /> Picture
                      </span>
                    )}
                    <span className={cn(
                      "rounded-lg border px-2 py-1 font-black text-[11px]",
                      config.is_active
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-red-200 bg-red-50 text-red-500"
                    )}>
                      {config.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F] opacity-40" />
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
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8]
            bg-[#F7F4EA] p-0 shadow-2xl outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto
            sm:max-h-[80vh] sm:w-140 sm:-translate-x-1/2 sm:rounded-4xl
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#1F1F1A] uppercase">
                  {isAdding ? "New Category" : isEditing ? "Edit Category" : "View Category"}
                </SheetTitle>
                {selected && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-[#5F624F]" />
                    <span className="font-black text-xs tracking-wide text-[#5F624F] uppercase tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <span className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 font-black text-[10px]",
                  selected.is_active
                    ? "border-green-300 bg-green-100 text-green-700"
                    : "border-red-300 bg-red-100 text-red-600"
                )}>
                  {selected.is_active ? "Active" : "Inactive"}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">

            {/* View mode */}
            {!showForm && selected && (
              <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <DetailCell label="Category" value={selected.category_name} />
                  <DetailCell label="Short Name" value={selected.short_name || "—"} />
                  <DetailCell label="Round Order" value={String(selected.order_no)} />
                  <DetailCell label="Questions" value={String(selected.question_count)} />
                  <DetailCell label="Points / Q" value={String(selected.points_per_question)} />
                  <DetailCell label="Spotify" value={selected.include_spotify ? "Yes" : "No"} />
                  <DetailCell label="Higher / Lower" value={selected.is_higher_lower ? "Yes" : "No"} />
                  <DetailCell label="Picture Round" value={selected.is_picture ? "Yes" : "No"} />
                </div>
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {/* Edit / Add form */}
            {showForm && (
              <form id="category-form" action={handleSubmit} className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                {formDefault?.id && <input type="hidden" name="id" value={formDefault.id} />}

                <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <FormRow label="Name" required>
                    <input
                      name="category_name"
                      required
                      placeholder="e.g. Movies"
                      defaultValue={formDefault?.category_name ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <FormRow label="Short Name">
                    <input
                      name="short_name"
                      placeholder="e.g. MOV"
                      maxLength={5}
                      defaultValue={formDefault?.short_name ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] uppercase outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
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
                      className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none sm:text-sm"
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
                      className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none sm:text-sm"
                    />
                  </FormRow>

                  <FormRow label="Points / Q">
                    <input
                      title="Points per question"
                      name="points_per_question"
                      type="number"
                      min="1"
                      defaultValue={formDefault?.points_per_question ?? 1}
                      className="flex-1 bg-transparent text-right font-black text-xs text-[#1F1F1A] outline-none sm:text-sm"
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
                      className="h-5 w-5 cursor-pointer rounded accent-[#5C4033]"
                    />
                  </FormRow>

                  <FormRow label="Higher / Lower">
                    <span className="flex-1" />
                    <input
                      title="Higher / Lower round"
                      id="is_higher_lower"
                      name="is_higher_lower"
                      type="checkbox"
                      defaultChecked={formDefault?.is_higher_lower ?? false}
                      className="h-5 w-5 cursor-pointer rounded accent-[#5C4033]"
                    />
                  </FormRow>

                  <FormRow label="Picture Round">
                    <span className="flex-1" />
                    <input
                      title="Picture Round"
                      id="is_picture"
                      name="is_picture"
                      type="checkbox"
                      defaultChecked={formDefault?.is_picture ?? false}
                      className="h-5 w-5 cursor-pointer rounded accent-[#5C4033]"
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
                      className="h-5 w-5 cursor-pointer rounded accent-[#5C4033]"
                    />
                  </FormRow>
                </div>

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="z-40 shrink-0 border-t-2 border-[#E6DFC8] bg-white/80 px-6 py-5 pb-10 backdrop-blur-md sm:rounded-b-4xl sm:pb-5">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 font-black text-[10px] tracking-wide text-red-500 uppercase hover:border-red-200 hover:bg-red-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#B45309] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#B45309]/85 active:scale-95"
                >
                  <Pencil className="mr-2 h-4 w-4" />Edit
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
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-wide text-[#5F624F] uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="category-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#1B4332] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95"
                >
                  {isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Save className="mr-2 h-4 w-4" />Save</>}
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
    <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="font-black text-[10px] tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
        {required && <span className="font-black text-[10px] text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#E6DFC8] px-4 py-2.5 last:border-0 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="font-black text-[10px] tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
      </div>
      <span className="flex-1 text-right font-black text-xs leading-snug text-[#1F1F1A] sm:text-sm">
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <p className="text-sm leading-snug font-bold text-red-700">{message}</p>
    </div>
  );
}
