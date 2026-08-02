"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Upload, Trash2, ChevronDown } from "lucide-react";
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


function SectionCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-[#D8D5C8] bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2.5 bg-[#EFEADD] px-4 py-3 text-left transition-colors hover:bg-[#D8D5C8]"
      >
        <span className="font-black text-[11px] tracking-wide text-[#34451F] uppercase">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-[#5E6654] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function Switch({ value, onChange, locked, color = "green", label }: {
  value: boolean; onChange?: (v: boolean) => void; locked?: boolean; color?: "green" | "orange"; label: string;
}) {
  const interactive = !!onChange && !locked;
  const track = cn(
    "relative h-5 w-9 shrink-0 rounded-full p-0 transition-colors",
    value ? (color === "orange" ? "bg-[#C2410C]" : "bg-green-600") : "bg-[#5E6654]/25",
  );
  const knob = cn("absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-4.5" : "translate-x-0.5");

  if (!interactive) {
    return (
      <span role="img" aria-label={value ? "On" : "Off"} className={track}>
        <span className={knob} />
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={`Toggle ${label}`}
      onClick={() => onChange!(!value)}
      className={track}
    >
      <span className={knob} />
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
    <div className={cn("overflow-hidden rounded-xl border border-[#D8D5C8] bg-white", !field.visible && "opacity-60")}>
      <div className="grid grid-cols-3 items-center gap-3 border-b border-[#D8D5C8] bg-[#EFEADD] px-4 py-2">
        <span className="font-black text-[10px] tracking-wide text-[#5E6654] uppercase">{name}</span>
        <div className="flex items-center justify-center gap-2">
          <span className={cn("font-black text-[10px] tracking-wide uppercase", field.visible ? "text-[#1F8A5B]" : "text-[#5E6654]")}>
            {field.visible ? "Shown" : "Hidden"}
          </span>
          {editable && <Switch label={name} value={field.visible} locked={locked} onChange={!locked ? (v) => onChange({ visible: v }) : undefined} />}
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className={cn("font-black text-[10px] tracking-wide uppercase", field.required ? "text-[#C2410C]" : "text-[#5E6654]/60")}>
            {field.required ? "Required" : "Not Required"}
          </span>
          {editable && <Switch label={`${name} required`} color="orange" value={field.required} locked={locked} onChange={!locked ? (v) => onChange({ required: v }) : undefined} />}
        </div>
      </div>

      {field.visible && (
        <>
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Label</span>
            {editable ? (
              <input
                aria-label={`${name} label`}
                value={field.label}
                onChange={(e) => onChange({ label: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none"
              />
            ) : (
              <span className="min-w-0 truncate text-right text-[13px] font-semibold text-[#20231A]">{field.label || "-"}</span>
            )}
          </div>

          {isGroupSize && (
            <div className="flex gap-3 border-t border-[#D8D5C8] px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Min size</label>
                <input
                  type="number"
                  min={1}
                  aria-label="Minimum group size"
                  disabled={!editable}
                  value={(field as GroupSizeFieldConfig).min}
                  onChange={(e) => onChange({ min: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full min-w-0 rounded-[10px] border border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2 text-sm font-semibold text-[#20231A] outline-none focus-visible:border-[#34451F] disabled:opacity-70"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Max size</label>
                <input
                  type="number"
                  min={1}
                  aria-label="Maximum group size"
                  disabled={!editable}
                  value={(field as GroupSizeFieldConfig).max}
                  onChange={(e) => onChange({ max: Math.max(1, parseInt(e.target.value, 10) || 6) })}
                  className="w-full min-w-0 rounded-[10px] border border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2 text-sm font-semibold text-[#20231A] outline-none focus-visible:border-[#34451F] disabled:opacity-70"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BookingConfigEditor({
  value,
  onChange,
  readOnly = false,
  bookingPageExtra,
}: {
  value: BookingConfig;
  onChange?: (next: BookingConfig) => void;
  readOnly?: boolean;
  bookingPageExtra?: React.ReactNode;
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
      <SectionCard title="Booking Page">
        {editable ? (
          <>
            <div className="flex flex-col gap-2 px-4 py-3">
              <span className="font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Booking image (logo)</span>
              {cfg.booking_image_url ? (
                <div className="relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cfg.booking_image_url} alt="Booking logo" className="max-h-50 w-full rounded-xl bg-[#F4F1E8] object-contain" />
                  <button
                    type="button"
                    onClick={() => set({ booking_image_url: null })}
                    title="Remove image"
                    aria-label="Remove image"
                    className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D8D5C8] bg-[#F4F1E8] py-7 transition-colors hover:border-[#34451F]">
                  {uploading ? <Loader2 className="h-7 w-7 animate-spin text-[#5E6654]" /> : <Upload className="h-7 w-7 text-[#5E6654] opacity-50" />}
                  <span className="font-black text-[11px] tracking-wide text-[#34451F] uppercase">{uploading ? "Uploading…" : "Upload"}</span>
                  <span className="text-[10px] text-[#5E6654]">Shown as the logo on the booking page</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
              {uploadError && <p className="text-[11px] font-bold text-red-600">{uploadError}</p>}
            </div>

            <div className="flex items-start justify-between gap-3 border-t border-[#D8D5C8] px-4 py-2">
              <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Tagline</span>
              <textarea
                aria-label="Tagline"
                value={cfg.tag_line}
                rows={1}
                placeholder="Description shown under the logo"
                onChange={(e) => set({ tag_line: e.target.value })}
                className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-right text-[13px] leading-relaxed font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
              />
            </div>
          </>
        ) : (
          <>
            {cfg.booking_image_url && (
              <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0">
                <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Booking Image (Logo)</span>
                <a
                  href={cfg.booking_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open the full-size image"
                  className="block shrink-0 overflow-hidden rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] transition-colors hover:border-[#34451F]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cfg.booking_image_url} alt="Booking logo" className="h-16 w-28 object-contain" />
                </a>
              </div>
            )}
            {cfg.tag_line && (
              <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0">
                <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Tagline</span>
                <span className="text-right text-[13px] font-semibold text-[#20231A]">{cfg.tag_line}</span>
              </div>
            )}
          </>
        )}
        {bookingPageExtra}
      </SectionCard>

      <SectionCard title="Form Fields">
        <div className="flex flex-col gap-2 bg-[#F4F1E8] p-3.5">
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
