"use client";

import React, { useState, useTransition } from "react";
import { createPrivateHire } from "@/app/(public)/_actions/create-private-hire";
import { privateHireSubtypeLabel, type PrivateHireSubtype } from "@/lib/private-hire-subtype";
import {
  CheckCircle2, ArrowLeft, ChevronRight, Calendar, Clock, Users, Info,
  User, Mail, Phone, MessageSquareQuote, Tag,
} from "lucide-react";

const inputClass =
  "w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-stone-700 focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all duration-300 text-sm font-bold";
const labelClass = "block text-[10px] font-black text-stone-500 mb-2 uppercase tracking-[0.15em] ml-1";
const iconContainerClass = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
const iconClass = "w-4 h-4 text-stone-600 transition-colors duration-200 group-focus-within:text-[#fdcc4b]";

const STEPS = [
  { number: 1, title: "Your Details",  subtitle: "Who should we contact?" },
  { number: 2, title: "Your Event",    subtitle: "Tell us about the occasion." },
  { number: 3, title: "Final Details", subtitle: "Anything else we should know?" },
];

export default function PrivateHireForm({ subtypes }: { subtypes: PrivateHireSubtype[] }) {
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
  const [eventSubtypeId, setEventSubtypeId] = useState("");
  const [additionalReqs, setAdditionalReqs] = useState("");

  const selectedSubtype = subtypes.find((s) => String(s.id) === eventSubtypeId);

  // Whether the current step's required fields are all filled — drives the Next button.
  const guestCountNum = parseInt(guestCount, 10);
  const step1Valid = fullName.trim() !== "" && email.trim() !== "" && email.includes("@");
  const step2Valid =
    !isNaN(guestCountNum) && guestCountNum >= 1 &&
    preferredDate !== "" &&
    preferredStartTime !== "" &&
    preferredEndTime !== "" &&
    eventSubtypeId !== "";
  const canProceed = step === 1 ? step1Valid : step === 2 ? step2Valid : true;

  function handleNext() {
    setStepError(null);
    if (step === 1) {
      if (!fullName.trim()) { setStepError("Please enter your full name."); return; }
      if (!email.trim() || !email.includes("@")) { setStepError("Please enter a valid email address."); return; }
    }
    if (step === 2) {
      const count = parseInt(guestCount, 10);
      if (isNaN(count) || count < 1) { setStepError("Please enter a valid number of guests."); return; }
      if (!eventSubtypeId) { setStepError("Please select a reason for hire."); return; }
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
          event_subtypes_id: selectedSubtype ? selectedSubtype.id : null,
          reason_for_hire: privateHireSubtypeLabel(selectedSubtype, "Private Hire"),
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
    <form onSubmit={handleSubmit} className="space-y-0 overflow-hidden">

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
            <div className="space-y-1">
              <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
              <div className="relative group">
                <div className={iconContainerClass}>
                  <User className={iconClass} />
                </div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1">
                <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <div className={iconContainerClass}>
                    <Mail className={iconClass} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Phone</label>
                <div className="relative group">
                  <div className={iconContainerClass}>
                    <Phone className={iconClass} />
                  </div>
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
          </>
        )}

        {/* Step 2: Your Event */}
        {step === 2 && (
          <>
            <div className="space-y-1">
              <label className={labelClass}>Number of Guests <span className="text-red-500">*</span></label>
              <div className="relative group">
                <div className={iconContainerClass}>
                  <Users className={iconClass} />
                </div>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  placeholder="e.g. 50"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Date <span className="text-red-500">*</span></label>
              <div className="relative group">
                <div className={iconContainerClass}>
                  <Calendar className={iconClass} />
                </div>
                <input
                  title="Select a date"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className={`${inputClass} min-w-0 input-scheme-dark`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-6 overflow-hidden">
              <div className="space-y-1 min-w-0">
                <label className={labelClass}>Start Time <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <div className={iconContainerClass}>
                    <Clock className={iconClass} />
                  </div>
                  <input
                    title="Start time"
                    type="time"
                    value={preferredStartTime}
                    onChange={(e) => setPreferredStartTime(e.target.value)}
                    className={`${inputClass} min-w-0 pl-9 sm:pl-11 input-scheme-dark`}
                  />
                </div>
              </div>
              <div className="space-y-1 min-w-0">
                <label className={labelClass}>End Time <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <div className={iconContainerClass}>
                    <Clock className={iconClass} />
                  </div>
                  <input
                    title="End time"
                    type="time"
                    value={preferredEndTime}
                    onChange={(e) => setPreferredEndTime(e.target.value)}
                    className={`${inputClass} min-w-0 pl-9 sm:pl-11 input-scheme-dark`}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Reason for Hire <span className="text-red-500">*</span></label>
              <div className="relative group">
                <div className={iconContainerClass}>
                  <Tag className={iconClass} />
                </div>
                <select
                  title="Reason for Hire"
                  value={eventSubtypeId}
                  onChange={(e) => setEventSubtypeId(e.target.value)}
                  className={`${inputClass} appearance-none pr-10 cursor-pointer`}
                >
                  <option value="">Select a reason</option>
                  {subtypes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {privateHireSubtypeLabel(s)}
                    </option>
                  ))}
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 rotate-90 pointer-events-none" />
              </div>
            </div>
          </>
        )}

        {/* Step 3: Final Details */}
        {step === 3 && (
          <>
            <div className="space-y-1">
              <label className={labelClass}>Additional Requests</label>
              <div className="relative group">
                <div className={iconContainerClass}>
                  <MessageSquareQuote className={iconClass} />
                </div>
                <textarea
                  title="Additional requests or special requirements"
                  value={additionalReqs}
                  onChange={(e) => setAdditionalReqs(e.target.value)}
                  placeholder=""
                  rows={4}
                  className={`${inputClass} min-h-25 py-3 resize-none`}
                />
              </div>
            </div>

            {/* Deposit notice */}
            {/* <div className="flex items-start gap-3 bg-[#FDCC4B]/8 border border-[#FDCC4B]/20 rounded-2xl px-4 py-3.5 mt-2">
              <Info className="w-4 h-4 text-[#FDCC4B] shrink-0 mt-0.5" />
              <p className="text-xs text-stone-300 font-medium leading-relaxed">
                <span className="font-black text-[#FDCC4B]">Deposit required.</span> Once we&apos;ve reviewed your enquiry, we&apos;ll be in touch to confirm availability and share deposit payment details to secure your booking.
              </p>
            </div> */}
          </>
        )}

      </div>

      {/* Step error */}
      {stepError && (
        <p className="mt-4 text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
          {stepError}
        </p>
      )}

      {/* Submit error */}
      {error && step === 3 && (
        <p className="mt-4 text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 h-16 px-5 rounded-2xl border border-white/10 text-stone-400 font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all"
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
            disabled={!canProceed}
            className="flex-1 flex items-center justify-center gap-2 h-16 bg-[#fdcc4b] text-[#26300D] font-black text-lg uppercase tracking-widest rounded-2xl transition-all hover:bg-[#e5b843] active:scale-95 shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#fdcc4b] disabled:active:scale-100"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            key="submit"
            type="submit"
            disabled={isPending}
            className="flex-1 h-16 bg-[#fdcc4b] text-[#26300D] font-black text-lg uppercase tracking-widest rounded-2xl transition-all hover:bg-[#e5b843] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)]"
          >
            {isPending ? "Submitting…" : "Send Enquiry"}
          </button>
        )}
      </div>

    </form>
  );
}
