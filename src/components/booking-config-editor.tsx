"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Upload, Trash2, ChevronDown, ImageIcon } from "lucide-react";
import {
  normalizeBookingConfig,
  type BookingConfig,
  type FieldConfig,
  type GroupSizeFieldConfig,
} from "@/lib/booking-config";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = "booking-images";

// ---- Shared chrome (mirrors the Event Categories redesign) ----

/** Collapsible white section card with a tan header — matches the entity sheet. */
function SectionCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2.5 bg-[#EFEADD] px-4 py-3 text-left transition-colors hover:bg-[#E6DFC8]"
      >
        <span className="font-black text-[11px] tracking-wide text-[#5C4033] uppercase">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

/** Pill switch with a colour variant (green for visibility, orange for required). */
function Switch({ value, onChange, locked, color = "green", label }: {
  value: boolean; onChange?: (v: boolean) => void; locked?: boolean; color?: "green" | "orange"; label: string;
}) {
  const interactive = !!onChange && !locked;
  const onBg = color === "orange" ? "bg-[#C2410C]" : "bg-[#22a356]";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={locked ? `${label} is always on` : `Toggle ${label}`}
      disabled={!interactive}
      onClick={interactive ? () => onChange!(!value) : undefined}
      className={cn(
        "relative h-6.25 w-11 shrink-0 rounded-full transition-colors",
        value ? onBg : "bg-[#d8d0bb]",
        !interactive && "cursor-not-allowed opacity-80",
      )}
    >
      <span className={cn("absolute top-[2.5px] left-[2.5px] h-5 w-5 rounded-full bg-white shadow transition-transform", value && "translate-x-4.75")} />
    </button>
  );
}

const FIELD_META: { key: "name" | "email" | "phone" | "group_size" | "group_name" | "special_requests"; name: string; locked?: boolean }[] = [
  { key: "name", name: "Name", locked: true },
  { key: "email", name: "Email", locked: true },
  { key: "phone", name: "Phone" },
  { key: "group_size", name: "Group Size" },
  { key: "group_name", name: "Group Name" },
  { key: "special_requests", name: "Special Requests" },
];

function FormFieldCard({ name, locked, field, isGroupSize, editable, onChange }: {
  name: string;
  locked?: boolean;
  field: FieldConfig | GroupSizeFieldConfig;
  isGroupSize?: boolean;
  editable: boolean;
  onChange: (patch: Partial<GroupSizeFieldConfig>) => void;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-[#E6DFC8] bg-[#F7F4EA]", !field.visible && "opacity-60")}>
      {/* Header: field name + visibility */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-xs font-extrabold text-[#1F1F1A]">{name}</span>
        <div className="flex items-center gap-2">
          <span className={cn("font-black text-[9px] tracking-wide uppercase", field.visible ? "text-[#1F8A5B]" : "text-[#5F624F]")}>
            {field.visible ? "Shown" : "Hidden"}
          </span>
          <Switch label={name} value={field.visible} locked={locked} onChange={editable && !locked ? (v) => onChange({ visible: v }) : undefined} />
        </div>
      </div>

      {field.visible && (
        <div className="border-t border-[#E6DFC8] bg-white">
          {/* Label */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Label</span>
            {editable ? (
              <input
                aria-label={`${name} label`}
                value={field.label}
                onChange={(e) => onChange({ label: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-[#1F1F1A] outline-none"
              />
            ) : (
              <span className="flex-1 text-right text-sm font-semibold text-[#1F1F1A]">{field.label || "—"}</span>
            )}
          </div>

          {/* Min / max for group size */}
          {isGroupSize && (
            <div className="flex gap-3 border-t border-[#E6DFC8] px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Min size</label>
                <input
                  type="number"
                  min={1}
                  aria-label="Minimum group size"
                  disabled={!editable}
                  value={(field as GroupSizeFieldConfig).min}
                  onChange={(e) => onChange({ min: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full min-w-0 rounded-[10px] border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-sm font-semibold text-[#1F1F1A] outline-none focus-visible:border-[#5C4033] disabled:opacity-70"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Max size</label>
                <input
                  type="number"
                  min={1}
                  aria-label="Maximum group size"
                  disabled={!editable}
                  value={(field as GroupSizeFieldConfig).max}
                  onChange={(e) => onChange({ max: Math.max(1, parseInt(e.target.value, 10) || 6) })}
                  className="w-full min-w-0 rounded-[10px] border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-sm font-semibold text-[#1F1F1A] outline-none focus-visible:border-[#5C4033] disabled:opacity-70"
                />
              </div>
            </div>
          )}

          {/* Required */}
          <div className="flex items-center justify-between border-t border-[#E6DFC8] px-4 py-3">
            <span className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Required</span>
            <Switch label={`${name} required`} color="orange" value={field.required} locked={locked} onChange={editable && !locked ? (v) => onChange({ required: v }) : undefined} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared editor for a `booking_config` object. Drives the nested per-field shape
 * (see `@/lib/booking-config`). Used for whichever level owns the booking page for a
 * category's `booking_grouping`: `event_types.booking_config` (per_type),
 * `event_subtypes.booking_config` (per_subtype), or `events.booking_config` (per_event).
 * Pass `readOnly` to render a non-editable summary (used in the view sheets).
 */
export function BookingConfigEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: BookingConfig;
  onChange?: (next: BookingConfig) => void;
  readOnly?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cfg = normalizeBookingConfig(value);
  const editable = !readOnly && !!onChange;

  const set = (patch: Partial<typeof cfg>) => onChange?.({ ...cfg, ...patch });
  const setField = (key: typeof FIELD_META[number]["key"], patch: Partial<GroupSizeFieldConfig>) =>
    onChange?.({ ...cfg, fields: { ...cfg.fields, [key]: { ...cfg.fields[key], ...patch } } });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) {
      setUploadError(`Upload failed: ${error.message}`);
      setUploading(false);
      return;
    }
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
    set({ booking_image_url: publicUrl });
    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Booking page — logo + tagline */}
      <SectionCard title="Booking Page">
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Booking image (logo)</span>
          {cfg.booking_image_url ? (
            <div className="relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.booking_image_url} alt="Booking logo" className="max-h-50 w-full rounded-xl bg-[#F7F4EA] object-contain" />
              {editable && (
                <button
                  type="button"
                  onClick={() => set({ booking_image_url: null })}
                  title="Remove image"
                  aria-label="Remove image"
                  className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : editable ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E6DFC8] bg-[#F7F4EA] py-7 transition-colors hover:border-[#5C4033]">
              {uploading ? <Loader2 className="h-7 w-7 animate-spin text-[#5F624F]" /> : <Upload className="h-7 w-7 text-[#5F624F] opacity-50" />}
              <span className="font-black text-[11px] tracking-wide text-[#5C4033] uppercase">{uploading ? "Uploading…" : "Upload"}</span>
              <span className="text-[10px] text-[#5F624F]">Shown as the logo on the booking page</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          ) : (
            <div className="flex items-center gap-2 py-3 text-[#5F624F]">
              <ImageIcon className="h-4 w-4 opacity-50" />
              <span className="text-sm">—</span>
            </div>
          )}
          {uploadError && <p className="text-[11px] font-bold text-red-600">{uploadError}</p>}
        </div>

        <div className="flex flex-col gap-2 border-t border-[#E6DFC8] px-4 py-3">
          <span className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Tagline</span>
          {editable ? (
            <textarea
              aria-label="Tagline"
              value={cfg.tag_line}
              rows={2}
              placeholder="Description shown under the logo"
              onChange={(e) => set({ tag_line: e.target.value })}
              className="w-full resize-none rounded-[10px] border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2.5 text-sm leading-relaxed font-medium text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 focus-visible:border-[#5C4033] focus-visible:ring-[3px] focus-visible:ring-[#5C4033]/10"
            />
          ) : (
            <span className="text-sm font-medium text-[#1F1F1A]">{cfg.tag_line || "—"}</span>
          )}
        </div>
      </SectionCard>

      {/* Form fields */}
      <SectionCard title="Form Fields">
        <p className="px-4 pt-3 text-[11px] leading-relaxed text-[#5F624F]">The fields shown on the public booking form.</p>
        <div className="flex flex-col gap-2 p-3.5">
          {FIELD_META.map(({ key, name, locked }) => (
            <FormFieldCard
              key={key}
              name={name}
              locked={locked}
              field={cfg.fields[key]}
              isGroupSize={key === "group_size"}
              editable={editable}
              onChange={(patch) => setField(key, patch)}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
