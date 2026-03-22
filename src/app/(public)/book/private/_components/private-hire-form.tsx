"use client";

import React, { useState, useTransition } from "react";
import { createPrivateHire } from "@/app/(public)/_actions/create-private-hire";
import { CheckCircle2 } from "lucide-react";

export default function PrivateHireForm() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");
  const [additionalReqs, setAdditionalReqs] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const count = parseInt(guestCount, 10);
    if (isNaN(count) || count < 1) {
      setError("Please enter a valid number of guests.");
      return;
    }
    startTransition(async () => {
      try {
        await createPrivateHire({
          full_name: fullName,
          email,
          phone_no: phone || undefined,
          guest_count: count,
          preferred_date: preferredDate || undefined,
          preferred_time: preferredTime || undefined,
          reason_for_hire: reason,
          additional_requirements: additionalReqs || undefined,
        });
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center py-8 gap-4">
        <CheckCircle2 className="w-12 h-12 text-[#FDCC4B]" />
        <h3 className="text-white font-black text-xl uppercase tracking-tight">Enquiry Submitted!</h3>
        <p className="text-stone-400 text-sm max-w-xs leading-relaxed">
          We&apos;ve received your private hire enquiry. Our team will be in touch shortly.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FDCC4B]/40 focus:ring-1 focus:ring-[#FDCC4B]/20 transition-all";
  const labelClass = "block text-[11px] font-black uppercase tracking-widest text-stone-400 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Contact */}
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Your Details</p>

        <div>
          <label className={labelClass}>Full Name *</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email *</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 000000"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Event Details */}
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Event Details</p>

        <div>
          <label className={labelClass}>Number of Guests *</label>
          <input
            required
            type="number"
            min="1"
            max="500"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            placeholder="e.g. 50"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Preferred Date</label>
            <input
              title="Select a date"
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className={inputClass}
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className={labelClass}>Preferred Time</label>
            <input
              title="Select a time"
              type="text"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              placeholder="e.g. 7:00 PM – 11:00 PM"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Reason for Hire *</label>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Birthday party, corporate event, anniversary dinner…"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>Additional Requirements</label>
          <textarea
            value={additionalReqs}
            onChange={(e) => setAdditionalReqs(e.target.value)}
            placeholder="Any specific needs — catering, AV equipment, decorations, accessibility…"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#FDCC4B] text-[#26300D] font-black text-sm uppercase tracking-wider rounded-xl py-4 transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FDCC4B]/20"
      >
        {isPending ? "Submitting…" : "Send Enquiry"}
      </button>
    </form>
  );
}
