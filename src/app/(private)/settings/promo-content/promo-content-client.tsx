"use client";

import { useState, useTransition, useRef } from "react";
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
  ImageIcon,
  Upload,
  ExternalLink,
  Film,
} from "lucide-react";
import { savePromoAction, deletePromoAction } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

export type PromoRecord = {
  id: number;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string;
  external_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

export default function PromoContentClient({
  initialPromos = [],
}: {
  initialPromos: PromoRecord[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<PromoRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const isSheetOpen = !!selected || isAdding;

  const openView = (p: PromoRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(p);
  };

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setMediaUrl("");
    setMediaType("image");
    setIsAdding(true);
  };

  const startEdit = () => {
    setFormError(null);
    setMediaUrl(selected?.media_url ?? "");
    setMediaType(selected?.media_type ?? "image");
    setIsEditing(true);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
    setMediaUrl("");
    setMediaType("image");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);
    formData.set("media_url", mediaUrl);
    formData.set("media_type", mediaType);
    startTransition(async () => {
      const result = await savePromoAction(formData);
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
      title: "Delete promo",
      description: "Are you sure you want to delete this promo? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deletePromoAction(selected.id);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error: uploadError } = await supabase.storage
      .from("promo-media")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setFormError(uploadError.message);
      setUploading(false);
      return;
    }

    if (data) {
      const publicUrl = supabase.storage
        .from("promo-media")
        .getPublicUrl(data.path).data.publicUrl;
      setMediaUrl(publicUrl);
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  return (
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialPromos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
          <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
          <p className="font-black text-sm text-[#1F1F1A]">No promo content yet</p>
          <p className="mt-1 text-[11px] text-[#5F624F]">
            Upload social media posts and event promos
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 h-8 rounded-lg bg-[#1B4332] px-4 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            Add Promo
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
                Promo Content{" "}
                <span className="text-[#5F624F]">({initialPromos.length})</span>
              </p>
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="flex h-7 w-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] text-white transition-colors hover:bg-[#1B4332]/85 sm:h-7 sm:w-auto sm:px-2.5"
              title="Add Promo"
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
              {initialPromos.map((promo) => {
                const inactive = !promo.is_active;
                return (
                  <div
                    key={promo.id}
                    onClick={() => openView(promo)}
                    className="flex cursor-pointer items-center gap-2 px-3 py-3 transition-colors hover:bg-[#F7F4EA]/50 active:scale-[0.99] sm:gap-3 sm:px-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E6DFC8] bg-[#F7F4EA]">
                      {promo.media_type === "video" ? (
                        <Film className="h-4 w-4 text-[#5F624F]" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={promo.media_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate font-black text-xs leading-snug sm:text-sm",
                            inactive ? "text-[#5F624F]" : "text-[#1F1F1A]"
                          )}
                        >
                          {promo.title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-bold",
                            promo.is_active ? "text-green-600" : "text-red-500"
                          )}
                        >
                          {promo.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="rounded border border-[#E6DFC8] bg-[#F7F4EA] px-1.5 py-0.5 text-[9px] font-bold text-[#5F624F] uppercase">
                          {promo.media_type}
                        </span>
                        {promo.external_url && (
                          <ExternalLink className="h-3 w-3 text-[#5F624F] opacity-50" />
                        )}
                        <span className="truncate text-[10px] font-medium text-[#5F624F]">
                          Order: {promo.display_order}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F] opacity-40" />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

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
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#1F1F1A] uppercase">
                  {isAdding ? "New Promo" : isEditing ? "Edit Promo" : "View Promo"}
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

          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">
            {!showForm && selected && (
              <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <DetailCell label="Title" value={selected.title} />
                  <DetailCell label="Description" value={selected.description || "—"} />
                  <DetailCell label="Media Type" value={selected.media_type} />
                  <DetailCell label="External URL" value={selected.external_url || "—"} />
                  <DetailCell label="Status" value={selected.is_active ? "Active" : "Inactive"} />
                  <DetailCell label="Display Order" value={String(selected.display_order)} />
                </div>

                <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3 text-[#5F624F]" />
                    <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">
                      Preview
                    </span>
                  </div>
                  {selected.media_type === "video" ? (
                    <video
                      src={selected.media_url}
                      controls
                      preload="metadata"
                      className="max-h-60 w-full rounded-xl"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.media_url}
                      alt={selected.title}
                      className="h-40 w-full rounded-xl object-cover"
                    />
                  )}
                </div>

                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {showForm && (
              <form
                id="promo-form"
                onSubmit={handleSubmit}
                className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
              >
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

                <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <FormRow label="Title" required>
                    <input
                      name="title"
                      required
                      placeholder="e.g. June Band Night"
                      defaultValue={formDefault?.title ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <FormRow label="Description">
                    <input
                      name="description"
                      placeholder="e.g. Sat 6th June at DF"
                      defaultValue={formDefault?.description ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <div className="px-4 py-2.5 sm:px-5 sm:py-4">
                    <div className="mb-2 flex items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
                      <span className="text-[10px] font-bold tracking-wide uppercase">
                        Media <span className="text-red-500">*</span>
                      </span>
                    </div>
                    {mediaUrl ? (
                      <div className="relative">
                        {mediaType === "video" ? (
                          <video
                            src={mediaUrl}
                            controls
                            preload="metadata"
                            className="max-h-40 w-full rounded-xl"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl}
                            alt="Preview"
                            className="h-32 w-full rounded-xl object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => { setMediaUrl(""); setMediaType("image"); }}
                          className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                        >
                          x
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E6DFC8] py-6 text-[#5F624F] transition-colors hover:border-[#5C4033] hover:text-[#5C4033]"
                      >
                        {uploading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Upload className="h-5 w-5" />
                        )}
                        <span className="text-xs font-bold tracking-wide uppercase">
                          {uploading ? "Uploading..." : "Upload Image or Video"}
                        </span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      title="Upload media file"
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  <FormRow label="External URL">
                    <input
                      name="external_url"
                      type="url"
                      placeholder="https://instagram.com/p/..."
                      defaultValue={formDefault?.external_url ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <FormRow label="Status">
                    <select
                      title="Status"
                      name="is_active"
                      defaultValue={formDefault?.is_active === false ? "false" : "true"}
                      className="dir-rtl flex-1 cursor-pointer appearance-none bg-transparent font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    >
                      <option value="true" className="dir-ltr">Active</option>
                      <option value="false" className="dir-ltr">Inactive</option>
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
                  onClick={startEdit}
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
                  type="submit"
                  form="promo-form"
                  disabled={isPending || uploading}
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
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
        {required && <span className="text-[10px] font-bold text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#E6DFC8] px-4 py-2.5 last:border-0 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
      </div>
      <span className="flex-1 text-right font-black text-base leading-snug break-all text-[#1F1F1A] sm:text-sm">
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
