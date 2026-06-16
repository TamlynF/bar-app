"use client";

import { cn } from "@/lib/utils";
import type { BookingConfig } from "@/lib/booking-config";

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-2.5">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] font-black uppercase tracking-wide", value ? "text-green-600" : "text-[#5F624F]")}>
          {value ? "On" : "Off"}
        </span>
        <button
          type="button"
          title={`Toggle ${label}`}
          onClick={() => onChange(!value)}
          className={cn(
            "w-11 h-6 rounded-full transition-colors relative shrink-0 border",
            value ? "bg-green-500 border-green-600" : "bg-[#5F624F]/20 border-[#5F624F]/30"
          )}
        >
          <span className={cn(
            "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            value ? "translate-x-5.25" : "translate-x-0.5"
          )} />
        </button>
      </div>
    </div>
  );
}

function InputRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * Shared editor for a `booking_config` object. Used both for an event's per-event
 * booking config and for an event subtype's `default_booking_config`.
 */
export function BookingConfigEditor({
  value,
  onChange,
}: {
  value: BookingConfig;
  onChange: (next: BookingConfig) => void;
}) {
  const set = (patch: Partial<BookingConfig>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Form Fields */}
      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
        <div className="px-4 sm:px-5 py-2 bg-[#F7F4EA]/50">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#5F624F]">Form Fields</span>
        </div>

        <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">Name</span>
          <span className="text-[10px] font-black uppercase tracking-wide text-green-600">Always On</span>
        </div>
        <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">Email</span>
          <span className="text-[10px] font-black uppercase tracking-wide text-green-600">Always On</span>
        </div>

        <ToggleRow label="Phone Number" value={value.collect_phone !== false} onChange={v => set({ collect_phone: v })} />
        <ToggleRow label="Group Size" value={value.collect_group_size !== false} onChange={v => set({ collect_group_size: v })} />
        <ToggleRow label="Group Name" value={!!value.collect_group_name} onChange={v => set({ collect_group_name: v })} />
        <ToggleRow label="Special Requests" value={value.collect_special_requests !== false} onChange={v => set({ collect_special_requests: v })} />
      </div>

      {/* Booking Customisation */}
      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
        <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60">
          <span className="text-[11px] font-black uppercase tracking-wide text-[#26300D]">Booking Customisation</span>
        </div>

        {value.collect_group_name && (
          <InputRow label="Group Name Label">
            <input
              placeholder="e.g. Team Name"
              value={value.group_name_label ?? ""}
              onChange={e => set({ group_name_label: e.target.value })}
              className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
            />
          </InputRow>
        )}

        {value.collect_group_size !== false && (
          <InputRow label="Max Group Size">
            <input
              type="number"
              min="1"
              max="100"
              placeholder="e.g. 10"
              value={value.max_group_size ?? ""}
              onChange={e => set({ max_group_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40 w-16"
            />
          </InputRow>
        )}

        <InputRow label="Button Text">
          <input
            placeholder="e.g. Book Now"
            value={value.custom_cta_text ?? ""}
            onChange={e => set({ custom_cta_text: e.target.value })}
            className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
          />
        </InputRow>

        <InputRow label="Tagline">
          <input
            placeholder="e.g. Join us for an unforgettable night!"
            value={value.custom_tagline ?? ""}
            onChange={e => set({ custom_tagline: e.target.value })}
            className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
          />
        </InputRow>

        <InputRow label="Confirmation Msg">
          <input
            placeholder="e.g. See you there!"
            value={value.confirmation_message ?? ""}
            onChange={e => set({ confirmation_message: e.target.value })}
            className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
          />
        </InputRow>

        <InputRow label="Booking Image URL">
          <input
            type="url"
            placeholder="https://..."
            value={value.booking_image_url ?? ""}
            onChange={e => set({ booking_image_url: e.target.value || null })}
            className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
          />
        </InputRow>
      </div>
    </div>
  );
}
