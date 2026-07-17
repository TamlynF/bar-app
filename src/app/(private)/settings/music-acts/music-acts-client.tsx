"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Loader2, Save, Pencil, Trash2, Hash, AlertCircle, Music2, Star,
  Upload, X, Link2,
} from "lucide-react";
import {
  SiInstagram, SiFacebook, SiYoutube, SiTiktok, SiSpotify,
} from "react-icons/si";
import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { VideoFacade } from "@/components/video-facade";
import { uploadVideoResumable, type ResumableHandle } from "@/lib/resumable-upload";
import type { MusicActRow, SocialLinks } from "@/lib/music-acts";
import { saveMusicActAction, deleteMusicActAction, type MusicActInput } from "./actions";

export type ActCounts = { bookings: number; completed: number; upcoming: number };
export type MusicActWithContact = MusicActRow & {
  contact?: { id: number; full_name: string | null; email: string | null; phone_no: string | null } | null;
};

const supabase = createClient();
const MAX_VIDEOS = 10;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250 MB

const SOCIAL_META: {
  key: keyof SocialLinks;
  Icon: IconType;
  label: string;
  className: string;
}[] = [
  { key: "instagram", Icon: SiInstagram, label: "Instagram", className: "bg-linear-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white" },
  { key: "facebook", Icon: SiFacebook, label: "Facebook", className: "bg-[#1877F2] text-white" },
  { key: "youtube", Icon: SiYoutube, label: "YouTube", className: "bg-[#FF0000] text-white" },
  { key: "tiktok", Icon: SiTiktok, label: "TikTok", className: "bg-black text-white" },
];

type VideoItem = {
  id: string;
  url: string | null;
  description: string;
  uploading: boolean;
  progress: number;
  error: string | null;
  previewUrl?: string;
};

type FormState = {
  group_name: string;
  type: string;
  genre: string;
  introduction: string;
  spotify_url: string;
  web_url: string;
  cover_image_url: string;
  image_urls: string[];
  social_links: SocialLinks;
  bank_account_name: string;
  bank_account_no: string;
  bank_sort_code: string;
  bank_payment_ref: string;
  internal_notes: string;
  is_favorite: boolean;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

function blankForm(): FormState {
  return {
    group_name: "", type: "", genre: "", introduction: "", spotify_url: "", web_url: "",
    cover_image_url: "", image_urls: [], social_links: {},
    bank_account_name: "", bank_account_no: "", bank_sort_code: "", bank_payment_ref: "",
    internal_notes: "", is_favorite: false,
    contact_name: "", contact_email: "", contact_phone: "",
  };
}

function formFromAct(a: MusicActWithContact): FormState {
  return {
    group_name: a.group_name ?? "",
    type: a.type ?? "",
    genre: a.genre ?? "",
    introduction: a.introduction ?? "",
    spotify_url: a.spotify_url ?? "",
    web_url: a.web_url ?? "",
    cover_image_url: a.cover_image_url ?? "",
    image_urls: a.image_urls ?? [],
    social_links: a.social_links ?? {},
    bank_account_name: a.bank_account_name ?? "",
    bank_account_no: a.bank_account_no ?? "",
    bank_sort_code: a.bank_sort_code ?? "",
    bank_payment_ref: a.bank_payment_ref ?? "",
    internal_notes: a.internal_notes ?? "",
    is_favorite: a.is_favorite ?? false,
    contact_name: a.contact?.full_name ?? "",
    contact_email: a.contact?.email ?? "",
    contact_phone: a.contact?.phone_no ?? "",
  };
}

function videosFromAct(a: MusicActWithContact): VideoItem[] {
  return (a.video_urls ?? []).filter(Boolean).map((url, i) => ({
    id: crypto.randomUUID(),
    url,
    description: (a.video_descriptions ?? [])[i]?.trim() || "",
    uploading: false,
    progress: 100,
    error: null,
  }));
}

export default function MusicActsClient({
  initialActs = [],
  counts = {},
  typeOptions = [],
}: {
  initialActs: MusicActWithContact[];
  counts: Record<string, ActCounts>;
  typeOptions: string[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<MusicActWithContact | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(blankForm());
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoHandles = useRef<Record<string, ResumableHandle>>({});

  const isSheetOpen = !!selected || isAdding;
  const showForm = isAdding || isEditing;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openView = (a: MusicActWithContact) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(a);
  };

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setForm(blankForm());
    setVideos([]);
    setIsAdding(true);
  };

  const openEdit = (a: MusicActWithContact) => {
    setFormError(null);
    setForm(formFromAct(a));
    setVideos(videosFromAct(a));
    setIsEditing(true);
  };

  const closeSheet = () => {
    Object.values(videoHandles.current).forEach((h) => h.abort());
    videoHandles.current = {};
    videos.forEach((v) => v.previewUrl && URL.revokeObjectURL(v.previewUrl));
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
    setForm(blankForm());
    setVideos([]);
  };

  // --- Image uploads (cover = single, images = multiple) → `gallery` bucket ---
  const uploadToGallery = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `music-acts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from("gallery").getPublicUrl(data.path).data.publicUrl;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setFormError(null);
    try {
      set("cover_image_url", await uploadToGallery(file));
    } catch (err) {
      setFormError(`Cover upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  };

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingImages(true);
    setFormError(null);
    try {
      const urls = await Promise.all(files.map(uploadToGallery));
      setForm((f) => ({ ...f, image_urls: [...f.image_urls, ...urls] }));
    } catch (err) {
      setFormError(`Image upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const removeImage = (url: string) =>
    setForm((f) => ({ ...f, image_urls: f.image_urls.filter((u) => u !== url) }));

  // --- Video uploads → `band-videos` bucket (resumable) ---
  const patchVideo = (id: string, patch: Partial<VideoItem>) =>
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_VIDEOS - videos.length;
    for (const file of files.slice(0, remaining)) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      if (file.size > MAX_VIDEO_BYTES) {
        setVideos((prev) => [...prev, { id, url: null, description: "", uploading: false, progress: 0, error: "File too large (max 250 MB).", previewUrl }]);
        continue;
      }
      setVideos((prev) => [...prev, { id, url: null, description: "", uploading: true, progress: 0, error: null, previewUrl }]);
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      videoHandles.current[id] = uploadVideoResumable(file, path, {
        onProgress: (pct) => patchVideo(id, { progress: pct }),
        onSuccess: (publicUrl) => { patchVideo(id, { uploading: false, url: publicUrl, progress: 100 }); delete videoHandles.current[id]; },
        onError: (message) => { patchVideo(id, { uploading: false, error: message }); delete videoHandles.current[id]; },
      });
    }
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const removeVideo = (id: string) => {
    videoHandles.current[id]?.abort();
    delete videoHandles.current[id];
    setVideos((prev) => {
      const entry = prev.find((v) => v.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((v) => v.id !== id);
    });
  };

  const uploadingAnyVideo = videos.some((v) => v.uploading);

  const handleSave = () => {
    setFormError(null);
    if (!form.group_name.trim()) { setFormError("Group name is required."); return; }
    if (uploadingAnyVideo) { setFormError("Please wait for videos to finish uploading."); return; }

    const uploaded = videos.filter((v) => v.url);
    const input: MusicActInput = {
      id: isEditing && selected ? selected.id : undefined,
      group_name: form.group_name,
      type: form.type,
      genre: form.genre,
      introduction: form.introduction,
      spotify_url: form.spotify_url,
      web_url: form.web_url,
      cover_image_url: form.cover_image_url,
      image_urls: form.image_urls,
      social_links: form.social_links,
      video_urls: uploaded.map((v) => v.url as string),
      video_descriptions: uploaded.map((v) => v.description.trim()),
      bank_account_name: form.bank_account_name,
      bank_account_no: form.bank_account_no,
      bank_sort_code: form.bank_sort_code,
      bank_payment_ref: form.bank_payment_ref,
      internal_notes: form.internal_notes,
      is_favorite: form.is_favorite,
      contact: { booker_name: form.contact_name, email: form.contact_email, phone_no: form.contact_phone },
    };

    startTransition(async () => {
      const result = await saveMusicActAction(input);
      if ("error" in result) setFormError(result.error);
      else closeSheet();
    });
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Delete music act",
      description: `Delete "${selected.group_name}"? This cannot be undone. Linked band requests are kept but unlinked.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteMusicActAction(selected.id);
      if ("error" in result) setFormError(result.error);
      else closeSheet();
    });
  };

  return (
    <div className="max-w-3xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialActs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
          <Music2 className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
          <p className="font-black text-sm text-[#1F1F1A]">No music acts yet</p>
          <p className="mt-1 text-[11px] text-[#5F624F]">Acts appear here automatically from band applications, or add one manually.</p>
          <button type="button" onClick={openAdd} className="mt-4 h-8 rounded-lg bg-[#1B4332] px-4 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85">
            <Plus className="mr-1 inline h-3.5 w-3.5" /> New Act
          </button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
          <div className="flex items-center gap-2 bg-[#F7F4EA] px-4 py-3 sm:px-5">
            <p className="min-w-0 flex-1 truncate text-[11px] font-bold tracking-wide text-[#5C4033] uppercase">
              Music Acts <span className="text-[#5F624F]">({initialActs.length})</span>
            </p>
            <button type="button" onClick={openAdd} className="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] px-2.5 text-white transition-colors hover:bg-[#1B4332]/85" title="Add music act">
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="font-black text-[10px] tracking-widest uppercase">New</span>
            </button>
          </div>

          <div className="divide-y divide-[#E6DFC8]/60">
            {initialActs.map((a) => {
              const c = counts[a.id] ?? { bookings: 0, completed: 0, upcoming: 0 };
              return (
                <button key={a.id} type="button" onClick={() => openView(a)} className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#F7F4EA] sm:px-5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#E6DFC8] bg-[#F7F4EA]">
                    {a.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center"><Music2 className="h-5 w-5 text-[#5F624F]/40" /></span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {a.is_favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                      <span className="truncate font-black text-sm text-[#1F1F1A]">{a.group_name}</span>
                    </div>
                    <p className="truncate text-[11px] font-medium text-[#5F624F]">
                      {[a.type, a.genre].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <CountChip label="Booked" value={c.bookings} />
                      <CountChip label="Done" value={c.completed} />
                      <CountChip label="Upcoming" value={c.upcoming} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {SOCIAL_META.filter((s) => (a.social_links?.[s.key] ?? "").trim()).map(({ key, Icon, className }) => (
                      <span key={key} className={cn("flex h-5 w-5 items-center justify-center rounded-full", className)}>
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                    ))}
                    {a.spotify_url && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1DB954] text-white"><SiSpotify className="h-2.5 w-2.5" /></span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl outline-none sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto sm:max-h-[80vh] sm:w-140 sm:-translate-x-1/2 sm:rounded-4xl sm:border-2 sm:border-[#E6DFC8]"
        >
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#1F1F1A] uppercase">
              {isAdding ? "New Music Act" : isEditing ? "Edit Music Act" : selected?.group_name}
            </SheetTitle>
            {selected && !showForm && (
              <div className="mt-1 flex items-center gap-1.5">
                <Hash className="h-3 w-3 text-[#5F624F]" />
                <span className="text-xs font-bold tracking-wide text-[#5F624F] uppercase tabular-nums">ID: {selected.id.slice(0, 8)}</span>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">
            {!showForm && selected ? (
              <ViewMode act={selected} counts={counts[selected.id]} />
            ) : (
              <FormMode
                form={form}
                set={set}
                typeOptions={typeOptions}
                videos={videos}
                uploadingCover={uploadingCover}
                uploadingImages={uploadingImages}
                onCoverUpload={handleCoverUpload}
                onImagesUpload={handleImagesUpload}
                onRemoveImage={removeImage}
                onVideoSelect={handleVideoSelect}
                onRemoveVideo={removeVideo}
                onVideoDescription={(id, d) => patchVideo(id, { description: d })}
                videoInputRef={videoInputRef}
              />
            )}
            {formError && <ErrorBox message={formError} />}
            <div className="h-4" />
          </div>

          <div className="z-40 shrink-0 border-t-2 border-[#E6DFC8] bg-white/80 px-6 py-5 pb-10 backdrop-blur-md sm:rounded-b-4xl sm:pb-5">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="ghost" onClick={handleDelete} disabled={isPending} className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 font-black text-[10px] tracking-wide text-red-500 uppercase hover:border-red-200 hover:bg-red-50">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete
                </Button>
                <Button onClick={() => openEdit(selected)} className="h-14 rounded-2xl bg-[#B45309] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#B45309]/85 active:scale-95">
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              </div>
            )}
            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" onClick={() => { setFormError(null); if (isAdding) closeSheet(); else { setIsEditing(false); } }} disabled={isPending} className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={isPending || uploadingCover || uploadingImages || uploadingAnyVideo} className="h-14 rounded-2xl bg-[#1B4332] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95">
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

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#E6DFC8] bg-[#F7F4EA] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#5C4033] uppercase tabular-nums">
      <span className="text-[#1F1F1A]">{value}</span> {label}
    </span>
  );
}

function ViewMode({ act, counts }: { act: MusicActWithContact; counts?: ActCounts }) {
  const c = counts ?? { bookings: 0, completed: 0, upcoming: 0 };
  const socials = SOCIAL_META.map((s) => ({ ...s, url: (act.social_links?.[s.key] ?? "").trim() })).filter((s) => s.url);
  const videos = (act.video_urls ?? []).filter(Boolean).map((url, i) => ({ url, description: (act.video_descriptions ?? [])[i]?.trim() || "" }));
  return (
    <div className="animate-in space-y-4 duration-200 fade-in">
      {act.cover_image_url && (
        <div className="overflow-hidden rounded-2xl border-2 border-[#E6DFC8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={act.cover_image_url} alt={act.group_name} className="max-h-60 w-full object-cover" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <CountChip label="Booked" value={c.bookings} />
        <CountChip label="Completed" value={c.completed} />
        <CountChip label="Upcoming" value={c.upcoming} />
      </div>
      <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
        <DetailCell label="Type" value={act.type || "—"} />
        <DetailCell label="Genre" value={act.genre || "—"} />
        <DetailCell label="Introduction" value={act.introduction || "—"} />
        <DetailCell label="Contact" value={act.contact?.full_name || "—"} />
        <DetailCell label="Email" value={act.contact?.email || "—"} />
        <DetailCell label="Phone" value={act.contact?.phone_no || "—"} />
        {(act.bank_account_no || act.bank_sort_code) && (
          <>
            <DetailCell label="Bank Name" value={act.bank_account_name || "—"} />
            <DetailCell label="Account No" value={act.bank_account_no || "—"} />
            <DetailCell label="Sort Code" value={act.bank_sort_code || "—"} />
            <DetailCell label="Payment Ref" value={act.bank_payment_ref || "—"} />
          </>
        )}
        {act.internal_notes && <DetailCell label="Notes" value={act.internal_notes} />}
      </div>

      {(socials.length > 0 || act.spotify_url || act.web_url) && (
        <div className="flex flex-wrap items-center gap-2">
          {socials.map(({ key, url, Icon, className, label }) => (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer" title={label} className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full", className)}>
              <Icon className="h-4 w-4" />
            </a>
          ))}
          {act.spotify_url && (
            <a href={act.spotify_url} target="_blank" rel="noopener noreferrer" title="Spotify" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1DB954] text-white"><SiSpotify className="h-4 w-4" /></a>
          )}
          {act.web_url && (
            <a href={act.web_url} target="_blank" rel="noopener noreferrer" title="Website" className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-[#E6DFC8] bg-white px-3 font-black text-[10px] tracking-wide text-[#5C4033] uppercase"><Link2 className="h-3.5 w-3.5" /> Website</a>
          )}
        </div>
      )}

      {act.image_urls?.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {act.image_urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="aspect-square w-full rounded-xl border border-[#E6DFC8] object-cover" />
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {videos.map((v, i) => (
            <div key={i} className="min-w-0">
              <VideoFacade url={v.url} title={v.description || `Video ${i + 1}`} />
              {v.description && <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-[#5F624F]">{v.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type SetFn = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function FormMode({
  form, set, typeOptions, videos, uploadingCover, uploadingImages,
  onCoverUpload, onImagesUpload, onRemoveImage, onVideoSelect, onRemoveVideo, onVideoDescription, videoInputRef,
}: {
  form: FormState;
  set: SetFn;
  typeOptions: string[];
  videos: VideoItem[];
  uploadingCover: boolean;
  uploadingImages: boolean;
  onCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImagesUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (url: string) => void;
  onVideoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveVideo: (id: string) => void;
  onVideoDescription: (id: string, d: string) => void;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="animate-in space-y-4 duration-200 fade-in">
      {/* Cover image */}
      <div className="space-y-3 rounded-3xl border-2 border-[#E6DFC8] bg-white p-4">
        <p className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Profile picture</p>
        {form.cover_image_url ? (
          <div className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.cover_image_url} alt="Cover" className="max-h-50 w-full rounded-xl object-cover" />
            <button type="button" onClick={() => set("cover_image_url", "")} title="Remove cover" className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E6DFC8] py-8 transition-colors hover:border-[#5C4033] hover:bg-[#F7F4EA]">
            {uploadingCover ? <Loader2 className="mb-2 h-7 w-7 animate-spin text-[#5F624F]" /> : <Upload className="mb-2 h-7 w-7 text-[#5F624F] opacity-40" />}
            <span className="font-black text-[11px] tracking-wide text-[#5F624F] uppercase">{uploadingCover ? "Uploading..." : "Upload cover"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={onCoverUpload} disabled={uploadingCover} />
          </label>
        )}
      </div>

      {/* Core details */}
      <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
        <TextRow label="Group name" required value={form.group_name} onChange={(v) => set("group_name", v)} placeholder="e.g. The Rolling Stones" />
        <TextRow label="Type" value={form.type} onChange={(v) => set("type", v)} placeholder="Band / Singer / DJ" list="music-act-types" />
        <datalist id="music-act-types">{typeOptions.map((t) => <option key={t} value={t} />)}</datalist>
        <TextRow label="Genre" value={form.genre} onChange={(v) => set("genre", v)} placeholder="e.g. Rock" />
      </div>

      <TextAreaCard label="Introduction" value={form.introduction} onChange={(v) => set("introduction", v)} placeholder="A short bio / description of the act…" />

      {/* Links */}
      <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
        <TextRow label="Spotify" value={form.spotify_url} onChange={(v) => set("spotify_url", v)} placeholder="https://open.spotify.com/artist/…" type="url" />
        <TextRow label="Website" value={form.web_url} onChange={(v) => set("web_url", v)} placeholder="https://…" type="url" />
        {SOCIAL_META.map(({ key, label }) => (
          <TextRow key={key} label={label} value={form.social_links[key] ?? ""} onChange={(v) => set("social_links", { ...form.social_links, [key]: v })} placeholder={`${label} URL`} type="url" />
        ))}
      </div>

      {/* Contact */}
      <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
        <TextRow label="Contact name" value={form.contact_name} onChange={(v) => set("contact_name", v)} placeholder="Booker name" />
        <TextRow label="Email" value={form.contact_email} onChange={(v) => set("contact_email", v)} placeholder="email@example.com" type="email" />
        <TextRow label="Phone" value={form.contact_phone} onChange={(v) => set("contact_phone", v)} placeholder="Phone number" type="tel" />
      </div>

      {/* Bank */}
      <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
        <TextRow label="Bank name" value={form.bank_account_name} onChange={(v) => set("bank_account_name", v)} placeholder="Account holder" />
        <TextRow label="Account no" value={form.bank_account_no} onChange={(v) => set("bank_account_no", v)} placeholder="12345678" />
        <TextRow label="Sort code" value={form.bank_sort_code} onChange={(v) => set("bank_sort_code", v)} placeholder="12-34-56" />
        <TextRow label="Payment ref" value={form.bank_payment_ref} onChange={(v) => set("bank_payment_ref", v)} placeholder="Reference" />
      </div>

      <TextAreaCard label="Internal notes" value={form.internal_notes} onChange={(v) => set("internal_notes", v)} placeholder="Private notes about this act…" />

      {/* Favourite */}
      <button type="button" onClick={() => set("is_favorite", !form.is_favorite)} className={cn("flex w-full items-center justify-between rounded-3xl border-2 bg-white px-4 py-3.5 transition-colors", form.is_favorite ? "border-amber-300" : "border-[#E6DFC8]")}>
        <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Favourite</span>
        <Star className={cn("h-5 w-5", form.is_favorite ? "fill-amber-400 text-amber-400" : "text-[#5F624F]/30")} />
      </button>

      {/* Additional images */}
      <div className="space-y-3 rounded-3xl border-2 border-[#E6DFC8] bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Photos</p>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1B4332] px-2.5 py-1.5 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
            {uploadingImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Add
            <input type="file" accept="image/*" multiple className="hidden" onChange={onImagesUpload} disabled={uploadingImages} />
          </label>
        </div>
        {form.image_urls.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {form.image_urls.map((url) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-[#E6DFC8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => onRemoveImage(url)} title="Remove photo" className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Videos */}
      <div className="space-y-3 rounded-3xl border-2 border-[#E6DFC8] bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Videos <span className="opacity-60">{videos.length}/{MAX_VIDEOS}</span></p>
          {videos.length < MAX_VIDEOS && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1B4332] px-2.5 py-1.5 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
              <Upload className="h-3.5 w-3.5" /> Add
              <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" multiple className="hidden" onChange={onVideoSelect} />
            </label>
          )}
        </div>
        {videos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.map((v, i) => (
              <div key={v.id} className="min-w-0">
                {v.url ? (
                  <VideoFacade url={v.url} title={v.description || `Video ${i + 1}`} />
                ) : (
                  <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border border-black/10 bg-[#1F1F1A]">
                    {v.previewUrl && <video src={`${v.previewUrl}#t=0.1`} muted playsInline preload="metadata" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
                    <span className="absolute inset-0 bg-black/50" />
                    {v.error ? (
                      <span className="relative flex flex-col items-center gap-1 px-2 text-center"><AlertCircle className="h-5 w-5 text-red-300" /><span className="text-[10px] font-bold text-red-200">{v.error}</span></span>
                    ) : (
                      <span className="relative flex flex-col items-center gap-1.5"><Loader2 className="h-5 w-5 animate-spin text-white" /><span className="font-black text-[10px] tracking-wide text-white uppercase tabular-nums">{v.progress}%</span></span>
                    )}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1">
                  <input type="text" aria-label={`Description for video ${i + 1}`} maxLength={120} value={v.description} onChange={(e) => onVideoDescription(v.id, e.target.value)} placeholder="Description…" className="min-w-0 flex-1 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 text-[11px] text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30" />
                  <button type="button" onClick={() => onRemoveVideo(v.id)} title="Remove video" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#E6DFC8] bg-white text-[#5F624F]/60 hover:border-red-200 hover:bg-red-50 hover:text-red-600"><X className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextRow({
  label, value, onChange, placeholder, required, type = "text", list,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; type?: string; list?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-3.5">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">{label}</span>
        {required && <span className="text-[10px] font-bold text-red-500">*</span>}
      </div>
      <input
        type={type}
        list={list}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
      />
    </div>
  );
}

function TextAreaCard({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2 rounded-3xl border-2 border-[#E6DFC8] bg-white p-4">
      <label className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-sm text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 focus:border-[#5C4033]/30"
      />
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 border-b border-[#E6DFC8] px-4 py-2.5 last:border-0 sm:gap-3 sm:px-5 sm:py-3.5">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">{label}</span>
      </div>
      <span className="flex-1 text-right font-black text-base leading-snug wrap-break-word text-[#1F1F1A] sm:text-sm">{value}</span>
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
