"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Upload, Trash2 } from "lucide-react";
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

// ---- Small presentational rows ----

function Toggle({ value, onChange, label, locked }: { value: boolean; onChange?: (v: boolean) => void; label: string; locked?: boolean }) {
  // Render an actual switch in every state. When `locked` (name/email, always on)
  // or read-only (no `onChange`) the switch reflects the value but can't be changed.
  const interactive = !!onChange && !locked;
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-[10px] font-black uppercase tracking-wide", value ? "text-green-600" : "text-[#5F624F]")}>
        {value ? "On" : "Off"}
      </span>
      <button
        type="button"
        title={locked ? `${label} is always on` : `Toggle ${label}`}
        aria-label={locked ? `${label} is always on` : `Toggle ${label}`}
        disabled={!interactive}
        onClick={interactive ? () => onChange!(!value) : undefined}
        className={cn(
          "w-11 h-6 rounded-full transition-colors relative shrink-0",
          value ? "bg-green-500" : "bg-[#5F624F]/30",
          !interactive && "cursor-not-allowed opacity-80"
        )}
      >
        <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", value ? "left-5.5" : "left-0.5")} />
      </button>
    </div>
  );
}

function ToggleRow({ label, value, onChange, locked }: { label: string; value: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-2.5">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">{label}</span>
      <Toggle label={label} value={value} onChange={onChange} locked={locked} />
    </div>
  );
}

function TextRow({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange?: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5">
      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap text-[#5F624F] opacity-60 shrink-0">{label}</span>
      {onChange ? (
        <input
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
        />
      ) : (
        <span className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug">{value || "—"}</span>
      )}
    </div>
  );
}

function NumberRow({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5">
      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap text-[#5F624F] opacity-60 shrink-0">{label}</span>
      {onChange ? (
        <input
          type="number"
          aria-label={label}
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(e.target.value === "" ? (min ?? 0) : parseInt(e.target.value, 10))}
          className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none w-16"
        />
      ) : (
        <span className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1">{value}</span>
      )}
    </div>
  );
}

const FIELD_META: { key: "name" | "email" | "phone" | "group_size" | "group_name" | "special_requests"; name: string; locked?: boolean }[] = [
  { key: "name", name: "Name", locked: true },
  { key: "email", name: "Email", locked: true },
  { key: "phone", name: "Phone Number" },
  { key: "group_size", name: "Group Size" },
  { key: "group_name", name: "Group Name" },
  { key: "special_requests", name: "Special Requests" },
];

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
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
    <div className="space-y-4 sm:space-y-5">
      {/* Booking Page (image + tagline) */}
      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
        <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60">
          <span className="text-[11px] font-black uppercase tracking-wide text-[#26300D]">Booking Page</span>
        </div>

        <div className="p-4 space-y-3">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">Booking Image (Logo)</span>
          {cfg.booking_image_url ? (
            <div className="relative rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.booking_image_url} alt="Booking logo" className="w-full max-h-50 object-contain bg-[#F7F4EA] rounded-xl" />
              {editable && (
                <button
                  type="button"
                  onClick={() => set({ booking_image_url: null })}
                  title="Remove image"
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : editable ? (
            <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[#E6DFC8] rounded-xl cursor-pointer hover:border-[#5C4033] hover:bg-[#F7F4EA] transition-colors">
              {uploading ? <Loader2 className="w-8 h-8 text-[#5F624F] animate-spin mb-2" /> : <Upload className="w-8 h-8 text-[#5F624F] opacity-40 mb-2" />}
              <span className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">{uploading ? "Uploading..." : "Click to upload"}</span>
              <span className="text-[9px] text-[#5F624F] opacity-60 mt-1">Shown as the logo on the booking page</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          ) : (
            <span className="text-xs sm:text-sm font-black text-[#1F1F1A]">—</span>
          )}
          {uploadError && <p className="text-[11px] text-red-600 font-bold">{uploadError}</p>}
        </div>

        <TextRow
          label="Tagline"
          value={cfg.tag_line}
          placeholder="Description shown under the logo"
          onChange={editable ? v => set({ tag_line: v }) : undefined}
        />
      </div>

      {/* Form Fields — one card per field: a group header (name + visibility toggle)
          with the field's own settings (label, required, size) nested beneath it. */}
      <div className="space-y-3">
        <div className="px-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#5F624F]">Form Fields</span>
        </div>

        {FIELD_META.map(({ key, name, locked }) => {
          const field = cfg.fields[key] as FieldConfig | GroupSizeFieldConfig;
          return (
            <div key={key} className="bg-white border-2 border-[#E6DFC8] rounded-2xl overflow-hidden">
              {/* Group header: the form field this group configures + its visibility toggle */}
              <div className={cn("flex items-center justify-between px-4 sm:px-5 py-3", field.visible ? "bg-[#E6DFC8]/60" : "bg-[#F7F4EA]/30")}>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-[#26300D] truncate">{name}</span>
                  {locked && <span className="text-[9px] font-black uppercase tracking-wide text-[#5F624F]/60 shrink-0">Required field</span>}
                </div>
                <Toggle
                  label={name}
                  value={field.visible}
                  locked={locked}
                  onChange={editable && !locked ? v => setField(key, { visible: v }) : undefined}
                />
              </div>

              {/* Child settings — indented beneath the group header, only when the field shows */}
              {field.visible && (
                <div className="border-t border-[#E6DFC8] pl-3 sm:pl-4">
                  <div className="border-l-2 border-[#E6DFC8] divide-y divide-[#E6DFC8]/50">
                    <TextRow label="Label" value={field.label} onChange={editable ? v => setField(key, { label: v }) : undefined} />
                    <ToggleRow
                      label="Required"
                      value={field.required}
                      locked={locked}
                      onChange={editable && !locked ? v => setField(key, { required: v }) : undefined}
                    />
                    {key === "group_size" && (
                      <>
                        <NumberRow label="Min Size" value={(field as GroupSizeFieldConfig).min} min={1} onChange={editable ? v => setField(key, { min: Math.max(1, v) }) : undefined} />
                        <NumberRow label="Max Size" value={(field as GroupSizeFieldConfig).max} min={1} max={100} onChange={editable ? v => setField(key, { max: v }) : undefined} />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
