"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  Check,
  X,
  SearchX,
  ShoppingBag,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { saveMerchandiseAction, deleteMerchandiseAction } from "./actions";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextContent } from "@/components/rich-text-content";
import { formatGBP } from "@/lib/events-display";
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

export type MerchandiseRecord = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
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

function priceLabel(price: number | null): string {
  if (price === null || price === undefined) return "No price";
  return formatGBP(Number(price));
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

export default function MerchandiseClient({
  initialMerchandise = [],
  employees = [],
}: {
  initialMerchandise: MerchandiseRecord[];
  employees?: EmployeeOption[];
}) {
  const sheet = useRecordSheet<MerchandiseRecord>({
    records: initialMerchandise,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState(1);

  const orderRows: OrderRow[] = initialMerchandise.map((item) => ({
    id: item.id,
    name: item.name,
    display_order: item.display_order,
    is_active: item.is_active,
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

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialMerchandise;
    return initialMerchandise.filter((item) =>
      [item.name, plainText(item.description), priceLabel(item.price)].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [initialMerchandise, query]);

  // A new item starts inactive, so nothing reaches the homepage before somebody
  // has looked at it. It goes live from the edit screen.
  const openAdd = () => {
    setImageUrl("");
    setIsActive(false);
    setPosition(nextPosition(orderRows));
    sheet.openAdd();
  };

  const startEdit = () => {
    if (!selected) return;
    setImageUrl(selected.image_url ?? "");
    setIsActive(selected.is_active);
    setPosition(selected.display_order || nextPosition(orderRows));
    sheet.startEdit();
  };

  const closeSheet = () => {
    setImageUrl("");
    sheet.close();
  };

  const cancel = () => {
    if (mode === "add") closeSheet();
    else if (selected) sheet.openView(selected);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    sheet.setFormError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `merchandise/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      sheet.setFormError(`Upload failed: ${error.message}`);
      setUploadingImage(false);
      return;
    }

    const publicUrl = supabase.storage.from("gallery").getPublicUrl(data.path).data
      .publicUrl;
    setImageUrl(publicUrl);
    setUploadingImage(false);
  };

  const reorderPrompt = (name: string) => {
    if (wasActive && !isActive) {
      return `Making "${name}" inactive will move it to position 0 and update:`;
    }
    if (!wasActive && isActive) {
      return `Making "${name}" active will place it at position ${plan.position} and update:`;
    }
    return `Moving "${name}" to position ${plan.position} will also update:`;
  };

  // Submitted by hand rather than as a form action, so the reorder confirmation
  // can be answered before anything is written.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submit = sheet.submit(saveMerchandiseAction);

    if (affected.length === 0) {
      submit(formData);
      return;
    }

    const ok = await sheet.confirm({
      title: "Reorder merchandise",
      description: reorderPrompt(formData.get("name")?.toString().trim() || "this item"),
      content: <ChangeList changes={affected} />,
      confirmLabel: "Update order",
    });
    if (ok) submit(formData);
  };

  const handleDelete = () => {
    if (!selected) return;
    const cascade = describeChanges(orderRows, planDelete(orderRows, selected.id));
    sheet.confirmDelete({
      title: "Delete merchandise item",
      description:
        cascade.length > 0
          ? "Are you sure you want to delete this item? This cannot be undone. These positions will shift up:"
          : "Are you sure you want to delete this item? This cannot be undone.",
      content: cascade.length > 0 ? <ChangeList changes={cascade} /> : undefined,
      action: () => deleteMerchandiseAction(selected.id),
    });
  };

  const title =
    mode === "add" ? "New item" : mode === "edit" ? "Edit item" : "View item";

  return (
    // Flush to the edge on a phone: the row carries a thumbnail the other
    // settings lists do not, so every pixel of gutter is a pixel the item
    // name loses.
    <div className="mx-auto w-full space-y-3 px-0 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialMerchandise.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No merchandise yet"
          description="Add your first item to display on the homepage"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create item
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Merchandise"
          count={shown.length}
          onAdd={openAdd}
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search merchandise"
              placeholder="Search by name, description or price"
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
            shown.map((item) => {
              const inactive = !item.is_active;
              const summary = plainText(item.description);
              return (
                <ListRow
                  key={item.id}
                  onClick={() => sheet.openView(item)}
                  status={
                    <StatusPill
                      tone={item.is_active ? "success" : "error"}
                      icon={
                        item.is_active ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )
                      }
                      className="sm:w-24 sm:justify-center"
                    >
                      {item.is_active ? "Active" : "Inactive"}
                    </StatusPill>
                  }
                >
                  <span
                    className="w-6 shrink-0 text-center text-xs font-semibold text-admin-muted tabular-nums opacity-60"
                    title={
                      item.is_active
                        ? `Position ${item.display_order}`
                        : "Inactive items have no position"
                    }
                  >
                    {item.is_active ? item.display_order : "-"}
                  </span>

                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-admin-line bg-admin-surface sm:h-9 sm:w-9">
                    {item.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="h-4 w-4 text-admin-muted opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* Fixed tracks rather than content-sized ones, so the price of
                      every row starts in the same place. */}
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.6fr)] sm:items-center sm:gap-3">
                    <p
                      className={cn(
                        "min-w-0 truncate text-sm leading-snug font-semibold",
                        inactive ? "text-admin-muted" : "text-admin-ink",
                      )}
                    >
                      {item.name}
                    </p>

                    <p className="mt-0.5 truncate text-[11px] font-medium text-admin-muted tabular-nums sm:mt-0 sm:text-[12px]">
                      {priceLabel(item.price)}
                    </p>

                    <p className="hidden truncate text-[11px] font-medium text-admin-muted sm:block">
                      {summary || "No description"}
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
        formId="merchandise-form"
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
              <DetailCell dense label="Name" value={selected.name} />
              <DetailCell dense label="Price" value={priceLabel(selected.price)} />
              <DetailCell
                dense
                label="Position"
                value={
                  selected.is_active
                    ? String(selected.display_order)
                    : "0 (inactive)"
                }
              />
              {selected.description ? (
                <div className="border-b border-admin-line px-4 py-3 last:border-0 sm:px-5">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                    Description
                  </p>
                  <RichTextContent html={selected.description} variant="admin" />
                </div>
              ) : (
                <DetailCell dense label="Description" value="-" />
              )}
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
                  alt={selected.name}
                  className="h-32 w-full rounded-xl object-contain sm:h-auto sm:max-h-64"
                />
              </DetailCard>
            )}

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="merchandise-form"
            onSubmit={handleSubmit}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
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
                    className="h-32 w-full rounded-xl object-contain sm:h-auto sm:max-h-64"
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
                    JPG, PNG up to 10MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload merchandise image"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploadingImage}
                  />
                </label>
              )}
            </DetailCard>

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Name" required>
                <input
                  name="name"
                  required
                  aria-label="Name"
                  placeholder="e.g. Bar Tee"
                  defaultValue={formDefault?.name ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Price" required>
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  inputMode="decimal"
                  aria-label="Price in pounds"
                  placeholder="e.g. 25.00"
                  defaultValue={formDefault?.price ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Status">
                {mode === "add" ? (
                  <>
                    <input type="hidden" name="is_active" value="false" />
                    <span className="flex-1 text-right text-sm font-semibold text-admin-muted">
                      Inactive
                    </span>
                  </>
                ) : (
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
                )}
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
                  {mode === "add"
                    ? "New items start inactive. Activate it from the edit screen once it is ready for the homepage."
                    : isActive
                      ? canChoosePosition
                        ? `Positions run 1 to ${activeCount}. Changing this reorders the others.`
                        : "Newly activated items are added to the end of the list."
                      : "Inactive items have no position and are hidden from the homepage."}
                </p>
              </div>

              <div className="px-4 py-3 sm:px-5">
                <p className="mb-2 text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                  Description
                </p>
                <RichTextEditor
                  name="description"
                  defaultValue={formDefault?.description ?? ""}
                />
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
        <li
          key={change.id}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
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
