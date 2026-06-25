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
            className="mt-4 h-8 px-4 rounded-lg bg-[#1B4332] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#1B4332]/85 transition-colors"
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
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#5C4033] truncate">
                Specials{" "}
                <span className="text-[#5F624F]">
                  ({initialSpecials.length})
                </span>
              </p>
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="w-7 h-7 sm:h-7 sm:w-auto sm:px-2.5 rounded-lg bg-[#1B4332] text-white hover:bg-[#1B4332]/85 transition-colors flex items-center justify-center gap-1.5 shrink-0"
              title="Add Special"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">
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
                    className="px-3 sm:px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]"
                  >
                    {/* Thumbnail */}
                    <div className="w-11 h-11 shrink-0 rounded-xl overflow-hidden border border-[#E6DFC8] bg-[#F7F4EA]">
                      {special.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={special.image_url}
                          alt={special.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Sparkles className="w-4 h-4 text-[#5F624F] opacity-30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "text-sm font-black leading-snug truncate flex-1 min-w-0",
                            inactive ? "text-[#5F624F]" : "text-[#1F1F1A]"
                          )}
                        >
                          {special.title}
                        </p>
                        <span
                          className={cn(
                            "text-[9px] font-bold uppercase tracking-wide shrink-0 px-1.5 py-0.5 rounded-full border",
                            special.is_active
                              ? "text-green-700 bg-green-50 border-green-200"
                              : "text-red-500 bg-red-50 border-red-200"
                          )}
                        >
                          {special.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#5F624F] font-medium mt-0.5 tabular-nums truncate">
                        {dateRange || "No dates set"}
                      </p>
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
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-140
            sm:h-auto sm:max-h-[80vh] sm:rounded-4xl sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-4xl">
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
                  {selected.description ? (
                    <div className="px-4 sm:px-5 py-3 border-b border-[#E6DFC8]">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] opacity-60 mb-1.5">
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
                onSubmit={handleSubmit}
                className="animate-in fade-in duration-200 space-y-4 sm:space-y-5"
              >
                {formDefault && (
                  <input type="hidden" name="id" value={formDefault.id} />
                )}
                <input type="hidden" name="image_url" value={imageUrl} />

                {/* Image upload */}
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]">
                      Image
                    </span>
                  </div>

                  {imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full max-h-50 object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 transition-colors"
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[#E6DFC8] rounded-xl cursor-pointer hover:border-[#5C4033] hover:bg-[#F7F4EA] transition-colors">
                      {uploadingImage ? (
                        <Loader2 className="w-8 h-8 text-[#5F624F] animate-spin mb-2" />
                      ) : (
                        <Upload className="w-8 h-8 text-[#5F624F] opacity-40 mb-2" />
                      )}
                      <span className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
                        {uploadingImage ? "Uploading..." : "Click to upload"}
                      </span>
                      <span className="text-[9px] text-[#5F624F] opacity-60 mt-1">JPG, PNG up to 10MB</span>
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

                  <div className="px-4 sm:px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] opacity-60 mb-2">
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

                  <div className="px-4 sm:px-5 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] opacity-60">
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
                            <span className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 text-[11px] font-black uppercase tracking-wide text-[#5F624F] transition-colors peer-checked:border-[#5C4033] peer-checked:bg-[#5C4033] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#5C4033]">
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
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-4xl">
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
                    setImageUrl(selected?.image_url || "");
                    setIsEditing(true);
                  }}
                  className="h-14 flex-1 rounded-2xl bg-[#B45309] hover:bg-[#B45309]/85 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95"
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
                  type="button"
                  disabled={isPending || uploadingImage}
                  onClick={() => {
                    const form = document.getElementById('special-form') as HTMLFormElement | null;
                    if (form) form.requestSubmit();
                  }}
                  className="h-14 rounded-2xl bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95"
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
  align = "center",
  children,
}: {
  label: string;
  required?: boolean;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4", align === "start" ? "items-start" : "items-center")}>
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

function DetailCell({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={cn("flex gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-b border-[#E6DFC8] last:border-0", multiline ? "items-start" : "items-center")}>
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
      </div>
      <span className={cn("text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug wrap-break-word", multiline && "whitespace-pre-line text-left")}>
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
