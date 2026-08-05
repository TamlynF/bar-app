"use client";

import { useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  SearchX,
  CalendarDays,
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
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
  DateField,
  formatRecordDate as formatDate,
  toDateInputValue as toDateInput,
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

export type EmployeeOption = { id: number; full_name: string };

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
const FIELD_SELECT =
  "flex-1 cursor-pointer appearance-none bg-transparent text-right text-sm font-semibold text-admin-ink outline-none";

function formatDays(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return "Every day";
  return WEEKDAYS.filter((d) => days.includes(d.value))
    .map((d) => d.label)
    .join(", ");
}

function dateRangeLabel(special: SpecialRecord): string {
  const from = special.start_date ? formatDate(special.start_date) : null;
  const to = special.end_date ? formatDate(special.end_date) : null;
  if (from && to) return `${from} - ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return "No dates set";
}

// The description is rich text, so the list row needs it flattened before it can
// be truncated to a single line or matched against a search.
function plainText(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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

export default function SpecialsClient({
  initialSpecials = [],
  employees = [],
}: {
  initialSpecials: SpecialRecord[];
  employees?: EmployeeOption[];
}) {
  const sheet = useRecordSheet<SpecialRecord>({
    records: initialSpecials,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState(1);

  const orderRows: OrderRow[] = useMemo(
    () =>
      initialSpecials.map((special) => ({
        id: special.id,
        name: special.title,
        display_order: special.display_order,
        is_active: special.is_active,
      })),
    [initialSpecials],
  );

  const activeCount = orderRows.filter((row) => row.is_active).length;

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialSpecials;
    return initialSpecials.filter((special) =>
      [
        special.title,
        plainText(special.description),
        (special.badges ?? []).join(" "),
        formatDays(special.days_of_week),
        dateRangeLabel(special),
      ].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [initialSpecials, query]);

  const loadForm = (record: SpecialRecord | null) => {
    setImageUrl(record?.image_url ?? "");
    setStartDate(toDateInput(record?.start_date));
    setEndDate(toDateInput(record?.end_date));
    setIsActive(record?.is_active ?? true);
    setPosition(record?.display_order || nextPosition(orderRows));
  };

  const openAdd = () => {
    loadForm(null);
    sheet.openAdd();
  };

  const closeSheet = () => {
    setImageUrl("");
    sheet.close();
  };

  const startEdit = () => {
    loadForm(selected);
    sheet.startEdit();
  };

  const cancel = () => {
    if (mode === "add") closeSheet();
    else if (selected) sheet.openView(selected);
  };

  const handleDelete = () => {
    if (!selected) return;
    const cascade = describeChanges(orderRows, planDelete(orderRows, selected.id));
    sheet.confirmDelete({
      title: "Delete special",
      description:
        cascade.length > 0
          ? "Are you sure you want to delete this special? This cannot be undone. These positions will shift up:"
          : "Are you sure you want to delete this special? This cannot be undone.",
      content: cascade.length > 0 ? <ChangeList changes={cascade} /> : undefined,
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
  const wasActive = formDefault?.is_active ?? false;
  const canChoosePosition = !!formDefault && wasActive && isActive;

  const plan = planSave(orderRows, {
    id: formDefault?.id ?? null,
    isActive,
    targetPosition: canChoosePosition ? position : null,
  });
  const affected = describeChanges(orderRows, plan.changes);

  const reorderPrompt = (name: string) => {
    if (wasActive && !isActive) {
      return `Making "${name}" inactive will move it to position 0 and update:`;
    }
    if (!wasActive && isActive) {
      return `Making "${name}" active will place it at position ${plan.position} and update:`;
    }
    return `Moving "${name}" to position ${plan.position} will also update:`;
  };

  // Submitted by hand rather than as a form action, so the reorder warning can be
  // answered before anything is written.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submit = sheet.submit(saveSpecialAction);

    if (affected.length === 0) {
      submit(formData);
      return;
    }

    const ok = await sheet.confirm({
      title: "Reorder specials",
      description: reorderPrompt(formData.get("title")?.toString().trim() || "this special"),
      content: <ChangeList changes={affected} />,
      confirmLabel: "Update order",
    });
    if (ok) submit(formData);
  };

  const title =
    mode === "add"
      ? "New special"
      : mode === "edit"
        ? "Edit special"
        : "View special";

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
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
          count={shown.length}
          onAdd={openAdd}
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search specials"
              placeholder="Search by title, description, badge or day"
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
            shown.map((special) => {
              const inactive = !special.is_active;
              const badges = special.badges ?? [];
              return (
                <ListRow
                  key={special.id}
                  onClick={() => sheet.openView(special)}
                  status={
                    <StatusPill
                      tone={special.is_active ? "success" : "error"}
                      icon={
                        special.is_active ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )
                      }
                      className="sm:w-24 sm:justify-center"
                    >
                      {special.is_active ? "Active" : "Inactive"}
                    </StatusPill>
                  }
                >
                  <span
                    className="w-6 shrink-0 text-center text-xs font-semibold text-admin-muted tabular-nums opacity-60"
                    title={
                      special.is_active
                        ? `Position ${special.display_order}`
                        : "Inactive specials have no position"
                    }
                  >
                    {special.is_active ? special.display_order : "-"}
                  </span>

                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
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

                  {/* Fixed tracks rather than content-sized ones, so the dates of
                      every row start in the same place. */}
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_14rem_9rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                    <p
                      className={cn(
                        "min-w-0 truncate text-sm leading-snug font-semibold",
                        inactive ? "text-admin-muted" : "text-admin-ink",
                      )}
                    >
                      {special.title}
                    </p>

                    <p
                      className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-admin-muted sm:mt-0 sm:text-[12px]"
                      title={dateRangeLabel(special)}
                    >
                      <CalendarDays
                        className="h-3.5 w-3.5 shrink-0 opacity-60"
                        aria-hidden="true"
                      />
                      <span className="truncate tabular-nums">
                        {dateRangeLabel(special)}
                      </span>
                    </p>

                    <p className="hidden truncate text-[11px] font-medium text-admin-muted sm:block">
                      {formatDays(special.days_of_week)}
                    </p>

                    <div className="hidden items-center gap-1.5 overflow-hidden sm:flex">
                      {badges.length > 0 ? (
                        badges.slice(0, 2).map((badge) => (
                          <InfoBadge key={badge} icon={null}>
                            {badge}
                          </InfoBadge>
                        ))
                      ) : (
                        <span className="text-[11px] font-medium text-admin-muted opacity-60">
                          No badges
                        </span>
                      )}
                      {badges.length > 2 && (
                        <span className="text-[11px] font-medium text-admin-muted opacity-60 tabular-nums">
                          +{badges.length - 2}
                        </span>
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
        formId="special-form"
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
              {selected.description ? (
                <div className="border-b border-admin-line px-4 py-3 sm:px-5">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                    Description
                  </p>
                  <RichTextContent html={selected.description} variant="admin" />
                </div>
              ) : (
                <DetailCell dense label="Description" value="-" />
              )}
              <DetailCell
                dense
                label="Badges"
                value={
                  selected.badges.length > 0 ? selected.badges.join(", ") : "-"
                }
              />
              <DetailCell
                dense
                label="Start date"
                value={formatDate(selected.start_date)}
              />
              <DetailCell
                dense
                label="End date"
                value={formatDate(selected.end_date)}
              />
              <DetailCell dense label="Days" value={formatDays(selected.days_of_week)} />
              <DetailCell
                dense
                label="Position"
                value={selected.is_active ? String(selected.display_order) : "0 (inactive)"}
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
            onSubmit={handleSubmit}
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
                    aria-label="Remove image"
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
                    aria-label="Upload special image"
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
                  aria-label="Title"
                  placeholder="e.g. 2-for-1 Cocktails"
                  defaultValue={formDefault?.title ?? ""}
                  className={FIELD_INPUT}
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
                  aria-label="Badges"
                  placeholder="e.g. NEW, FRIDAY (comma-separated)"
                  defaultValue={formDefault?.badges.join(", ") ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Start date">
                <DateField
                  name="start_date"
                  label="Start date"
                  value={startDate}
                  onChange={setStartDate}
                />
              </FormRow>

              <FormRow label="End date">
                <DateField
                  name="end_date"
                  label="End date"
                  value={endDate}
                  onChange={setEndDate}
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
                  name="is_active"
                  aria-label="Status"
                  value={isActive ? "true" : "false"}
                  onChange={(e) => setIsActive(e.target.value === "true")}
                  className={FIELD_SELECT}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
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
                    aria-label="Position on the homepage"
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    className={cn(FIELD_INPUT, "tabular-nums")}
                  />
                ) : (
                  <input
                    name="display_order"
                    type="number"
                    readOnly
                    aria-label="Position on the homepage"
                    value={plan.position}
                    className="flex-1 cursor-not-allowed bg-transparent text-right text-sm font-semibold text-admin-muted opacity-60 outline-none tabular-nums"
                  />
                )}
              </FormRow>

              <div className="px-4 pt-0 pb-3 sm:px-5">
                <p className="text-[11px] font-medium text-admin-muted opacity-70">
                  {!isActive
                    ? "Inactive specials have no position and are hidden from the homepage."
                    : canChoosePosition
                      ? `Positions run 1 to ${activeCount}. Changing this reorders the others.`
                      : "New specials are added to the end of the list."}
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
