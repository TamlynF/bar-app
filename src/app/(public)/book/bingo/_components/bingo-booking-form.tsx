"use client";

import { useState, useTransition } from "react";
import { createBingoBooking } from "@/app/(public)/_actions/create-bingo-booking";
import { AlertCircle, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = [
  { code: "+44", country: "United Kingdom" },
  { code: "+1", country: "United States / Canada" },
  { code: "+353", country: "Ireland" },
  { code: "+33", country: "France" },
  { code: "+49", country: "Germany" },
  { code: "+34", country: "Spain" },
  { code: "+39", country: "Italy" },
  { code: "+31", country: "Netherlands" },
  { code: "+48", country: "Poland" },
  { code: "+351", country: "Portugal" },
  { code: "+61", country: "Australia" },
  { code: "+64", country: "New Zealand" },
  { code: "+27", country: "South Africa" },
  { code: "+91", country: "India" },
  { code: "+86", country: "China" },
  { code: "+81", country: "Japan" },
  { code: "+82", country: "South Korea" },
  { code: "+55", country: "Brazil" },
  { code: "+52", country: "Mexico" },
  { code: "+971", country: "UAE" },
];

interface Props {
  pricePerPersonPence: number;
}

export default function BingoBookingForm({ pricePerPersonPence }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [groupSize, setGroupSize] = useState(1);

  const pricePerPerson = pricePerPersonPence / 100;
  const total = pricePerPerson * groupSize;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createBingoBooking(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    });
  };

  const labelClass =
    "block text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1.5";
  const inputClass =
    "w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold text-[#1F1F1A] placeholder:text-[#5F624F]/40 focus:border-[#26300D] outline-none transition-all";

  const today = new Date().toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Event Date */}
      <div>
        <label className={labelClass}>
          Event Date <span className="text-red-500">*</span>
        </label>
        <input
          name="event_date"
          type="date"
          required
          min={today}
          className={inputClass}
        />
      </div>

      {/* Full Name */}
      <div>
        <label className={labelClass}>
          Your Name <span className="text-red-500">*</span>
        </label>
        <input
          name="full_name"
          type="text"
          placeholder="e.g. Jane Smith"
          required
          className={inputClass}
        />
      </div>

      {/* Email */}
      <div>
        <label className={labelClass}>
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          name="email"
          type="email"
          placeholder="e.g. jane@email.com"
          required
          className={inputClass}
        />
      </div>

      {/* Phone */}
      <div>
        <label className={labelClass}>Phone Number</label>
        <div className="flex gap-3">
          <div className="relative shrink-0 w-24">
            <select
              title="Country Code"
              name="country_code"
              defaultValue="+44"
              className="w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white pl-3 pr-7 text-sm font-bold outline-none focus:border-[#26300D] appearance-none text-[#1F1F1A]"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code + c.country} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F]/30 rotate-90 pointer-events-none" />
          </div>
          <input
            name="phone_no"
            type="tel"
            placeholder="7123 456789"
            className={cn(inputClass, "flex-1")}
          />
        </div>
      </div>

      {/* Group Size */}
      <div>
        <label className={labelClass}>
          Number of People <span className="text-red-500">*</span>
        </label>
        <input
          name="group_size"
          type="number"
          min={1}
          required
          value={groupSize}
          onChange={(e) => setGroupSize(Math.max(1, parseInt(e.target.value) || 1))}
          className={inputClass}
        />
      </div>

      {/* Price Preview */}
      <div className="bg-[#26300D] rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]/70">
            Total to Pay
          </p>
          <p className="text-2xl font-black text-white tabular-nums">
            £{total.toFixed(2)}
          </p>
        </div>
        <p className="text-[11px] font-bold text-[#FDCC4B]/60 text-right leading-snug">
          £{pricePerPerson.toFixed(2)} per person
          <br />× {groupSize} {groupSize === 1 ? "person" : "people"}
        </p>
      </div>

      {/* Special Requests */}
      <div>
        <label className={labelClass}>Special Requests</label>
        <textarea
          name="special_requests"
          placeholder="Dietary requirements, accessibility needs..."
          rows={3}
          className="w-full rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 py-3.5 text-sm font-bold text-[#1F1F1A] placeholder:text-[#5F624F]/40 focus:border-[#26300D] outline-none transition-all resize-none"
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-bold leading-snug">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-sm shadow-lg active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Setting up payment…
          </>
        ) : (
          <>Pay & Book — £{total.toFixed(2)}</>
        )}
      </button>

      <p className="text-center text-[11px] text-[#5F624F] font-medium">
        You&apos;ll be taken to a secure Square checkout to complete payment.
      </p>
    </form>
  );
}
