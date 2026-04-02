"use client";

import React, { useState, useTransition } from "react";
import { createPrivateHire } from "@/app/(public)/_actions/create-private-hire";
import {
  CheckCircle2, ArrowLeft, ChevronRight, Calendar, Clock, Users, Info,
} from "lucide-react";

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FDCC4B]/40 focus:ring-1 focus:ring-[#FDCC4B]/20 transition-all";
const labelClass = "block text-[11px] font-black uppercase tracking-widest text-stone-400 mb-1.5";

const STEPS = [
  { number: 1, title: "Your Details",  subtitle: "Who should we contact?" },
  { number: 2, title: "Your Event",    subtitle: "Tell us about the occasion." },
  { number: 3, title: "Final Details", subtitle: "Anything else we should know?" },
];

export default function PrivateHireForm() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredStartTime, setPreferredStartTime] = useState("");
  const [preferredEndTime, setPreferredEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [additionalReqs, setAdditionalReqs] = useState("");

  function handleNext() {
    setStepError(null);
    if (step === 1) {
      if (!fullName.trim()) { setStepError("Please enter your full name."); return; }
      if (!email.trim() || !email.includes("@")) { setStepError("Please enter a valid email address."); return; }
    }
    if (step === 2) {
      const count = parseInt(guestCount, 10);
      if (isNaN(count) || count < 1) { setStepError("Please enter a valid number of guests."); return; }
      if (!reason.trim()) { setStepError("Please describe the reason for hire."); return; }
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStepError(null);
    setStep((s) => s - 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const count = parseInt(guestCount, 10);
    startTransition(async () => {
      try {
        await createPrivateHire({
          full_name: fullName,
          email,
          phone_no: phone || undefined,
          guest_count: count,
          preferred_date: preferredDate || undefined,
          preferred_start_time: preferredStartTime || undefined,
          preferred_end_time: preferredEndTime || undefined,
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
          We&apos;ve received your private hire enquiry. Our team will be in touch shortly to discuss availability and next steps.
        </p>
      </div>
    );
  }

  const currentStep = STEPS[step - 1];

  return (
    <form onSubmit={handleSubmit} className="space-y-0">

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s.number < step
                  ? "w-6 bg-[#FDCC4B]"
                  : s.number === step
                  ? "w-8 bg-[#FDCC4B]"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-600">
          {step} of {STEPS.length}
        </span>
      </div>

      {/* Step heading */}
      <div className="mb-7">
        <h4 className="text-2xl font-black text-white uppercase tracking-tight leading-none mb-1">
          {currentStep.title}
        </h4>
        <p className="text-stone-500 text-xs font-medium">{currentStep.subtitle}</p>
      </div>

      {/* Step content */}
      <div key={step} className="space-y-4 animate-in fade-in duration-200">

        {/* Step 1: Your Details */}
        {step === 1 && (
          <>
            <div>
              <label className={labelClass}>Full Name <span className="text-red-400">*</span></label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email <span className="text-red-400">*</span></label>
                <input
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
          </>
        )}

        {/* Step 2: Your Event */}
        {step === 2 && (
          <>
            <div>
              <label className={labelClass}>Number of Guests <span className="text-red-400">*</span></label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  placeholder="e.g. 50"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Date <span className="text-red-400">*</span></label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
                <input
                  title="Select a date"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className={`${inputClass} pl-10 input-scheme-dark max-w-full`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start Time <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-600 pointer-events-none" />
                  <input
                    title="Start time"
                    type="time"
                    value={preferredStartTime}
                    onChange={(e) => setPreferredStartTime(e.target.value)}
                    className={`${inputClass} px-2! pl-8 input-scheme-dark max-w-full`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>End Time <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-600 pointer-events-none" />
                  <input
                    title="End time"
                    type="time"
                    value={preferredEndTime}
                    onChange={(e) => setPreferredEndTime(e.target.value)}
                    className={`${inputClass} px-2! pl-8 input-scheme-dark max-w-full`}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Reason for Hire <span className="text-red-400">*</span></label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Birthday party, corporate event, anniversary dinner…"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>
          </>
        )}

        {/* Step 3: Final Details */}
        {step === 3 && (
          <>
            <div>
              <label className={labelClass}>Additional Requirements</label>
              <textarea
                value={additionalReqs}
                onChange={(e) => setAdditionalReqs(e.target.value)}
                placeholder="Catering, AV equipment, decorations, accessibility needs…"
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Deposit notice */}
            <div className="flex items-start gap-3 bg-[#FDCC4B]/8 border border-[#FDCC4B]/20 rounded-xl px-4 py-3.5 mt-2">
              <Info className="w-4 h-4 text-[#FDCC4B] shrink-0 mt-0.5" />
              <p className="text-[12px] text-stone-300 font-medium leading-relaxed">
                <span className="font-black text-[#FDCC4B]">Deposit required.</span> Once we&apos;ve reviewed your enquiry, we&apos;ll be in touch to confirm availability and share deposit payment details to secure your booking.
              </p>
            </div>
          </>
        )}

      </div>

      {/* Step error */}
      {stepError && (
        <p className="mt-4 text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {stepError}
        </p>
      )}

      {/* Submit error */}
      {error && step === 3 && (
        <p className="mt-4 text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 h-14 px-5 rounded-xl border border-white/10 text-stone-400 font-black text-xs uppercase tracking-wider hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            key="next"
            type="button"
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-2 h-14 bg-[#FDCC4B] text-[#26300D] font-black text-sm uppercase tracking-wider rounded-xl transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] shadow-lg shadow-[#FDCC4B]/20"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            key="submit"
            type="submit"
            disabled={isPending}
            className="flex-1 h-14 bg-[#FDCC4B] text-[#26300D] font-black text-sm uppercase tracking-wider rounded-xl transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FDCC4B]/20"
          >
            {isPending ? "Submitting…" : "Send Enquiry"}
          </button>
        )}
      </div>

    </form>
  );
}
