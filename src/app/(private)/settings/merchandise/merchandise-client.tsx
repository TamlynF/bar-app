"use client";

import { useState, useTransition } from "react";
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
  ShoppingBag,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { saveMerchandiseAction, deleteMerchandiseAction } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
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

function priceLabel(price: number | null): string {
  if (price === null || price === undefined) return "No price";
  return formatGBP(Number(price));
}

export default function MerchandiseClient({
  initialMerchandise = [],
}: {
  initialMerchandise: MerchandiseRecord[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<MerchandiseRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState(1);

  const orderRows: OrderRow[] = initialMerchandise.map((item) => ({
    id: item.id,
    name: item.name,
    display_order: item.display_order,
    is_active: item.is_active,
  }));

  const activeCount = orderRows.filter((row) => row.is_active).length;
  const isSheetOpen = !!selected || isAdding;
  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;
  const wasActive = formDefault?.is_active ?? false;
  const canChoosePosition = !!formDefault && wasActive && isActive;

  const plan = planSave(orderRows, {
    id: formDefault?.id ?? null,
    isActive,
    targetPosition: canChoosePosition ? position : null,
  });
  const affected = describeChanges(orderRows, plan.changes);

  const openView = (item: MerchandiseRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(item);
  };

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setImageUrl("");
    setIsActive(true);
    setPosition(nextPosition(orderRows));
    setIsAdding(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setFormError(null);
    setImageUrl(selected.image_url || "");
    setIsActive(selected.is_active);
    setPosition(selected.display_order);
    setIsEditing(true);
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

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `merchandise/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      setFormError(`Upload failed: ${error.message}`);
      setUploadingImage(false);
      return;
    }

    const publicUrl = supabase.storage
      .from("gallery")
      .getPublicUrl(data.path).data.publicUrl;
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);

    const name = formData.get("name")?.toString().trim() || "this item";

    const submit = () =>
      startTransition(async () => {
        const result = await saveMerchandiseAction(formData);
        if (result?.error) {
          setFormError(result.error);
        } else {
          closeSheet();
        }
      });

    if (affected.length === 0) {
      submit();
      return;
    }

    void (async () => {
      const ok = await confirm({
        title: "Reorder merchandise",
        description: reorderPrompt(name),
        content: <ChangeList changes={affected} />,
        confirmLabel: "Update order",
      });
      if (ok) submit();
    })();
  };

  const handleDelete = async () => {
    if (!selected) return;
    const cascade = describeChanges(
      orderRows,
      planDelete(orderRows, selected.id)
    );
    const ok = await confirm({
      title: "Delete merchandise item",
      description:
        cascade.length > 0
          ? "Are you sure you want to delete this item? This cannot be undone. These positions will shift up:"
          : "Are you sure you want to delete this item? This cannot be undone.",
      content: cascade.length > 0 ? <ChangeList changes={cascade} /> : undefined,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteMerchandiseAction(selected.id);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialMerchandise.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
          <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
          <p className="font-black text-sm text-[#1F1F1A]">No merchandise yet</p>
          <p className="mt-1 text-[11px] text-[#5F624F]">
            Add your first item to display on the homepage
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 h-8 rounded-lg bg-[#1B4332] px-4 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            Create Item
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
                Merchandise{" "}
                <span className="text-[#5F624F]">
                  ({initialMerchandise.length})
                </span>
              </p>
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="flex h-7 w-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] text-white transition-colors hover:bg-[#1B4332]/85 sm:h-7 sm:w-auto sm:px-2.5"
              title="Add merchandise item"
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
              {initialMerchandise.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openView(item)}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#F7F4EA]/50 active:scale-[0.99] sm:px-4"
                >
                  <span className="w-6 shrink-0 text-center font-black text-xs text-[#5F624F] tabular-nums opacity-60">
                    {item.display_order}
                  </span>

                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[#E6DFC8] bg-[#F7F4EA]">
                    {item.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="h-4 w-4 text-[#5F624F] opacity-30" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate font-black text-sm leading-snug",
                          item.is_active ? "text-[#1F1F1A]" : "text-[#5F624F]"
                        )}
                      >
                        {item.name}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                          item.is_active
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-red-200 bg-red-50 text-red-500"
                        )}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] font-medium text-[#5F624F] tabular-nums">
                      {priceLabel(item.price)}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F] opacity-40" />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
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
                  {isAdding
                    ? "New Item"
                    : isEditing
                    ? "Edit Item"
                    : "View Item"}
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
                  <DetailCell label="Name" value={selected.name} />
                  {selected.description ? (
                    <div className="border-b border-[#E6DFC8] px-4 py-3 sm:px-5">
                      <p className="mb-1.5 text-[10px] font-bold tracking-wide text-[#5F624F] uppercase opacity-60">
                        Description
                      </p>
                      <RichTextContent
                        html={selected.description}
                        variant="admin"
                      />
                    </div>
                  ) : (
                    <DetailCell label="Description" value="—" />
                  )}
                  <DetailCell label="Price" value={priceLabel(selected.price)} />
                  <DetailCell
                    label="Status"
                    value={selected.is_active ? "Active" : "Inactive"}
                  />
                  <DetailCell
                    label="Position"
                    value={
                      selected.is_active
                        ? String(selected.display_order)
                        : "0 (inactive)"
                    }
                  />
                </div>

                {selected.image_url && (
                  <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      <ImageIcon className="h-3 w-3 text-[#5F624F]" />
                      <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">
                        Preview
                      </span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.image_url}
                      alt={selected.name}
                      className="h-40 w-full rounded-xl object-cover"
                    />
                  </div>
                )}

                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {showForm && (
              <form
                id="merchandise-form"
                onSubmit={handleSubmit}
                className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
              >
                {formDefault && (
                  <input type="hidden" name="id" value={formDefault.id} />
                )}
                <input type="hidden" name="image_url" value={imageUrl} />

                <div className="space-y-3 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white p-4">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3 text-[#5F624F]" />
                    <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">
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
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E6DFC8] py-8 transition-colors hover:border-[#5C4033] hover:bg-[#F7F4EA]">
                      {uploadingImage ? (
                        <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#5F624F]" />
                      ) : (
                        <Upload className="mb-2 h-8 w-8 text-[#5F624F] opacity-40" />
                      )}
                      <span className="font-black text-[11px] tracking-wide text-[#5F624F] uppercase">
                        {uploadingImage ? "Uploading..." : "Click to upload"}
                      </span>
                      <span className="mt-1 text-[9px] text-[#5F624F] opacity-60">
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
                </div>

                <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  <FormRow label="Name" required>
                    <input
                      name="name"
                      required
                      aria-label="Name"
                      placeholder="e.g. Bar Tee"
                      defaultValue={formDefault?.name ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <div className="px-4 py-3 sm:px-5">
                    <p className="mb-2 text-[10px] font-bold tracking-wide text-[#5F624F] uppercase opacity-60">
                      Description
                    </p>
                    <RichTextEditor
                      name="description"
                      defaultValue={formDefault?.description ?? ""}
                    />
                  </div>

                  <FormRow label="Price">
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      aria-label="Price in pounds"
                      placeholder="e.g. 25.00"
                      defaultValue={formDefault?.price ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  <FormRow label="Status">
                    <select
                      name="is_active"
                      aria-label="Status"
                      value={isActive ? "true" : "false"}
                      onChange={(e) => setIsActive(e.target.value === "true")}
                      className="dir-rtl flex-1 cursor-pointer appearance-none bg-transparent font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    >
                      <option value="true" className="dir-ltr">
                        Active
                      </option>
                      <option value="false" className="dir-ltr">
                        Inactive
                      </option>
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
                        className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none tabular-nums sm:text-sm"
                      />
                    ) : (
                      <input
                        name="display_order"
                        type="number"
                        readOnly
                        aria-label="Position on the homepage"
                        value={plan.position}
                        className="flex-1 cursor-not-allowed bg-transparent text-right font-black text-base text-[#5F624F] outline-none tabular-nums opacity-60 sm:text-sm"
                      />
                    )}
                  </FormRow>

                  <div className="px-4 pt-0 pb-3 sm:px-5">
                    <p className="text-[10px] font-medium text-[#5F624F] opacity-60">
                      {isActive
                        ? canChoosePosition
                          ? `Positions run 1 to ${activeCount}. Changing this reorders the others.`
                          : "New items are added to the end of the list."
                        : "Inactive items have no position and are hidden from the homepage."}
                    </p>
                  </div>
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
                  onClick={openEdit}
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
                  type="button"
                  disabled={isPending || uploadingImage}
                  onClick={() => {
                    const form = document.getElementById(
                      "merchandise-form"
                    ) as HTMLFormElement | null;
                    if (form) form.requestSubmit();
                  }}
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

function ChangeList({ changes }: { changes: ChangeDescription[] }) {
  return (
    <ul className="divide-y divide-[#E6DFC8] overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
      {changes.map((change) => (
        <li
          key={change.id}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <span className="min-w-0 flex-1 truncate font-black text-xs text-[#1F1F1A]">
            {change.name}
          </span>
          <span className="shrink-0 font-black text-[11px] text-[#5F624F] tabular-nums">
            {change.from} → {change.to}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FormRow({
  label,
  required,
  align = "center",
  children,
}: {
  label: string;
  required?: boolean;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4",
        align === "start" ? "items-start" : "items-center"
      )}
    >
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
        {required && (
          <span className="text-[10px] font-bold text-red-500">*</span>
        )}
      </div>
      {children}
    </div>
  );
}

function DetailCell({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 border-b border-[#E6DFC8] px-4 py-2.5 last:border-0 sm:gap-3 sm:px-5 sm:py-4",
        multiline ? "items-start" : "items-center"
      )}
    >
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "flex-1 text-right font-black text-base leading-snug wrap-break-word text-[#1F1F1A] sm:text-sm",
          multiline && "text-left whitespace-pre-line"
        )}
      >
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
