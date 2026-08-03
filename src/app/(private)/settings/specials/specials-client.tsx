"use client";

import { useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Image as ImageIcon,
  Upload,
  Check,
  X,
} from "lucide-react";
import { saveSpecialAction, deleteSpecialAction } from "./actions";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextContent } from "@/components/rich-text-content";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
} from "@/components/admin";

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
  if (!dateStr) return "-";
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
  const sheet = useRecordSheet<SpecialRecord>();
  const { selected, mode } = sheet;
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const openAdd = () => {
    setImageUrl("");
    sheet.openAdd();
  };

  const closeSheet = () => {
    setImageUrl("");
    sheet.close();
  };

  const startEdit = () => {
    setImageUrl(selected?.image_url ?? "");
    sheet.startEdit();
  };

  const cancel = () => {
    if (mode === "add") closeSheet();
    else if (selected) sheet.openView(selected);
  };

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Delete special",
      description:
        "Are you sure you want to delete this special? This cannot be undone.",
      action: () => deleteSpecialAction(selected.id),
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    sheet.setFormError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `specials/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      sheet.setFormError(`Upload failed: ${error.message}`);
      setUploadingImage(false);
      return;
    }

    const publicUrl = supabase.storage
      .from("gallery")
      .getPublicUrl(data.path).data.publicUrl;
    setImageUrl(publicUrl);
    setUploadingImage(false);
  };

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;
  const title =
    mode === "add"
      ? "New special"
      : mode === "edit"
        ? "Edit special"
        : "View special";

  return (
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialSpecials.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No specials yet"
          description="Add your first special to display on the homepage"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create special
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Specials"
          count={initialSpecials.length}
          onAdd={openAdd}
        >
          {initialSpecials.map((special) => {
            const inactive = !special.is_active;
            const dateRange = [
              special.start_date ? formatDate(special.start_date) : null,
              special.end_date ? formatDate(special.end_date) : null,
            ]
              .filter(Boolean)
              .join(" - ");
            return (
              <ListRow key={special.id} onClick={() => sheet.openView(special)}>
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
                  {special.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={special.image_url}
                      alt={special.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Sparkles className="h-4 w-4 text-admin-muted opacity-30" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm leading-snug font-semibold",
                        inactive ? "text-admin-muted" : "text-admin-ink",
                      )}
                    >
                      {special.title}
                    </p>
                    <StatusPill
                      tone={special.is_active ? "success" : "error"}
                      icon={
                        special.is_active ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )
                      }
                    >
                      {special.is_active ? "Active" : "Inactive"}
                    </StatusPill>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-admin-muted tabular-nums">
                    {dateRange || "No dates set"}
                  </p>
                </div>
              </ListRow>
            );
          })}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={closeSheet}
        mode={mode}
        title={title}
        recordId={selected?.id}
        formId="special-form"
        isPending={sheet.isPending}
        saveDisabled={uploadingImage}
        onEdit={startEdit}
        onDelete={handleDelete}
        onCancel={cancel}
        confirmUI={sheet.ConfirmDialogUI}
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell label="Title" value={selected.title} />
              {selected.description ? (
                <div className="border-b border-admin-line px-4 py-3 sm:px-5">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                    Description
                  </p>
                  <RichTextContent html={selected.description} variant="admin" />
                </div>
              ) : (
                <DetailCell label="Description" value="-" />
              )}
              <DetailCell
                label="Badges"
                value={
                  selected.badges.length > 0 ? selected.badges.join(", ") : "-"
                }
              />
              <DetailCell
                label="Start date"
                value={formatDate(selected.start_date)}
              />
              <DetailCell
                label="End date"
                value={formatDate(selected.end_date)}
              />
              <DetailCell label="Days" value={formatDays(selected.days_of_week)} />
              <DetailCell
                label="Status"
                value={selected.is_active ? "Active" : "Inactive"}
              />
              <DetailCell
                label="Display order"
                value={String(selected.display_order)}
              />
            </DetailCard>

            {selected.image_url && (
              <DetailCard className="p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3 text-admin-muted" />
                  <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                    Preview
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.image_url}
                  alt={selected.title}
                  className="h-40 w-full rounded-xl object-cover"
                />
              </DetailCard>
            )}

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="special-form"
            action={sheet.submit(saveSpecialAction)}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault && (
              <input type="hidden" name="id" value={formDefault.id} />
            )}
            <input type="hidden" name="image_url" value={imageUrl} />

            <DetailCard className="space-y-3 p-4">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3 text-admin-muted" />
                <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
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
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-admin-line py-8 transition-colors hover:border-admin-primary hover:bg-admin-bg">
                  {uploadingImage ? (
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-admin-muted" />
                  ) : (
                    <Upload className="mb-2 h-8 w-8 text-admin-muted opacity-40" />
                  )}
                  <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                    {uploadingImage ? "Uploading..." : "Click to upload"}
                  </span>
                  <span className="mt-1 text-[10px] text-admin-muted opacity-60">
                    JPG, PNG up to 10MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploadingImage}
                  />
                </label>
              )}
            </DetailCard>

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Title" required>
                <input
                  name="title"
                  required
                  placeholder="e.g. 2-for-1 Cocktails"
                  defaultValue={formDefault?.title ?? ""}
                  className="flex-1 bg-transparent text-right text-base font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40 sm:text-sm"
                />
              </FormRow>

              <div className="px-4 py-3 sm:px-5">
                <p className="mb-2 text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
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
                  className="flex-1 bg-transparent text-right text-base font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40 sm:text-sm"
                />
              </FormRow>

              <FormRow label="Start date">
                <input
                  title="Start date"
                  name="start_date"
                  type="date"
                  defaultValue={
                    formDefault?.start_date
                      ? new Date(formDefault.start_date).toISOString().split("T")[0]
                      : ""
                  }
                  className="flex-1 bg-transparent text-right text-base font-semibold text-admin-ink outline-none sm:text-sm"
                />
              </FormRow>

              <FormRow label="End date">
                <input
                  title="End date"
                  name="end_date"
                  type="date"
                  defaultValue={
                    formDefault?.end_date
                      ? new Date(formDefault.end_date).toISOString().split("T")[0]
                      : ""
                  }
                  className="flex-1 bg-transparent text-right text-base font-semibold text-admin-ink outline-none sm:text-sm"
                />
              </FormRow>

              <div className="px-4 py-3 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                    Available on
                  </span>
                  <span className="text-[10px] font-medium text-admin-muted opacity-60">
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
                        <span className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-admin-line bg-admin-surface px-3 text-[11px] font-semibold tracking-wide text-admin-muted transition-colors peer-checked:border-admin-primary peer-checked:bg-admin-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-admin-primary">
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
                  defaultValue={formDefault?.is_active === false ? "false" : "true"}
                  className="dir-rtl flex-1 cursor-pointer appearance-none bg-transparent text-base font-semibold text-admin-ink outline-none sm:text-sm"
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
                  className="w-16 flex-1 bg-transparent text-right text-base font-semibold text-admin-ink outline-none sm:text-sm"
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
