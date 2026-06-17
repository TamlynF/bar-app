"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Loader2, ChevronRight, ChevronDown, Save, Pencil, Trash2,
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
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">
      {initialImages.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <ImageIcon className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No gallery images yet</p>
          <p className="text-[11px] text-[#5F624F] mt-1">Upload your first image to get started</p>
          <button type="button" onClick={openAdd} className="mt-4 h-8 px-4 rounded-lg bg-[#5C4033] text-white text-[10px] font-bold uppercase tracking-wide hover:bg-[#5C4033]/85 transition-colors">
            <Plus className="w-3.5 h-3.5 inline mr-1" /> Upload Image
          </button>
        </div>
      ) : (
        <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
          <div className="flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3 gap-2">
            <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} className="flex-1 min-w-0 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#5C4033] truncate">
                Gallery Images <span className="text-[#5F624F]">({initialImages.length})</span>
              </p>
            </button>
            <button type="button" onClick={openAdd} className="w-7 h-7 sm:h-7 sm:w-auto sm:px-2.5 rounded-lg bg-[#5C4033] text-white hover:bg-[#5C4033]/85 transition-colors flex items-center justify-center gap-1.5 shrink-0" title="Add Image">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wide">Upload</span>
            </button>
            <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} className="shrink-0" title="Toggle">
              <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", !isCollapsed && "rotate-180")} />
            </button>
          </div>

          {!isCollapsed && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
              {initialImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => openView(img)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-[#F7F4EA] border border-[#E6DFC8] hover:border-[#5C4033] transition-all"
                >
                  {img.media_type === "video" ? (
                    <video src={img.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.image_url} alt={img.title} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2 pt-6">
                    <p className="text-white text-[10px] font-black uppercase tracking-tight truncate">{img.title}</p>
                  </div>
                  {!img.is_active && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-red-500/80 rounded text-[8px] font-black text-white uppercase">Hidden</div>
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
                  {isAdding ? "Upload Image" : isEditing ? "Edit Image" : "View Image"}
                </SheetTitle>
                {selected && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-xs font-bold text-[#5F624F] uppercase tracking-wide tabular-nums">ID: {selected.id}</span>
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
                <div className="rounded-2xl overflow-hidden border-2 border-[#E6DFC8]">
                  {selected.media_type === "video" ? (
                    <video src={selected.image_url} className="w-full max-h-75 object-cover" controls muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.image_url} alt={selected.title} className="w-full max-h-75 object-cover" />
                  )}
                </div>
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
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
              <form id="gallery-form" onSubmit={handleSubmit} className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
                <input type="hidden" name="image_url" value={imageUrl || formDefault?.image_url || ""} />
                <input type="hidden" name="media_type" value={mediaType} />

                {/* Image Upload / Preview */}
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden p-4 space-y-3">
                  {(imageUrl || formDefault?.image_url) ? (
                    <div className="relative rounded-xl overflow-hidden">
                      {mediaType === "video" ? (
                        <video src={imageUrl || formDefault?.image_url || ""} className="w-full max-h-50 object-cover rounded-xl" controls muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl || formDefault?.image_url || ""} alt="Preview" className="w-full max-h-50 object-cover rounded-xl" />
                      )}
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 transition-colors"
                        title="Delete image"
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
                      <span className="text-[9px] text-[#5F624F] opacity-60 mt-1">Images or videos up to 50MB</span>
                      <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={uploadingImage} />
                    </label>
                  )}
                </div>

                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  <FormRow label="Title" required>
                    <input
                      name="title"
                      required
                      placeholder="e.g. Friday Night Vibes"
                      defaultValue={formDefault?.title ?? ""}
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  <FormRow label="Description">
                    <input
                      name="description"
                      placeholder="e.g. Great night at the bar"
                      defaultValue={formDefault?.description ?? ""}
                      className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  <FormRow label="Status">
                    <select
                      title="Status"
                      name="is_active"
                      defaultValue={formDefault?.is_active === false ? "false" : "true"}
                      className="text-base sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
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
                <Button variant="ghost" onClick={handleDelete} disabled={isPending}
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-wide text-[10px] bg-white hover:bg-red-50 hover:border-red-200">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete
                </Button>
                <Button onClick={() => { setFormError(null); setImageUrl(selected.image_url); setMediaType(selected.media_type === "video" ? "video" : "image"); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95">
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline"
                  onClick={() => { setFormError(null); if (isAdding) closeSheet(); else setIsEditing(false); }}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white">
                  Cancel
                </Button>
                <Button type="button" disabled={isPending || uploadingImage}
                  onClick={() => {
                    const form = document.getElementById('gallery-form') as HTMLFormElement | null;
                    if (form) form.requestSubmit();
                  }}
                  className="h-14 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save</>}
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
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">{label}</span>
        {required && <span className="text-red-500 text-[10px] font-bold">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      <span className="text-base sm:text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug break-all">{value}</span>
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
