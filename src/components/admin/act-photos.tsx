"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Images, Loader2, Plus, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { attempt } from "@/lib/attempt";
import { uploadActImage } from "@/lib/act-image-upload";
import { addActImageAction } from "@/app/(private)/_actions/act-images";
import { arrangePhotoRow, fitThumbnails, SOURCE_LABELS, type ActImage} from "@/lib/act-images";

const THUMB = 80;
const GAP = 12;

const chipClass =
  "pointer-events-none absolute bottom-1 left-1 rounded-md bg-black/65 px-1.5 py-px text-[11px] font-semibold tracking-wide text-white uppercase";

export type ActPhotosProps = {
  actId: string;
  requestId?: string | null;
  images: ActImage[];
  coverId: string | null;
  editable: boolean;
  onImagesChange: (images: ActImage[]) => void;
  onCoverChange: (coverId: string | null) => void;
};

/* One row of equal thumbnails: the poster at the right end, then the newest
   profile picture, the Spotify picture, and whatever else fits. Anything
   left over sits behind a +N button at the left. */
export function ActPhotos({ actId, requestId = null, images, coverId, editable, onImagesChange, onCoverChange }: ActPhotosProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(4);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState<false | "browse" | "pick">(false);
  const [uploading, setUploading] = useState<"poster" | "photos" | null>(null);
  const [posterMenuOpen, setPosterMenuOpen] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => setCapacity(fitThumbnails(el.clientWidth, THUMB, GAP));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const row = arrangePhotoRow(images, coverId, capacity);
  const ordered = [...row.overflow, ...row.tiles.flatMap((t) => (t.kind === "image" ? [t.image] : t.image ? [t.image] : []))];

  async function upload(files: File[], asPoster: boolean) {
    if (files.length === 0) return;
    setUploading(asPoster ? "poster" : "photos");
    let next = images;
    let firstId: string | null = null;
    await attempt(
      async () => {
        for (const file of files) {
          const stored = await uploadActImage(file, actId);
          const result = await addActImageAction({ actId, requestId, url: stored.url, path: stored.path });
          if (!result.ok) throw new Error(result.error);
          next = [result.value, ...next];
          firstId ??= result.value.id;
        }
      },
      (err) => toast.error(err instanceof Error ? err.message : "Upload failed.")
    );
    if (next !== images) onImagesChange(next);
    if (asPoster && firstId) onCoverChange(firstId);
    setUploading(null);
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>, asPoster: boolean) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setPosterMenuOpen(false);
    void upload(asPoster ? files.slice(0, 1) : files, asPoster);
  }

  function pickAsPoster(id: string) {
    onCoverChange(id);
    setAllOpen(false);
    setLightbox(null);
  }

  return (
    <>
      <div ref={rowRef} className="flex items-center justify-end gap-3 p-3 sm:px-5">
        {row.overflow.length > 0 && (
          <button
            type="button"
            onClick={() => setAllOpen("browse")}
            aria-label={`Show ${row.overflow.length} more photos`}
            title={`${row.overflow.length} more`}
            className="flex size-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-admin-line bg-admin-surface text-admin-muted transition-colors hover:border-admin-primary hover:text-admin-primary"
          >
            <Images className="h-5 w-5" aria-hidden="true" />
            <span className="text-[13px] font-semibold">+{row.overflow.length}</span>
          </button>
        )}
        {row.tiles.map((tile) =>
          tile.kind === "image" ? (
            <Thumb key={tile.image.id} image={tile.image} chip={tile.chip} onOpen={() => setLightbox(tile.image.id)} />
          ) : (
            <PosterSlot
              key="poster"
              image={tile.image}
              editable={editable}
              uploading={uploading === "poster"}
              menuOpen={posterMenuOpen}
              onMenuOpenChange={setPosterMenuOpen}
              hasOthers={images.some((i) => i.id !== coverId)}
              onOpen={() => tile.image && setLightbox(tile.image.id)}
              onFiles={(e) => onFiles(e, true)}
              onChoose={() => {
                setPosterMenuOpen(false);
                setAllOpen("pick");
              }}
              onRemove={() => {
                setPosterMenuOpen(false);
                onCoverChange(null);
              }}
            />
          )
        )}
      </div>

      <Lightbox
        images={ordered}
        openId={lightbox}
        coverId={coverId}
        editable={editable}
        onClose={() => setLightbox(null)}
        onNavigate={setLightbox}
        onSetPoster={pickAsPoster}
      />

      <Dialog open={allOpen !== false} onOpenChange={(open) => !open && setAllOpen(false)}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-bg p-0 sm:max-w-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-admin-line px-5 py-4 pr-14">
            <div>
              <DialogTitle className="text-[15px] font-bold text-admin-ink">
                {allOpen === "pick" ? "Choose a poster" : "All photos"}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-admin-muted">
                {allOpen === "pick" ? "Tap a photo to use it as the poster." : `${images.length} photo${images.length === 1 ? "" : "s"}, newest first.`}
              </DialogDescription>
            </div>
            {editable && (
              <label className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#34451F] px-2.5 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8]">
                {uploading === "photos" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                Add photos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  aria-label="Add photos"
                  className="hidden"
                  disabled={!!uploading}
                  onChange={(e) => onFiles(e, false)}
                />
              </label>
            )}
          </div>
          <div className="max-h-[calc(85vh-5rem)] overflow-y-auto p-5">
            {images.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-admin-muted">No photos yet.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {[...images]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((image) => (
                    <li key={image.id} className="flex flex-col gap-1">
                      <Thumb
                        image={image}
                        chip={image.id === coverId ? "Poster" : chipOf(image)}
                        size="full"
                        onOpen={() => (allOpen === "pick" ? pickAsPoster(image.id) : setLightbox(image.id))}
                      />
                      <span className="truncate text-[11px] text-admin-muted">
                        {SOURCE_LABELS[image.source]} · {format(new Date(image.created_at), "d MMM yyyy")}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function chipOf(image: ActImage): string | null {
  if (image.source === "instagram") return "Instagram";
  if (image.source === "messenger") return "Facebook";
  if (image.source === "spotify") return "Spotify";
  return null;
}

function Thumb({
  image,
  chip,
  size = "row",
  onOpen,
}: {
  image: ActImage;
  chip: string | null;
  size?: "row" | "full";
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open photo${chip ? ` (${chip})` : ""}`}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-admin-line bg-admin-surface transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#34451F]/40 focus-visible:outline-none",
        size === "row" ? "size-20" : "aspect-square w-full"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
      {chip && <span className={chipClass}>{chip}</span>}
    </button>
  );
}

function PosterSlot({
  image,
  editable,
  uploading,
  menuOpen,
  hasOthers,
  onMenuOpenChange,
  onOpen,
  onFiles,
  onChoose,
  onRemove,
}: {
  image: ActImage | null;
  editable: boolean;
  uploading: boolean;
  menuOpen: boolean;
  hasOthers: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onOpen: () => void;
  onFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChoose: () => void;
  onRemove: () => void;
}) {
  const menu = editable ? (
    <Popover open={menuOpen} onOpenChange={onMenuOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={image ? "Change poster" : "Add poster"}
          title={image ? "Change poster" : "Add poster"}
          className={cn(
            "absolute flex items-center justify-center rounded-lg text-white transition-colors",
            image ? "top-1 right-1 size-7 bg-black/65 hover:bg-black/85" : "inset-0 size-full rounded-xl bg-transparent"
          )}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : image ? (
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-admin-muted">
              <Upload className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-semibold">Poster</span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 rounded-2xl border-2 border-admin-line bg-white p-1.5">
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold text-admin-ink hover:bg-admin-surface">
          <Upload className="h-4 w-4 text-admin-muted" aria-hidden="true" />
          {image ? "Upload a new one" : "Upload"}
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload poster" className="hidden" onChange={onFiles} />
        </label>
        {hasOthers && (
          <button
            type="button"
            onClick={onChoose}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold text-admin-ink hover:bg-admin-surface"
          >
            <Images className="h-4 w-4 text-admin-muted" aria-hidden="true" />
            Choose from photos
          </button>
        )}
        {image && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold text-admin-error hover:bg-admin-error-bg"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove poster
          </button>
        )}
      </PopoverContent>
    </Popover>
  ) : null;

  if (!image) {
    return (
      <div
        className={cn(
          "relative flex size-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-admin-line bg-admin-surface",
          editable && "transition-colors hover:border-admin-primary"
        )}
      >
        {editable ? menu : <span className="text-[11px] font-semibold text-admin-muted">No poster</span>}
      </div>
    );
  }

  return (
    <div className="relative size-20 shrink-0">
      <Thumb image={image} chip="Poster" onOpen={onOpen} />
      {menu}
    </div>
  );
}

function Lightbox({
  images,
  openId,
  coverId,
  editable,
  onClose,
  onNavigate,
  onSetPoster,
}: {
  images: ActImage[];
  openId: string | null;
  coverId: string | null;
  editable: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onSetPoster: (id: string) => void;
}) {
  const index = images.findIndex((i) => i.id === openId);
  const image = index >= 0 ? images[index] : null;
  const prev = index > 0 ? images[index - 1] : null;
  const next = index >= 0 && index < images.length - 1 ? images[index + 1] : null;

  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-bg p-0 sm:max-w-3xl">
        {image && (
          <>
            <div className="relative flex max-h-[75vh] min-h-48 items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="max-h-[75vh] w-auto max-w-full object-contain" />
              {prev && (
                <button
                  type="button"
                  onClick={() => onNavigate(prev.id)}
                  aria-label="Previous photo"
                  className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
              {next && (
                <button
                  type="button"
                  onClick={() => onNavigate(next.id)}
                  aria-label="Next photo"
                  className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <DialogTitle className="text-[13px] font-bold text-admin-ink">
                  {image.id === coverId ? "Poster" : SOURCE_LABELS[image.source]}
                </DialogTitle>
                <DialogDescription className="text-[12px] text-admin-muted">
                  {format(new Date(image.created_at), "EEE d MMM yyyy, HH:mm")} · {index + 1} of {images.length}
                </DialogDescription>
              </div>
              {editable && image.id !== coverId && (
                <button
                  type="button"
                  onClick={() => onSetPoster(image.id)}
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-[#34451F] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#283719]"
                >
                  <Star className="h-4 w-4" aria-hidden="true" />
                  Set as poster
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
