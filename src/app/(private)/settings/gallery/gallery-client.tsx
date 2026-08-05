"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  Check,
  X,
  SearchX,
  AlertTriangle,
  Image as ImageIcon,
  Film,
  Upload,
} from "lucide-react";
import { saveGalleryImageAction, deleteGalleryImageAction } from "./actions";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  gradeGalleryMedia,
  LIGHTBOX_IDEAL_EDGE,
  LIGHTBOX_MIN_EDGE,
  QUALITY_BADGE,
  QUALITY_SUMMARY,
  type MediaKind,
  type QualityLevel,
} from "@/lib/gallery-media-quality";
import {
  planSave,
  planDelete,
  describeChanges,
  nextPosition,
  type ChangeDescription,
  type OrderRow,
} from "@/lib/merchandise-order";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
} from "@/components/admin";

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

export type EmployeeOption = { id: number; full_name: string };

type MeasuredMedia = { width: number; height: number; level: QualityLevel };

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
const FIELD_SELECT =
  "flex-1 cursor-pointer appearance-none bg-transparent text-right text-sm font-semibold text-admin-ink outline-none";

function kindOf(mediaType: string): MediaKind {
  return mediaType === "video" ? "video" : "image";
}

function measureMedia(file: File, kind: MediaKind): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);

    const finish = (width: number, height: number) => {
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };

    if (kind === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () => finish(video.videoWidth, video.videoHeight);
      video.onerror = () => finish(0, 0);
      video.src = url;
      return;
    }

    const img = document.createElement("img");
    img.onload = () => finish(img.naturalWidth, img.naturalHeight);
    img.onerror = () => finish(0, 0);
    img.src = url;
  });
}

export default function GalleryClient({
  initialImages = [],
  employees = [],
}: {
  initialImages: GalleryImage[];
  employees?: EmployeeOption[];
}) {
  const sheet = useRecordSheet<GalleryImage>({
    records: initialImages,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [mediaType, setMediaType] = useState<MediaKind>("image");
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);
  const [mediaSizes, setMediaSizes] = useState<Record<number, MeasuredMedia>>({});
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState(1);

  const orderRows: OrderRow[] = initialImages.map((img) => ({
    id: img.id,
    name: img.title,
    display_order: img.display_order,
    is_active: img.is_active,
  }));

  const activeCount = orderRows.filter((row) => row.is_active).length;
  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;
  const wasActive = formDefault?.is_active ?? false;
  const canChoosePosition = !!formDefault && wasActive && isActive;

  const plan = planSave(orderRows, {
    id: formDefault?.id ?? null,
    isActive,
    targetPosition: canChoosePosition ? position : null,
  });
  const affected = describeChanges(orderRows, plan.changes);

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  // Thumbnails load the real file, so the row that shows a record is also what
  // measures it. Nothing else has the dimensions until then.
  const recordMediaSize = (id: number, width: number, height: number, kind: MediaKind) => {
    if (!width || !height) return;
    setMediaSizes((prev) => {
      const known = prev[id];
      if (known && known.width === width && known.height === height) return prev;
      return {
        ...prev,
        [id]: { width, height, level: gradeGalleryMedia({ width, height, kind }).level },
      };
    });
  };

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialImages;
    return initialImages.filter((img) =>
      [img.title, img.description ?? "", img.media_type].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [initialImages, query]);

  const openAdd = () => {
    setImageUrl("");
    setMediaType("image");
    setMediaWarning(null);
    setIsActive(true);
    setPosition(nextPosition(orderRows));
    sheet.openAdd();
  };

  const startEdit = () => {
    if (!selected) return;
    setImageUrl(selected.image_url);
    setMediaType(kindOf(selected.media_type));
    setMediaWarning(null);
    setIsActive(selected.is_active);
    setPosition(selected.display_order || nextPosition(orderRows));
    sheet.startEdit();
  };

  const closeSheet = () => {
    setImageUrl("");
    setMediaWarning(null);
    sheet.close();
  };

  const cancel = () => {
    setMediaWarning(null);
    if (mode === "add") closeSheet();
    else if (selected) sheet.openView(selected);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    sheet.setFormError(null);
    setMediaWarning(null);

    const kind: MediaKind = file.type.startsWith("video/") ? "video" : "image";
    const { width, height } = await measureMedia(file, kind);
    const quality = gradeGalleryMedia({ width, height, kind });

    if (quality.level === "reject") {
      sheet.setFormError(quality.message);
      setUploadingImage(false);
      input.value = "";
      return;
    }

    if (quality.level === "warn") setMediaWarning(quality.message);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      sheet.setFormError(`Upload failed: ${error.message}`);
      setMediaWarning(null);
      setUploadingImage(false);
      input.value = "";
      return;
    }

    const publicUrl = supabase.storage.from("gallery").getPublicUrl(data.path).data.publicUrl;
    setImageUrl(publicUrl);
    setMediaType(kind);
    setUploadingImage(false);
    input.value = "";
  };

  const reorderPrompt = (title: string) => {
    if (wasActive && !isActive) {
      return `Hiding "${title}" will move it to position 0 and update:`;
    }
    if (!wasActive && isActive) {
      return `Showing "${title}" will place it at position ${plan.position} and update:`;
    }
    return `Moving "${title}" to position ${plan.position} will also update:`;
  };

  // Submitted by hand rather than as a form action, so the reorder warning can be
  // answered before anything is written.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submit = sheet.submit(saveGalleryImageAction);

    if (affected.length === 0) {
      submit(formData);
      return;
    }

    const ok = await sheet.confirm({
      title: "Reorder gallery",
      description: reorderPrompt(formData.get("title")?.toString().trim() || "this image"),
      content: <ChangeList changes={affected} />,
      confirmLabel: "Update order",
    });
    if (ok) submit(formData);
  };

  const handleDelete = () => {
    if (!selected) return;
    const cascade = describeChanges(orderRows, planDelete(orderRows, selected.id));
    sheet.confirmDelete({
      title: "Delete image",
      description:
        cascade.length > 0
          ? "Are you sure you want to delete this image? This cannot be undone. These positions will shift up:"
          : "Are you sure you want to delete this image? This cannot be undone.",
      content: cascade.length > 0 ? <ChangeList changes={cascade} /> : undefined,
      action: () => deleteGalleryImageAction(selected.id),
    });
  };

  const title =
    mode === "add" ? "New image" : mode === "edit" ? "Edit image" : "View image";

  const selectedSize = selected ? mediaSizes[selected.id] : undefined;

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialImages.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No gallery images yet"
          description="Upload your first image to get started"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Upload image
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Gallery images"
          count={shown.length}
          onAdd={openAdd}
          addLabel="Upload"
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search gallery images"
              placeholder="Search by title, description or type"
            />
          }
        >
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
              <SearchX className="mb-1 h-7 w-7 text-admin-muted opacity-30" />
              <p className="text-sm font-semibold text-admin-ink">No matches</p>
              <p className="text-[11px] text-admin-muted">
                Nothing here matches &ldquo;{query.trim()}&rdquo;
              </p>
            </div>
          ) : (
            shown.map((img) => {
              const kind = kindOf(img.media_type);
              const measured = mediaSizes[img.id];
              return (
                <ListRow
                  key={img.id}
                  onClick={() => sheet.openView(img)}
                  status={
                    <StatusPill
                      tone={img.is_active ? "success" : "error"}
                      icon={
                        img.is_active ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )
                      }
                      className="sm:w-24 sm:justify-center"
                    >
                      {img.is_active ? "Active" : "Hidden"}
                    </StatusPill>
                  }
                >
                  <span
                    className="w-6 shrink-0 text-center text-xs font-semibold text-admin-muted tabular-nums opacity-60"
                    title={
                      img.is_active
                        ? `Position ${img.display_order}`
                        : "Hidden images have no position"
                    }
                  >
                    {img.is_active ? img.display_order : "-"}
                  </span>

                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
                    {kind === "video" ? (
                      <video
                        src={img.image_url}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                        onLoadedMetadata={(e) =>
                          recordMediaSize(
                            img.id,
                            e.currentTarget.videoWidth,
                            e.currentTarget.videoHeight,
                            "video",
                          )
                        }
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={img.image_url}
                        alt={img.title}
                        className="h-full w-full object-cover"
                        onLoad={(e) =>
                          recordMediaSize(
                            img.id,
                            e.currentTarget.naturalWidth,
                            e.currentTarget.naturalHeight,
                            "image",
                          )
                        }
                      />
                    )}
                  </div>

                  {/* Fixed tracks rather than content-sized ones, so the type of
                      every row starts in the same place. */}
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1.4fr)] sm:items-center sm:gap-3">
                    <p
                      className={cn(
                        "min-w-0 truncate text-sm leading-snug font-semibold",
                        img.is_active ? "text-admin-ink" : "text-admin-muted",
                      )}
                    >
                      {img.title}
                    </p>

                    <div className="mt-0.5 flex items-center gap-1.5 sm:mt-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-admin-muted sm:text-[12px]">
                        {kind === "video" ? (
                          <Film className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                        ) : (
                          <ImageIcon
                            className="h-3.5 w-3.5 shrink-0 opacity-60"
                            aria-hidden="true"
                          />
                        )}
                        {kind === "video" ? "Video" : "Image"}
                      </span>
                      {measured && measured.level !== "good" && (
                        <StatusPill
                          tone={measured.level === "reject" ? "error" : "warning"}
                          className="hidden sm:inline-flex"
                        >
                          {QUALITY_BADGE[measured.level]}
                        </StatusPill>
                      )}
                    </div>

                    <p className="hidden truncate text-[11px] font-medium text-admin-muted sm:block">
                      {img.description || "No description"}
                    </p>
                  </div>
                </ListRow>
              );
            })
          )}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={closeSheet}
        mode={mode}
        title={title}
        recordId={selected?.id}
        formId="gallery-form"
        isPending={sheet.isPending}
        saveDisabled={uploadingImage}
        onEdit={startEdit}
        onDelete={handleDelete}
        onCancel={cancel}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <StatusPill
              tone={selected.is_active ? "success" : "error"}
              icon={
                selected.is_active ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )
              }
              showLabelOnMobile
            >
              {selected.is_active ? "Active" : "Hidden"}
            </StatusPill>
          )
        }
        systemInfo={
          selected == null
            ? undefined
            : {
                createdAt: selected.created_at,
                createdBy: employeeName(selected.created_by),
                updatedAt: selected.updated_at,
                updatedBy: employeeName(selected.updated_by),
              }
        }
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard className="p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3 text-admin-muted" />
                <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                  Preview
                </span>
              </div>
              {kindOf(selected.media_type) === "video" ? (
                <video
                  src={selected.image_url}
                  className="h-48 w-full rounded-xl object-contain sm:h-auto sm:max-h-75"
                  controls
                  muted
                  onLoadedMetadata={(e) =>
                    recordMediaSize(
                      selected.id,
                      e.currentTarget.videoWidth,
                      e.currentTarget.videoHeight,
                      "video",
                    )
                  }
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={selected.image_url}
                  alt={selected.title}
                  className="h-48 w-full rounded-xl object-contain sm:h-auto sm:max-h-75"
                  onLoad={(e) =>
                    recordMediaSize(
                      selected.id,
                      e.currentTarget.naturalWidth,
                      e.currentTarget.naturalHeight,
                      "image",
                    )
                  }
                />
              )}
            </DetailCard>

            {selectedSize?.level === "reject" && (
              <WarningBox
                message={`Only ${selectedSize.width} x ${selectedSize.height} - this looks blurry when opened fullscreen on the public gallery. Replace it with a file of at least ${LIGHTBOX_MIN_EDGE[kindOf(selected.media_type)]}px on the longest side.`}
              />
            )}

            <DetailCard>
              <DetailCell dense label="Title" value={selected.title} />
              <DetailCell dense label="Description" value={selected.description || "-"} />
              <DetailCell
                dense
                label="Type"
                value={kindOf(selected.media_type) === "video" ? "Video" : "Image"}
              />
              <DetailCell
                dense
                label="Position"
                value={selected.is_active ? String(selected.display_order) : "0 (hidden)"}
              />
              {selectedSize && (
                <DetailCell
                  dense
                  label="Size"
                  value={`${selectedSize.width} x ${selectedSize.height} - ${QUALITY_SUMMARY[selectedSize.level]}`}
                />
              )}
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="gallery-form"
            onSubmit={handleSubmit}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
            <input type="hidden" name="image_url" value={imageUrl} />
            <input type="hidden" name="media_type" value={mediaType} />

            <DetailCard className="space-y-3 p-4">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3 text-admin-muted" />
                <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                  Media
                </span>
              </div>

              {imageUrl ? (
                <div className="relative overflow-hidden rounded-xl">
                  {mediaType === "video" ? (
                    <video
                      src={imageUrl}
                      className="h-48 w-full rounded-xl object-contain sm:h-auto sm:max-h-64"
                      controls
                      muted
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="h-48 w-full rounded-xl object-contain sm:h-auto sm:max-h-64"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl("");
                      setMediaWarning(null);
                    }}
                    className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                    aria-label="Remove media"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-admin-line py-8 transition-colors hover:border-admin-primary hover:bg-admin-surface">
                  {uploadingImage ? (
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-admin-muted" />
                  ) : (
                    <Upload className="mb-2 h-8 w-8 text-admin-muted opacity-40" />
                  )}
                  <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                    {uploadingImage ? "Uploading..." : "Click to upload"}
                  </span>
                  <span className="mt-1 text-[10px] text-admin-muted opacity-60">
                    Images or videos up to 50MB
                  </span>
                  <span className="mt-1 text-[10px] text-admin-muted opacity-60">
                    Longest side {LIGHTBOX_MIN_EDGE.image}px minimum, {LIGHTBOX_IDEAL_EDGE}px
                    ideal - the gallery opens fullscreen
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    aria-label="Upload gallery media"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploadingImage}
                  />
                </label>
              )}

              {mediaWarning && <WarningBox message={mediaWarning} />}
            </DetailCard>

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Title" required>
                <input
                  name="title"
                  required
                  aria-label="Title"
                  placeholder="e.g. Friday Night Vibes"
                  defaultValue={formDefault?.title ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Description">
                <input
                  name="description"
                  aria-label="Description"
                  placeholder="e.g. Great night at the bar"
                  defaultValue={formDefault?.description ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Status">
                <select
                  name="is_active"
                  aria-label="Status"
                  value={isActive ? "true" : "false"}
                  onChange={(e) => setIsActive(e.target.value === "true")}
                  className={FIELD_SELECT}
                >
                  <option value="true">Active</option>
                  <option value="false">Hidden</option>
                </select>
              </FormRow>

              <FormRow label="Position">
                {canChoosePosition ? (
                  <input
                    name="display_order"
                    type="number"
                    min={1}
                    max={activeCount}
                    inputMode="numeric"
                    aria-label="Position in the gallery"
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    className={cn(FIELD_INPUT, "tabular-nums")}
                  />
                ) : (
                  <input
                    name="display_order"
                    type="number"
                    readOnly
                    aria-label="Position in the gallery"
                    value={plan.position}
                    className="flex-1 cursor-not-allowed bg-transparent text-right text-sm font-semibold text-admin-muted opacity-60 outline-none tabular-nums"
                  />
                )}
              </FormRow>

              <div className="px-4 pt-0 pb-3 sm:px-5">
                <p className="text-[11px] font-medium text-admin-muted opacity-70">
                  {!isActive
                    ? "Hidden images have no position and are left out of the gallery."
                    : canChoosePosition
                      ? `Positions run 1 to ${activeCount}. Changing this reorders the others.`
                      : "New images are added to the end of the gallery."}
                </p>
              </div>
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </form>
        )}
      </RecordSheet>
    </div>
  );
}

function ChangeList({ changes }: { changes: ChangeDescription[] }) {
  return (
    <ul className="divide-y divide-admin-line overflow-hidden rounded-2xl border border-admin-line bg-admin-card">
      {changes.map((change) => (
        <li key={change.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-admin-ink">
            {change.name}
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-admin-muted tabular-nums">
            {change.from} → {change.to}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WarningBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-admin-warning/30 bg-admin-warning-bg p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-admin-warning" />
      <p className="text-[11px] leading-snug font-semibold text-admin-warning">{message}</p>
    </div>
  );
}
