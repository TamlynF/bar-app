"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Loader2, ChevronDown, Save, Pencil, Trash2,
  Hash, AlertCircle, ImageIcon, Upload,
} from "lucide-react";
import { saveGalleryImageAction, deleteGalleryImageAction } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type GalleryImage = {
  id: number;
  title: string;
  description: string | null;
  image_url: string;
  media_type: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

export default function GalleryClient({ initialImages = [] }: { initialImages: GalleryImage[] }) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");

  const isSheetOpen = !!selected || isAdding;
  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  const openView = (img: GalleryImage) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(img);
  };

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setImageUrl("");
    setMediaType("image");
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

    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      setFormError(`Upload failed: ${error.message}`);
      setUploadingImage(false);
      return;
    }

    const publicUrl = supabase.storage.from("gallery").getPublicUrl(data.path).data.publicUrl;
    setImageUrl(publicUrl);
    setMediaType(file.type.startsWith("video/") ? "video" : "image");
    setUploadingImage(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);
    startTransition(async () => {
      const result = await saveGalleryImageAction(formData);
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
      title: "Delete image",
      description: "Are you sure? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteGalleryImageAction(selected.id);
      if (result?.error) setFormError(result.error);
      else closeSheet();
    });
  };

  return (
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialImages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
          <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
          <p className="font-black text-sm text-[#1F1F1A]">No gallery images yet</p>
          <p className="mt-1 text-[11px] text-[#5F624F]">Upload your first image to get started</p>
          <button type="button" onClick={openAdd} className="mt-4 h-8 rounded-lg bg-[#1B4332] px-4 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85">
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Upload Image
          </button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
          <div className="flex items-center gap-2 bg-[#F7F4EA] px-4 py-3 sm:px-5">
            <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-[11px] font-bold tracking-wide text-[#5C4033] uppercase">
                Gallery Images <span className="text-[#5F624F]">({initialImages.length})</span>
              </p>
            </button>
            <button type="button" onClick={openAdd} className="flex h-7 w-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] text-white transition-colors hover:bg-[#1B4332]/85 sm:h-7 sm:w-auto sm:px-2.5" title="Add Image">
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden font-black text-[10px] tracking-widest uppercase sm:inline">Upload</span>
            </button>
            <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} className="shrink-0" title="Toggle">
              <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", !isCollapsed && "rotate-180")} />
            </button>
          </div>

          {!isCollapsed && (
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
              {initialImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => openView(img)}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] transition-all hover:border-[#5C4033]"
                >
                  {img.media_type === "video" ? (
                    <video src={img.image_url} className="h-full w-full object-cover" muted preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.image_url} alt={img.title} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2 pt-6">
                    <p className="truncate font-black text-[10px] tracking-tight text-white uppercase">{img.title}</p>
                  </div>
                  {!img.is_active && (
                    <div className="absolute top-1.5 right-1.5 rounded bg-red-500/80 px-1.5 py-0.5 font-black text-[8px] text-white uppercase">Hidden</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Sheet */}
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
          {/* Header */}
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#1F1F1A] uppercase">
                  {isAdding ? "Upload Image" : isEditing ? "Edit Image" : "View Image"}
                </SheetTitle>
                {selected && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-[#5F624F]" />
                    <span className="text-xs font-bold tracking-wide text-[#5F624F] uppercase tabular-nums">ID: {selected.id}</span>
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
                <div className="overflow-hidden rounded-2xl border-2 border-[#E6DFC8]">
                  {selected.media_type === "video" ? (
                    <video src={selected.image_url} className="max-h-75 w-full object-cover" controls muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.image_url} alt={selected.title} className="max-h-75 w-full object-cover" />
                  )}
                </div>
                <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <DetailCell label="Title" value={selected.title} />
                  <DetailCell label="Description" value={selected.description || "—"} />
                  <DetailCell label="Status" value={selected.is_active ? "Active" : "Hidden"} />
                  <DetailCell label="Order" value={String(selected.display_order)} />
                  {selected.created_at && (
                    <DetailCell label="Created" value={new Date(selected.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
                  )}
                </div>
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {/* Form */}
            {showForm && (
              <form id="gallery-form" onSubmit={handleSubmit} className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
                <input type="hidden" name="image_url" value={imageUrl || formDefault?.image_url || ""} />
                <input type="hidden" name="media_type" value={mediaType} />

                {/* Image Upload / Preview */}
                <div className="space-y-3 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white p-4">
                  {(imageUrl || formDefault?.image_url) ? (
                    <div className="relative overflow-hidden rounded-xl">
                      {mediaType === "video" ? (
                        <video src={imageUrl || formDefault?.image_url || ""} className="max-h-50 w-full rounded-xl object-cover" controls muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl || formDefault?.image_url || ""} alt="Preview" className="max-h-50 w-full rounded-xl object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                        title="Delete image"
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
                      <span className="mt-1 text-[9px] text-[#5F624F] opacity-60">Images or videos up to 50MB</span>
                      <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={uploadingImage} />
                    </label>
                  )}
                </div>

                <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <FormRow label="Title" required>
                    <input
                      name="title"
                      required
                      placeholder="e.g. Friday Night Vibes"
                      defaultValue={formDefault?.title ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <FormRow label="Description">
                    <input
                      name="description"
                      placeholder="e.g. Great night at the bar"
                      defaultValue={formDefault?.description ?? ""}
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
                      <option value="false" className="dir-ltr">Hidden</option>
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
                <Button variant="ghost" onClick={handleDelete} disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 font-black text-[10px] tracking-wide text-red-500 uppercase hover:border-red-200 hover:bg-red-50">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
                <Button onClick={() => { setFormError(null); setImageUrl(selected.image_url); setMediaType(selected.media_type === "video" ? "video" : "image"); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#B45309] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#B45309]/85 active:scale-95">
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline"
                  onClick={() => { setFormError(null); if (isAdding) closeSheet(); else setIsEditing(false); }}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  Cancel
                </Button>
                <Button type="button" disabled={isPending || uploadingImage}
                  onClick={() => {
                    const form = document.getElementById('gallery-form') as HTMLFormElement | null;
                    if (form) form.requestSubmit();
                  }}
                  className="h-14 rounded-2xl bg-[#1B4332] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save</>}
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
    <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">{label}</span>
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
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">{label}</span>
      </div>
      <span className="flex-1 text-right font-black text-base leading-snug break-all text-[#1F1F1A] sm:text-sm">{value}</span>
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
