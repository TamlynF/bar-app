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
  Upload,
} from "lucide-react";
import { saveSpecialAction, deleteSpecialAction } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextContent } from "@/components/rich-text-content";

export type SpecialRecord = {
  id: number;
  title: string;
  description: string | null;
  badges: string[];
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[];
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

/** ISO weekday numbers (1=Mon … 7=Sun) paired with their short labels. */
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

function formatDays(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return "Every day";
  return WEEKDAYS.filter((d) => days.includes(d.value))
    .map((d) => d.label)
    .join(", ");
}

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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

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
    setImageUrl("");
    setIsAdding(true);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
    setImageUrl("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setFormError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `specials/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      setFormError(`Upload failed: ${error.message}`);
      setUploadingImage(false);
      return;
    }

    const publicUrl = supabase.storage
      .from("gallery")
      .getPublicUrl(data.path).data.publicUrl;
    setImageUrl(publicUrl);
    setUploadingImage(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {/* List */}
      {initialSpecials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
          <p className="font-black text-sm text-[#1F1F1A]">No specials yet</p>
          <p className="mt-1 text-[11px] text-[#5F624F]">
            Add your first special to display on the homepage
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 h-8 rounded-lg bg-[#1B4332] px-4 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            Create Special
          </button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
          <div className="flex items-center gap-2 bg-[#F7F4EA] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-[11px] font-bold tracking-wide text-[#5C4033] uppercase">
                Specials{" "}
                <span className="text-[#5F624F]">
                  ({initialSpecials.length})
                </span>
              </p>
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="flex h-7 w-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] text-white transition-colors hover:bg-[#1B4332]/85 sm:h-7 sm:w-auto sm:px-2.5"
              title="Add Special"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden font-black text-[10px] tracking-widest uppercase sm:inline">
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
                  "h-4 w-4 text-[#5F624F] transition-transform duration-200",
                  !isCollapsed && "rotate-180"
                )}
              />
            </button>
          </div>

          {!isCollapsed && (
            <div className="divide-y divide-[#E6DFC8]/50">
              {initialSpecials.map((special) => {
                const inactive = !special.is_active;
                const dateRange = [
                  special.start_date ? formatDate(special.start_date) : null,
                  special.end_date ? formatDate(special.end_date) : null,
                ]
                  .filter(Boolean)
                  .join(" - ");
                return (
                  <div
                    key={special.id}
                    onClick={() => openView(special)}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#F7F4EA]/50 active:scale-[0.99] sm:px-4"
                  >
                    {/* Thumbnail */}
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[#E6DFC8] bg-[#F7F4EA]">
                      {special.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={special.image_url}
                          alt={special.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Sparkles className="h-4 w-4 text-[#5F624F] opacity-30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate font-black text-sm leading-snug",
                            inactive ? "text-[#5F624F]" : "text-[#1F1F1A]"
                          )}
                        >
                          {special.title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                            special.is_active
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-red-200 bg-red-50 text-red-500"
                          )}
                        >
                          {special.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[#5F624F] tabular-nums">
                        {dateRange || "No dates set"}
                      </p>
                    </div>

                    <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F] opacity-40" />
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
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8]
            bg-[#F7F4EA] p-0 shadow-2xl outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto
            sm:max-h-[80vh] sm:w-140 sm:-translate-x-1/2 sm:rounded-4xl
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Header */}
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#1F1F1A] uppercase">
                  {isAdding
                    ? "New Special"
                    : isEditing
                    ? "Edit Special"
                    : "View Special"}
                </SheetTitle>
                {selected && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-[#5F624F]" />
                    <span className="text-xs font-bold tracking-wide text-[#5F624F] uppercase tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">
            {/* View mode */}
            {!showForm && selected && (
              <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <DetailCell label="Title" value={selected.title} />
                  {selected.description ? (
                    <div className="border-b border-[#E6DFC8] px-4 py-3 sm:px-5">
                      <p className="mb-1.5 text-[10px] font-bold tracking-wide text-[#5F624F] uppercase opacity-60">
                        Description
                      </p>
                      <RichTextContent html={selected.description} variant="admin" />
                    </div>
                  ) : (
                    <DetailCell label="Description" value="—" />
                  )}
                  <DetailCell
                    label="Badges"
                    value={
                      selected.badges.length > 0
                        ? selected.badges.join(", ")
                        : "—"
                    }
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
                    label="Days"
                    value={formatDays(selected.days_of_week)}
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
                  <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      <ImageIcon className="h-3 w-3 text-[#5F624F]" />
                      <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">
                        Preview
                      </span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.image_url}
                      alt={selected.title}
                      className="h-40 w-full rounded-xl object-cover"
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
                onSubmit={handleSubmit}
                className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
              >
                {formDefault && (
                  <input type="hidden" name="id" value={formDefault.id} />
                )}
                <input type="hidden" name="image_url" value={imageUrl} />

                {/* Image upload */}
                <div className="space-y-3 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white p-4">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3 text-[#5F624F]" />
                    <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">
                      Image
                    </span>
                  </div>

                  {imageUrl ? (
                    <div className="relative overflow-hidden rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="max-h-50 w-full rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                        title="Remove image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E6DFC8] py-8 transition-colors hover:border-[#5C4033] hover:bg-[#F7F4EA]">
                      {uploadingImage ? (
                        <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#5F624F]" />
                      ) : (
                        <Upload className="mb-2 h-8 w-8 text-[#5F624F] opacity-40" />
                      )}
                      <span className="font-black text-[11px] tracking-wide text-[#5F624F] uppercase">
                        {uploadingImage ? "Uploading..." : "Click to upload"}
                      </span>
                      <span className="mt-1 text-[9px] text-[#5F624F] opacity-60">JPG, PNG up to 10MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                  )}
                </div>

                <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <FormRow label="Title" required>
                    <input
                      name="title"
                      required
                      placeholder="e.g. 2-for-1 Cocktails"
                      defaultValue={formDefault?.title ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <div className="px-4 py-3 sm:px-5">
                    <p className="mb-2 text-[10px] font-bold tracking-wide text-[#5F624F] uppercase opacity-60">
                      Description
                    </p>
                    <RichTextEditor
                      name="description"
                      defaultValue={formDefault?.description ?? ""}
                    />
                  </div>

                  <FormRow label="Badges">
                    <input
                      name="badges"
                      placeholder="e.g. NEW, FRIDAY (comma-separated)"
                      defaultValue={formDefault?.badges.join(", ") ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
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
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
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
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    />
                  </FormRow>

                  <div className="px-4 py-3 sm:px-5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase opacity-60">
                        Available on
                      </span>
                      <span className="text-[10px] font-medium text-[#5F624F] opacity-60">
                        Leave all unticked for every day
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => {
                        const checked = formDefault?.days_of_week?.includes(d.value);
                        return (
                          <label
                            key={d.value}
                            className="relative cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              name="days_of_week"
                              value={d.value}
                              defaultChecked={checked}
                              className="peer sr-only"
                            />
                            <span className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 font-black text-[11px] tracking-wide text-[#5F624F] uppercase transition-colors peer-checked:border-[#5C4033] peer-checked:bg-[#5C4033] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#5C4033]">
                              {d.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <FormRow label="Status">
                    <select
                      title="Status"
                      name="is_active"
                      defaultValue={
                        formDefault?.is_active === false ? "false" : "true"
                      }
                      className="dir-rtl flex-1 cursor-pointer appearance-none bg-transparent font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
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
                      className="w-16 flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
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
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    setFormError(null);
                    setImageUrl(selected?.image_url || "");
                    setIsEditing(true);
                  }}
                  className="h-14 flex-1 rounded-2xl bg-[#B45309] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#B45309]/85 active:scale-95"
                >
                  <Pencil className="mr-2 h-4 w-4" />
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
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-wide text-[#5F624F] uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isPending || uploadingImage}
                  onClick={() => {
                    const form = document.getElementById('special-form') as HTMLFormElement | null;
                    if (form) form.requestSubmit();
                  }}
                  className="h-14 rounded-2xl bg-[#1B4332] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
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
  align = "center",
  children,
}: {
  label: string;
  required?: boolean;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4", align === "start" ? "items-start" : "items-center")}>
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
        {required && (
          <span className="text-[10px] font-bold text-red-500">*</span>
        )}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={cn("flex gap-2 border-b border-[#E6DFC8] px-4 py-2.5 last:border-0 sm:gap-3 sm:px-5 sm:py-4", multiline ? "items-start" : "items-center")}>
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
      </div>
      <span className={cn("flex-1 text-right font-black text-base leading-snug wrap-break-word text-[#1F1F1A] sm:text-sm", multiline && "text-left whitespace-pre-line")}>
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
