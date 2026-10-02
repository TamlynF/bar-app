"use client";

import React, { useState, useTransition } from "react";
import { createPrivateHire } from "@/app/(public)/_actions/create-private-hire";
import { privateHireSubtypeLabel, type PrivateHireSubtype } from "@/lib/private-hire-subtype";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Users,
  User,
  Mail,
  Phone,
  MessageSquareQuote,
  Tag,
  Info,
} from "lucide-react";
import { FieldError, incompleteButtonClass } from "@/app/(public)/book/_components/field-error";
import {
  stepBackButtonClass,
  stepButtonRowClass,
  stepPrimaryButtonClass,
} from "@/app/(public)/book/_components/step-button-styles";
import { scrollFormToRest, useFormScrollRest } from "@/app/(public)/book/_components/use-form-scroll-rest";
import { describeOpenSessionClash, openSessionClash, type OpeningHours } from "@/lib/opening-hours";
import { formatGBP } from "@/lib/events-display";

const inputBaseClass =
  "w-full bg-black/40 border rounded-2xl pl-11 pr-4 py-3 sm:py-4 text-white placeholder-stone-700 focus:outline-none focus:ring-1 transition-all duration-300 text-sm font-bold";
const labelClass = "block text-[10px] font-black text-stone-500 mb-1 sm:mb-2 uppercase tracking-[0.15em] ml-1";
const iconContainerClass = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
const iconClass = "w-4 h-4 text-stone-600 transition-colors duration-200 group-focus-within:text-[#fdcc4b]";
const helperClass =
  "col-span-2 -mt-1 ml-1 flex items-start gap-1.5 text-xs leading-relaxed text-ink-2 sm:col-span-1 sm:mt-2";
/* iPhone Safari draws date and time inputs at their own natural width, which
   spills out of a half-width column; without the native styling they fill
   the column like any other input, so they need an explicit height. */
const dateTimeInputClass =
  "input-scheme-dark block h-11.5 min-w-0 appearance-none pl-9 sm:h-13.5 sm:pl-11 [&::-webkit-date-and-time-value]:text-left";

function inputClass(hasError: boolean) {
  return `${inputBaseClass} ${
    hasError
      ? "border-red-500/60 focus:border-red-500 focus:ring-red-500"
      : "border-white/10 focus:border-[#fdcc4b] focus:ring-[#fdcc4b]"
  }`;
}

const STEPS = [
  { number: 1, title: "Your Details", subtitle: "Who should we contact?" },
  { number: 2, title: "Your Event", subtitle: "Tell us about the occasion." },
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
  | "eventSubtypeId"
  | "slot";

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
  openingHours,
  deposit,
}: {
  subtypes: PrivateHireSubtype[];
  minCapacity: number | null;
  maxCapacity: number | null;
  openingHours: OpeningHours | null;
  deposit: number | null;
}) {
  const depositLabel = deposit ? formatGBP(deposit) : null;
  const minGuests = minCapacity ?? DEFAULT_MIN_GUESTS;

  const [isPending, startTransition] = useTransition();
  useFormScrollRest();
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
  const openClash =
    preferredDate && preferredStartTime && preferredEndTime
      ? openSessionClash(openingHours, preferredDate, toMinutes(preferredStartTime), toMinutes(preferredEndTime))
      : null;
  const openClashMessage = openClash ? describeOpenSessionClash(openClash) : undefined;

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
        errors.preferredEndTime =
          "End time must be later than the start time, unless the event runs into the early hours.";
      }
    }

    if (!errors.preferredEndTime && openClashMessage) errors.slot = openClashMessage;

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

  const stepComplete = Object.keys(step === 1 ? validateStep1() : step === 2 ? validateStep2() : {}).length === 0;

  function handleNext() {
    const errors = step === 1 ? validateStep1() : validateStep2();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStep((s) => s + 1);
    scrollFormToRest();
  }

  function handleBack() {
    setFieldErrors({});
    setStep((s) => s - 1);
    scrollFormToRest();
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
          We&apos;ve received your private hire enquiry. Our team will be in touch shortly to discuss availability and
          next steps.
        </p>
      </div>
    );
  }

  const currentStep = STEPS[step - 1];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-0 overflow-hidden">
      <div className="mb-4 flex items-center justify-between sm:mb-8">
        <div className="flex items-center gap-2">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s.number < step ? "w-6 bg-[#FDCC4B]" : s.number === step ? "w-8 bg-[#FDCC4B]" : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>
        <span className="font-black text-[10px] tracking-widest text-stone-600 uppercase">
          {step} of {STEPS.length}
        </span>
      </div>

      <div className="mb-4 sm:mb-7">
        <h4 className="mb-1 font-black text-xl leading-none sm:text-2xl tracking-tight text-white uppercase">
          {currentStep.title}
        </h4>
        <p className="text-sm font-medium text-ink-2 sm:text-xs sm:text-stone-500">{currentStep.subtitle}</p>
      </div>

      <div key={step} className="animate-in space-y-3 duration-200 fade-in sm:space-y-4">
        {step === 1 && (
          <>
            <div className="space-y-1">
              <label htmlFor="ph-full-name" className={labelClass}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <User className={iconClass} />
                </div>
                <input
                  id="ph-full-name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearFieldError("fullName");
                  }}
                  placeholder="Your full name"
                  aria-invalid={!!fieldErrors.fullName}
                  className={inputClass(!!fieldErrors.fullName)}
                />
              </div>
              <FieldError message={fieldErrors.fullName} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div className="space-y-1">
                <label htmlFor="ph-email" className={labelClass}>
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <Mail className={iconClass} />
                  </div>
                  <input
                    id="ph-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError("email");
                    }}
                    placeholder="your@email.com"
                    aria-invalid={!!fieldErrors.email}
                    className={inputClass(!!fieldErrors.email)}
                  />
                </div>
                <FieldError message={fieldErrors.email} />
              </div>
              <div className="space-y-1">
                <label htmlFor="ph-phone" className={labelClass}>
                  Phone
                </label>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1 sm:gap-0">
              <div className="min-w-0 space-y-1">
                <label htmlFor="ph-guest-count" className={labelClass}>
                  Number of Guests <span className="text-red-500">*</span>
                </label>
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
                    onChange={(e) => {
                      setGuestCount(e.target.value);
                      clearFieldError("guestCount");
                    }}
                    onBlur={handleGuestCountBlur}
                    placeholder={`e.g. ${minGuests}`}
                    aria-invalid={!!fieldErrors.guestCount}
                    className={inputClass(!!fieldErrors.guestCount)}
                  />
                </div>
                <FieldError message={fieldErrors.guestCount} />
              </div>
              <p className={`${helperClass} max-sm:order-last`}>
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
                <span>Your best estimate of guests helps us plan staffing.</span>
              </p>

              <div className="min-w-0 space-y-1 sm:mt-4">
                <label htmlFor="ph-date" className={labelClass}>
                  Date <span className="text-red-500">*</span>
                </label>
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
                    onChange={(e) => {
                      setPreferredDate(e.target.value);
                      clearFieldError("preferredDate");
                    }}
                    aria-invalid={!!fieldErrors.preferredDate}
                    className={`${inputClass(!!fieldErrors.preferredDate)} ${dateTimeInputClass}`}
                  />
                </div>
                <FieldError message={fieldErrors.preferredDate} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="min-w-0 space-y-1">
                <label htmlFor="ph-start-time" className={labelClass}>
                  Start Time <span className="text-red-500">*</span>
                </label>
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
                    className={`${inputClass(!!fieldErrors.preferredStartTime)} ${dateTimeInputClass}`}
                  />
                </div>
                <FieldError message={fieldErrors.preferredStartTime} />
              </div>
              <div className="min-w-0 space-y-1">
                <label htmlFor="ph-end-time" className={labelClass}>
                  End Time <span className="text-red-500">*</span>
                </label>
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
                    onChange={(e) => {
                      setPreferredEndTime(e.target.value);
                      clearFieldError("preferredEndTime");
                    }}
                    aria-invalid={!!fieldErrors.preferredEndTime}
                    className={`${inputClass(!!fieldErrors.preferredEndTime)} ${dateTimeInputClass}`}
                  />
                </div>
                <FieldError message={fieldErrors.preferredEndTime} />
              </div>
            </div>
            <FieldError id="ph-slot-error" message={openClashMessage} />

            <div className="space-y-1">
              <label htmlFor="ph-reason" className={labelClass}>
                Reason for Hire <span className="text-red-500">*</span>
              </label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <Tag className={iconClass} />
                </div>
                <select
                  id="ph-reason"
                  title="Reason for Hire"
                  value={eventSubtypeId}
                  onChange={(e) => {
                    setEventSubtypeId(e.target.value);
                    clearFieldError("eventSubtypeId");
                  }}
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
            {depositLabel && (
              <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4">
                <p className="flex items-center gap-2 font-black text-sm tracking-wide text-gold uppercase">
                  <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {depositLabel} refundable deposit
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  Private hire is secured with a {depositLabel} deposit, refunded against your bar spend on the night.
                </p>
                <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink-2">
                  <li className="flex gap-2">
                    <span aria-hidden="true" className="text-gold">
                      •
                    </span>
                    <span>Spend {depositLabel} or more at the bar and the full deposit is returned.</span>
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden="true" className="text-gold">
                      •
                    </span>
                    <span>Spend less and we refund the amount you spent.</span>
                  </li>
                </ul>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="ph-additional" className={labelClass}>
                Additional Requests
              </label>
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

      <div className={stepButtonRowClass}>
        {step > 1 && (
          <button type="button" onClick={handleBack} className={stepBackButtonClass}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            key="next"
            type="button"
            onClick={handleNext}
            disabled={step === 2 && !!openClashMessage}
            aria-describedby={step === 2 && openClashMessage ? "ph-slot-error" : undefined}
            className={`${stepPrimaryButtonClass} ${stepComplete ? "" : incompleteButtonClass}`}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button key="submit" type="submit" disabled={isPending} className={stepPrimaryButtonClass}>
            {isPending ? (
              "Submitting…"
            ) : (
              <>
                Submit
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>
    </form>
  );
}
