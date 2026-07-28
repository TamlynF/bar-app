"use client";

import React, { useState, useTransition } from "react";
import { createPrivateHire } from "@/app/(public)/_actions/create-private-hire";
import { privateHireSubtypeLabel, type PrivateHireSubtype } from "@/lib/private-hire-subtype";
import {
  CheckCircle2, ArrowLeft, ChevronRight, Calendar, Clock, Users,
  User, Mail, Phone, MessageSquareQuote, Tag, Info,
} from "lucide-react";

const inputBaseClass =
  "w-full bg-black/40 border rounded-2xl pl-11 pr-4 py-4 text-white placeholder-stone-700 focus:outline-none focus:ring-1 transition-all duration-300 text-sm font-bold";
const labelClass = "block text-[10px] font-black text-stone-500 mb-2 uppercase tracking-[0.15em] ml-1";
const iconContainerClass = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
const iconClass = "w-4 h-4 text-stone-600 transition-colors duration-200 group-focus-within:text-[#fdcc4b]";
const helperClass =
  "mt-2 flex items-start gap-2 rounded-xl border border-[#FDCC4B]/25 bg-[#FDCC4B]/10 px-3 py-2.5 text-[11px] font-bold leading-relaxed text-[#FDCC4B]";

function inputClass(hasError: boolean) {
  return `${inputBaseClass} ${
    hasError
      ? "border-red-500/60 focus:border-red-500 focus:ring-red-500"
      : "border-white/10 focus:border-[#fdcc4b] focus:ring-[#fdcc4b]"
  }`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 ml-1 text-[10px] font-bold leading-relaxed text-red-400">{message}</p>;
}

const STEPS = [
  { number: 1, title: "Your Details",  subtitle: "Who should we contact?" },
  { number: 2, title: "Your Event",    subtitle: "Tell us about the occasion." },
  { number: 3, title: "Final Details", subtitle: "Anything else we should know?" },
];

const DEFAULT_MIN_GUESTS = 30;
const OVERNIGHT_CUTOFF_MINUTES = 8 * 60;
const DEFAULT_DURATION_MINUTES = 4 * 60;

type FieldKey =
  | "fullName"
  | "email"
  | "guestCount"
  | "preferredDate"
  | "preferredStartTime"
  | "preferredEndTime"
  | "eventSubtypeId";

type FieldErrors = Partial<Record<FieldKey, string>>;

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeString(totalMinutes: number) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const minutes = String(wrapped % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function PrivateHireForm({
  subtypes,
  minCapacity,
  maxCapacity,
}: {
  subtypes: PrivateHireSubtype[];
  minCapacity: number | null;
  maxCapacity: number | null;
}) {
  const minGuests = minCapacity ?? DEFAULT_MIN_GUESTS;

  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [today] = useState(todayIso);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(String(minGuests));
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredStartTime, setPreferredStartTime] = useState("");
  const [preferredEndTime, setPreferredEndTime] = useState("");
  const [eventSubtypeId, setEventSubtypeId] = useState("");
  const [additionalReqs, setAdditionalReqs] = useState("");

  const selectedSubtype = subtypes.find((s) => String(s.id) === eventSubtypeId);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateStep1(): FieldErrors {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = "Please enter your full name.";
    if (!email.trim()) errors.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    return errors;
  }

  function validateGuestCount(): string | undefined {
    const count = parseInt(guestCount, 10);
    if (guestCount.trim() === "" || isNaN(count)) {
      return "Please enter the number of guests attending.";
    }
    if (count < minGuests) {
      return `Private hire requires a minimum of ${minGuests} guests.`;
    }
    if (maxCapacity !== null && count > maxCapacity) {
      return `Our venue can accommodate a maximum of ${maxCapacity} guests.`;
    }
    return undefined;
  }

  function validateStep2(): FieldErrors {
    const errors: FieldErrors = {};

    const guestCountError = validateGuestCount();
    if (guestCountError) errors.guestCount = guestCountError;

    if (!preferredDate) errors.preferredDate = "Please select a date for your event.";
    else if (preferredDate < today) errors.preferredDate = "Please select a date in the future.";

    if (!preferredStartTime) errors.preferredStartTime = "Please select a start time.";
    if (!preferredEndTime) errors.preferredEndTime = "Please select an end time.";

    if (preferredStartTime && preferredEndTime) {
      const start = toMinutes(preferredStartTime);
      const end = toMinutes(preferredEndTime);
      if (end === start) {
        errors.preferredEndTime = "End time must be later than the start time.";
      } else if (end < start && end >= OVERNIGHT_CUTOFF_MINUTES) {
        errors.preferredEndTime = "End time must be later than the start time, unless the event runs into the early hours.";
      }
    }

    if (!eventSubtypeId) errors.eventSubtypeId = "Please select a reason for hire.";

    return errors;
  }

  function handleGuestCountBlur() {
    const message = validateGuestCount();
    setFieldErrors((prev) => {
      if (prev.guestCount === message) return prev;
      const next = { ...prev };
      if (message) next.guestCount = message;
      else delete next.guestCount;
      return next;
    });
  }

  function handleStartTimeChange(value: string) {
    setPreferredStartTime(value);
    clearFieldError("preferredStartTime");
    if (value) {
      setPreferredEndTime(toTimeString(toMinutes(value) + DEFAULT_DURATION_MINUTES));
      clearFieldError("preferredEndTime");
    }
  }

  function handleNext() {
    const errors = step === 1 ? validateStep1() : validateStep2();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStep((s) => s + 1);
  }

  function handleBack() {
    setFieldErrors({});
    setStep((s) => s - 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const step1Errors = validateStep1();
    if (Object.keys(step1Errors).length > 0) {
      setFieldErrors(step1Errors);
      setStep(1);
      return;
    }

    const step2Errors = validateStep2();
    if (Object.keys(step2Errors).length > 0) {
      setFieldErrors(step2Errors);
      setStep(2);
      return;
    }

    setFieldErrors({});
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
    <form onSubmit={handleSubmit} noValidate className="space-y-0 overflow-hidden">

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
              <label htmlFor="ph-full-name" className={labelClass}>Full Name <span className="text-red-500">*</span></label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <User className={iconClass} />
                </div>
                <input
                  id="ph-full-name"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); clearFieldError("fullName"); }}
                  placeholder="Your full name"
                  aria-invalid={!!fieldErrors.fullName}
                  className={inputClass(!!fieldErrors.fullName)}
                />
              </div>
              <FieldError message={fieldErrors.fullName} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div className="space-y-1">
                <label htmlFor="ph-email" className={labelClass}>Email <span className="text-red-500">*</span></label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <Mail className={iconClass} />
                  </div>
                  <input
                    id="ph-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    placeholder="your@email.com"
                    aria-invalid={!!fieldErrors.email}
                    className={inputClass(!!fieldErrors.email)}
                  />
                </div>
                <FieldError message={fieldErrors.email} />
              </div>
              <div className="space-y-1">
                <label htmlFor="ph-phone" className={labelClass}>Phone</label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <Phone className={iconClass} />
                  </div>
                  <input
                    id="ph-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 7700 000000"
                    className={inputClass(false)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-1">
              <label htmlFor="ph-guest-count" className={labelClass}>Number of Guests <span className="text-red-500">*</span></label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <Users className={iconClass} />
                </div>
                <input
                  id="ph-guest-count"
                  type="number"
                  inputMode="numeric"
                  min={minGuests}
                  max={maxCapacity ?? undefined}
                  value={guestCount}
                  onChange={(e) => { setGuestCount(e.target.value); clearFieldError("guestCount"); }}
                  onBlur={handleGuestCountBlur}
                  placeholder={`e.g. ${minGuests}`}
                  aria-invalid={!!fieldErrors.guestCount}
                  className={inputClass(!!fieldErrors.guestCount)}
                />
              </div>
              <FieldError message={fieldErrors.guestCount} />
              <p className={helperClass}>
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>Please try and be as accurate as you can, so that we can plan staffing accordingly!</span>
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="ph-date" className={labelClass}>Date <span className="text-red-500">*</span></label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <Calendar className={iconClass} />
                </div>
                <input
                  id="ph-date"
                  title="Select a date"
                  type="date"
                  min={today}
                  value={preferredDate}
                  onChange={(e) => { setPreferredDate(e.target.value); clearFieldError("preferredDate"); }}
                  aria-invalid={!!fieldErrors.preferredDate}
                  className={`${inputClass(!!fieldErrors.preferredDate)} input-scheme-dark min-w-0`}
                />
              </div>
              <FieldError message={fieldErrors.preferredDate} />
            </div>

            <div className="grid grid-cols-2 gap-3 overflow-hidden sm:gap-6">
              <div className="min-w-0 space-y-1">
                <label htmlFor="ph-start-time" className={labelClass}>Start Time <span className="text-red-500">*</span></label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <Clock className={iconClass} />
                  </div>
                  <input
                    id="ph-start-time"
                    title="Start time"
                    type="time"
                    step={900}
                    value={preferredStartTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    aria-invalid={!!fieldErrors.preferredStartTime}
                    className={`${inputClass(!!fieldErrors.preferredStartTime)} input-scheme-dark min-w-0 pl-9 sm:pl-11`}
                  />
                </div>
                <FieldError message={fieldErrors.preferredStartTime} />
              </div>
              <div className="min-w-0 space-y-1">
                <label htmlFor="ph-end-time" className={labelClass}>End Time <span className="text-red-500">*</span></label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <Clock className={iconClass} />
                  </div>
                  <input
                    id="ph-end-time"
                    title="End time"
                    type="time"
                    step={900}
                    value={preferredEndTime}
                    onChange={(e) => { setPreferredEndTime(e.target.value); clearFieldError("preferredEndTime"); }}
                    aria-invalid={!!fieldErrors.preferredEndTime}
                    className={`${inputClass(!!fieldErrors.preferredEndTime)} input-scheme-dark min-w-0 pl-9 sm:pl-11`}
                  />
                </div>
                <FieldError message={fieldErrors.preferredEndTime} />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="ph-reason" className={labelClass}>Reason for Hire <span className="text-red-500">*</span></label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <Tag className={iconClass} />
                </div>
                <select
                  id="ph-reason"
                  title="Reason for Hire"
                  value={eventSubtypeId}
                  onChange={(e) => { setEventSubtypeId(e.target.value); clearFieldError("eventSubtypeId"); }}
                  aria-invalid={!!fieldErrors.eventSubtypeId}
                  className={`${inputClass(!!fieldErrors.eventSubtypeId)} cursor-pointer appearance-none pr-10`}
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
              <FieldError message={fieldErrors.eventSubtypeId} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="space-y-1">
              <label htmlFor="ph-additional" className={labelClass}>Additional Requests</label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <MessageSquareQuote className={iconClass} />
                </div>
                <textarea
                  id="ph-additional"
                  title="Additional requests or special requirements"
                  value={additionalReqs}
                  onChange={(e) => setAdditionalReqs(e.target.value)}
                  placeholder="Type your requests here..."
                  rows={4}
                  className={`${inputClass(false)} min-h-25 resize-none py-3`}
                />
              </div>
            </div>

          </>
        )}

      </div>

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
            className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#fdcc4b] font-black text-lg tracking-widest text-[#26300D] uppercase shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] transition-all hover:bg-[#e5b843] active:scale-95"
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
