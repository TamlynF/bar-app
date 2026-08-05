"use client";

import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Loader2,
  Check,
  X,
  SearchX,
  ImageIcon,
  Upload,
  ExternalLink,
  Film,
} from "lucide-react";
import { savePromoAction, deletePromoAction } from "./actions";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
} from "@/components/admin";

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

export type EmployeeOption = { id: number; full_name: string };

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
const FIELD_SELECT =
  "flex-1 cursor-pointer appearance-none bg-transparent text-right text-sm font-semibold text-admin-ink outline-none";

export default function PromoContentClient({
  initialPromos = [],
  employees = [],
}: {
  initialPromos: PromoRecord[];
  employees?: EmployeeOption[];
}) {
  const sheet = useRecordSheet<PromoRecord>({
    records: initialPromos,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialPromos;
    return initialPromos.filter((promo) =>
      [promo.title, promo.description, promo.external_url, promo.media_type].some(
        (field) => field?.toLowerCase().includes(needle),
      ),
    );
  }, [initialPromos, query]);

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;

  const openAdd = () => {
    setMediaUrl("");
    setMediaType("image");
    sheet.openAdd();
  };

  const startEdit = () => {
    setMediaUrl(selected?.media_url ?? "");
    setMediaType(selected?.media_type ?? "image");
    sheet.startEdit();
  };

  const closeSheet = () => {
    setMediaUrl("");
    setMediaType("image");
    sheet.close();
  };

  const cancel = () => {
    if (mode === "add") closeSheet();
    else if (selected) sheet.openView(selected);
  };

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Delete promo",
      description:
        "Are you sure you want to delete this promo? This cannot be undone.",
      action: () => deletePromoAction(selected.id),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    sheet.setFormError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("promo-media")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      sheet.setFormError(error.message);
      setUploading(false);
      return;
    }

    if (data) {
      const publicUrl = supabase.storage.from("promo-media").getPublicUrl(data.path)
        .data.publicUrl;
      setMediaUrl(publicUrl);
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const title =
    mode === "add" ? "New promo" : mode === "edit" ? "Edit promo" : "View promo";

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialPromos.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No promo content yet"
          description="Upload social media posts and event promos"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create promo
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Promo content"
          count={shown.length}
          onAdd={openAdd}
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search promo content"
              placeholder="Search by title, description or link"
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
            shown.map((promo) => {
              const inactive = !promo.is_active;
              return (
                <ListRow
                  key={promo.id}
                  onClick={() => sheet.openView(promo)}
                  status={
                    <StatusPill
                      tone={promo.is_active ? "success" : "error"}
                      icon={
                        promo.is_active ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )
                      }
                      className="sm:w-24 sm:justify-center"
                    >
                      {promo.is_active ? "Active" : "Inactive"}
                    </StatusPill>
                  }
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
                    {promo.media_type === "video" ? (
                      <Film className="h-4 w-4 text-admin-muted" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={promo.media_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  {/* Fixed tracks rather than content-sized ones, so the order and
                      the badges of every row line up down the list. */}
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1.2fr)_9rem] sm:items-center sm:gap-3">
                    <p
                      className={cn(
                        "min-w-0 truncate text-sm leading-snug font-semibold",
                        inactive ? "text-admin-muted" : "text-admin-ink",
                      )}
                    >
                      {promo.title}
                    </p>

                    <p className="mt-0.5 truncate text-[11px] font-medium text-admin-muted tabular-nums sm:mt-0 sm:text-[12px]">
                      Order {promo.display_order}
                    </p>

                    <p className="hidden truncate text-[12px] font-medium text-admin-muted sm:block">
                      {promo.description || "No description"}
                    </p>

                    <div className="mt-1 flex items-center gap-1.5 sm:mt-0">
                      <InfoBadge icon={null} className="capitalize">
                        {promo.media_type}
                      </InfoBadge>
                      {promo.external_url && (
                        <InfoBadge icon={<ExternalLink className="h-3 w-3" />}>
                          <span className="hidden sm:inline">Link</span>
                        </InfoBadge>
                      )}
                    </div>
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
        formId="promo-form"
        isPending={sheet.isPending}
        saveDisabled={uploading}
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
              {selected.is_active ? "Active" : "Inactive"}
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
            <DetailCard>
              <DetailCell dense label="Title" value={selected.title} />
              <DetailCell
                dense
                label="Description"
                value={selected.description || "-"}
              />
              <DetailCell
                dense
                label="Media type"
                value={selected.media_type}
                valueClassName="capitalize"
              />
              <DetailCell
                dense
                label="External URL"
                value={
                  selected.external_url ? (
                    <a
                      href={selected.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 break-all underline hover:text-admin-primary"
                    >
                      {selected.external_url}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    "-"
                  )
                }
              />
              <DetailCell
                dense
                label="Display order"
                value={String(selected.display_order)}
              />
            </DetailCard>

            <DetailCard className="p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3 text-admin-muted" />
                <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
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
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={selected.media_url}
                  alt={selected.title}
                  className="h-32 w-full rounded-xl object-contain sm:h-auto sm:max-h-64"
                />
              )}
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="promo-form"
            action={sheet.submit(savePromoAction)}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
            <input type="hidden" name="media_url" value={mediaUrl} />
            <input type="hidden" name="media_type" value={mediaType} />

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Title" required>
                <input
                  name="title"
                  required
                  aria-label="Title"
                  placeholder="e.g. June Band Night"
                  defaultValue={formDefault?.title ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Description">
                <input
                  name="description"
                  aria-label="Description"
                  placeholder="e.g. Sat 6th June at DF"
                  defaultValue={formDefault?.description ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <div className="px-4 py-2.5 sm:px-5 sm:py-4">
                <div className="mb-2 flex items-center gap-1.5 text-admin-muted opacity-70 sm:gap-2">
                  <span className="text-[11px] font-semibold tracking-wide">
                    Media <span className="text-admin-error">*</span>
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
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={mediaUrl}
                        alt="Preview"
                        className="h-32 w-full rounded-xl object-contain sm:h-auto sm:max-h-64"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMediaUrl("");
                        setMediaType("image");
                      }}
                      aria-label="Remove media"
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white transition-colors hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-line py-6 text-admin-muted transition-colors hover:border-admin-primary hover:text-admin-primary"
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <span className="text-[13px] font-semibold">
                      {uploading ? "Uploading..." : "Upload image or video"}
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label="Upload media file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <FormRow label="External URL">
                <input
                  name="external_url"
                  type="url"
                  aria-label="External URL"
                  placeholder="https://instagram.com/p/..."
                  defaultValue={formDefault?.external_url ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Status">
                <select
                  name="is_active"
                  aria-label="Status"
                  defaultValue={formDefault?.is_active === false ? "false" : "true"}
                  className={FIELD_SELECT}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </FormRow>

              <FormRow label="Order">
                <input
                  name="display_order"
                  type="number"
                  min="0"
                  aria-label="Display order"
                  defaultValue={formDefault?.display_order ?? 0}
                  className={cn(FIELD_INPUT, "tabular-nums")}
                />
              </FormRow>
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </form>
        )}
      </RecordSheet>
    </div>
  );
}
