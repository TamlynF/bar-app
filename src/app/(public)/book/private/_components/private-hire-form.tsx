"use client";

import React, { useState, useTransition } from "react";
import { createPrivateHire } from "@/app/(public)/_actions/create-private-hire";
import { privateHireSubtypeLabel, type PrivateHireSubtype } from "@/lib/private-hire-subtype";
import {
  CheckCircle2, ArrowLeft, ChevronRight, Calendar, Clock, Users,
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
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-[#FDCC4B]" />
        <h3 className="font-black text-xl tracking-tight text-white uppercase">Enquiry Submitted!</h3>
        <p className="max-w-xs text-sm leading-relaxed text-stone-400">
          We&apos;ve received your private hire enquiry. Our team will be in touch shortly to discuss availability and next steps.
        </p>
      </div>
    );
  }

  const currentStep = STEPS[step - 1];

  return (
    <form onSubmit={handleSubmit} className="space-y-0 overflow-hidden">

      <div className="mb-8 flex items-center justify-between">
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
        <span className="font-black text-[10px] tracking-widest text-stone-600 uppercase">
          {step} of {STEPS.length}
        </span>
      </div>

      <div className="mb-7">
        <h4 className="mb-1 font-black text-2xl leading-none tracking-tight text-white uppercase">
          {currentStep.title}
        </h4>
        <p className="text-xs font-medium text-stone-500">{currentStep.subtitle}</p>
      </div>

      <div key={step} className="animate-in space-y-4 duration-200 fade-in">

        {step === 1 && (
          <>
            <div className="space-y-1">
              <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
              <div className="group relative">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div className="space-y-1">
                <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                <div className="group relative">
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
                <div className="group relative">
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

        {step === 2 && (
          <>
            <div className="space-y-1">
              <label className={labelClass}>Number of Guests <span className="text-red-500">*</span></label>
              <div className="group relative">
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
              <div className="group relative">
                <div className={iconContainerClass}>
                  <Calendar className={iconClass} />
                </div>
                <input
                  title="Select a date"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className={`${inputClass} input-scheme-dark min-w-0`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 overflow-hidden sm:gap-6">
              <div className="min-w-0 space-y-1">
                <label className={labelClass}>Start Time <span className="text-red-500">*</span></label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <Clock className={iconClass} />
                  </div>
                  <input
                    title="Start time"
                    type="time"
                    value={preferredStartTime}
                    onChange={(e) => setPreferredStartTime(e.target.value)}
                    className={`${inputClass} input-scheme-dark min-w-0 pl-9 sm:pl-11`}
                  />
                </div>
              </div>
              <div className="min-w-0 space-y-1">
                <label className={labelClass}>End Time <span className="text-red-500">*</span></label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <Clock className={iconClass} />
                  </div>
                  <input
                    title="End time"
                    type="time"
                    value={preferredEndTime}
                    onChange={(e) => setPreferredEndTime(e.target.value)}
                    className={`${inputClass} input-scheme-dark min-w-0 pl-9 sm:pl-11`}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Reason for Hire <span className="text-red-500">*</span></label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <Tag className={iconClass} />
                </div>
                <select
                  title="Reason for Hire"
                  value={eventSubtypeId}
                  onChange={(e) => setEventSubtypeId(e.target.value)}
                  className={`${inputClass} cursor-pointer appearance-none pr-10`}
                >
                  <option value="">Select a reason</option>
                  {subtypes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {privateHireSubtypeLabel(s)}
                    </option>
                  ))}
                </select>
                <ChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-stone-600" />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="space-y-1">
              <label className={labelClass}>Additional Requests</label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <MessageSquareQuote className={iconClass} />
                </div>
                <textarea
                  title="Additional requests or special requirements"
                  value={additionalReqs}
                  onChange={(e) => setAdditionalReqs(e.target.value)}
                  placeholder=""
                  rows={4}
                  className={`${inputClass} min-h-25 resize-none py-3`}
                />
              </div>
            </div>

          </>
        )}

      </div>

      {stepError && (
        <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-400">
          {stepError}
        </p>
      )}

      {error && step === 3 && (
        <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-400">
          {error}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-16 items-center gap-2 rounded-2xl border border-white/10 px-5 font-black text-xs tracking-widest text-stone-400 uppercase transition-all hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            key="next"
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#fdcc4b] font-black text-lg tracking-widest text-[#26300D] uppercase shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] transition-all hover:bg-[#e5b843] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#fdcc4b] disabled:active:scale-100"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            key="submit"
            type="submit"
            disabled={isPending}
            className="h-16 flex-1 rounded-2xl bg-[#fdcc4b] font-black text-lg tracking-widest text-[#26300D] uppercase shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] transition-all hover:bg-[#e5b843] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Submitting…" : "Send Enquiry"}
          </button>
        )}
      </div>

    </form>
  );
}
