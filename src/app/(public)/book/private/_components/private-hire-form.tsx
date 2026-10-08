"use client";

import React, { useState, useTransition } from "react";
import { createPrivateHire } from "@/app/(public)/_actions/create-private-hire";
import { privateHireSubtypeLabel, type PrivateHireSubtype } from "@/lib/private-hire-subtype";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Users,
  User,
  Mail,
  Phone,
  MessageSquareQuote,
  Tag,
  Info,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, incompleteButtonClass } from "@/app/(public)/book/_components/field-error";
import {
  stepBackButtonClass,
  stepButtonRowClass,
  stepPrimaryButtonClass,
} from "@/app/(public)/book/_components/step-button-styles";
import { scrollFormToRest, useFormScrollRest } from "@/app/(public)/book/_components/use-form-scroll-rest";
import { describeOpenSessionClash, openSessionClash, type OpeningHours } from "@/lib/opening-hours";
import { formatGBP } from "@/lib/events-display";
import { cleanPhoneInput, isValidPhone, PHONE_ERROR } from "@/lib/phone";
import { addDays, format, startOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotesTextarea } from "@/app/(public)/book/_components/notes-textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiInstagram, SiMessenger } from "react-icons/si";
import type { MessageChannel } from "@/lib/meta/channels";
import { defaultPreferredChannel, preferredChannelOptions, type BookingArrival } from "@/lib/meta/preferred-channel";

const inputBaseClass =
  "w-full bg-black/40 border rounded-2xl pl-11 pr-4 py-3 sm:py-4 text-white placeholder-stone-700 focus:outline-none focus:ring-1 transition-all duration-300 text-sm font-bold";
const labelClass = "block text-[10px] font-black text-stone-500 mb-1 sm:mb-2 uppercase tracking-[0.15em] ml-1";
const iconContainerClass = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
const iconClass = "w-4 h-4 text-stone-600 transition-colors duration-200 group-focus-within:text-[#fdcc4b]";
const helperClass =
  "col-span-2 -mt-1 ml-1 flex items-start gap-1.5 text-xs leading-relaxed text-ink-2 sm:col-span-1 sm:mt-2";
const selectTriggerClass =
  "h-auto cursor-pointer gap-2 text-left data-[state=open]:border-[#fdcc4b] data-[state=open]:ring-1 data-[state=open]:ring-[#fdcc4b]";
const guestCountInputClass = "pr-22 tabular-nums";
const stepperButtonClass =
  "size-10 rounded-xl text-stone-400 hover:bg-white/10 hover:text-[#fdcc4b] focus-visible:ring-[#fdcc4b]/50 disabled:opacity-30";
const halfWidthFieldClass ="h-11.5 min-w-0 pl-9 sm:h-13.5 sm:pl-11";
const dateTriggerClass = `${halfWidthFieldClass} block truncate text-left`;
const timeTriggerClass = `${selectTriggerClass} ${halfWidthFieldClass} pr-3`;
const calendarThemeVars = {
  "--primary": "#FDCC4B",
  "--primary-foreground": "#26300D",
  "--accent": "rgba(255,255,255,0.10)",
  "--accent-foreground": "#FDCC4B",
  "--background": "transparent",
  "--muted-foreground": "#a8a29e",
  "--border": "rgba(255,255,255,0.10)",
  "--ring": "#FDCC4B",
} as React.CSSProperties;

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
const GUEST_STEP = 5;
const OVERNIGHT_CUTOFF_MINUTES = 8 * 60;
const DEFAULT_DURATION_MINUTES = 4 * 60;

type FieldKey =
  | "fullName"
  | "email"
  | "phone"
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

const TIME_STEP_MINUTES = 15;
const TIME_OPTIONS = Array.from({ length: (24 * 60) / TIME_STEP_MINUTES }, (_, i) =>
  toTimeString(OVERNIGHT_CUTOFF_MINUTES + i * TIME_STEP_MINUTES)
);

function TimeSelect({
  id,
  value,
  onChange,
  hasError,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-invalid={hasError} className={`${inputClass(hasError)} ${timeTriggerClass}`}>
        <SelectValue placeholder="--:--" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {TIME_OPTIONS.map((time) => (
          <SelectItem key={time} value={time}>
            {time}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes) parts.push(`${minutes} minutes`);
  return parts.join(" ");
}

function describeOvernight(date: Date | undefined, startTime: string, endTime: string) {
  if (!startTime || !endTime) return null;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (end >= start || end >= OVERNIGHT_CUTOFF_MINUTES) return null;
  const duration = formatDuration(end + 24 * 60 - start);
  const endDay = date ? `, ${format(addDays(date, 1), "EEE d MMM yyyy")},` : "";
  return `This event runs for ${duration} and ends the following day${endDay} at ${endTime}.`;
}

function describeTimeOrderError(startTime: string, endTime: string) {
  if (!startTime || !endTime) return undefined;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (end === start) return "End time must be later than the start time.";
  if (end < start && end >= OVERNIGHT_CUTOFF_MINUTES) {
    return "End time must be later than the start time, unless the event runs into the early hours.";
  }
  return undefined;
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
  arrival = null,
}: {
  subtypes: PrivateHireSubtype[];
  minCapacity: number | null;
  maxCapacity: number | null;
  openingHours: OpeningHours | null;
  deposit: number | null;
  arrival?: BookingArrival | null;
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
  const guestCountValue = parseInt(guestCount, 10);
  const [preferredDate, setPreferredDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const todayDate = new Date(today + "T00:00:00");
  const selectedDate = preferredDate ? new Date(preferredDate + "T00:00:00") : undefined;
  const [preferredStartTime, setPreferredStartTime] = useState("");
  const [preferredEndTime, setPreferredEndTime] = useState("");
  const [eventSubtypeId, setEventSubtypeId] = useState("");
  const overnightNote = describeOvernight(selectedDate, preferredStartTime, preferredEndTime);
  const timeOrderError = describeTimeOrderError(preferredStartTime, preferredEndTime);
  const [additionalReqs, setAdditionalReqs] = useState("");
  const [instagram, setInstagram] = useState(arrival?.channel === "instagram" ? (arrival.handle ?? "") : "");
  const [preferredChoice, setPreferredChoice] = useState<MessageChannel | null>(null);
  const preferredOptions = preferredChannelOptions({ email, instagram, arrival });
  const chosenOption = preferredOptions.find((o) => o.channel === preferredChoice);
  const preferredChannel: MessageChannel = chosenOption?.available
    ? chosenOption.channel
    : defaultPreferredChannel(preferredOptions, arrival);
  const preferredDetail = preferredOptions.find((o) => o.channel === preferredChannel)?.detail ?? null;
  const showInstagramField = preferredChoice === "instagram" || arrival?.channel === "instagram" || !!instagram;

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
    if (!phone.trim()) errors.phone = "Please enter your phone number.";
    else if (!isValidPhone(phone)) errors.phone = PHONE_ERROR;
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

    if (timeOrderError) errors.preferredEndTime = timeOrderError;

    if (!errors.preferredEndTime && openClashMessage) errors.slot = openClashMessage;

    if (!eventSubtypeId) errors.eventSubtypeId = "Please select a reason for hire.";

    return errors;
  }

  function stepGuestCount(direction: 1 | -1) {
    const stepped = Number.isNaN(guestCountValue)
      ? minGuests
      : direction > 0
        ? Math.floor(guestCountValue / GUEST_STEP) * GUEST_STEP + GUEST_STEP
        : Math.ceil(guestCountValue / GUEST_STEP) * GUEST_STEP - GUEST_STEP;
    const next = Math.max(minGuests, Math.min(maxCapacity ?? Infinity, stepped));
    setGuestCount(String(next));
    clearFieldError("guestCount");
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
          phone_no: phone,
          guest_count: count,
          preferred_date: preferredDate || undefined,
          preferred_start_time: preferredStartTime || undefined,
          preferred_end_time: preferredEndTime || undefined,
          event_subtypes_id: Number(eventSubtypeId),
          additional_requirements: additionalReqs || undefined,
          preferred_channel: preferredChannel,
          instagram_handle: instagram || undefined,
          source_channel: arrival?.channel ?? null,
          source_channel_id: arrival?.channelId ?? null,
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
                  name="name"
                  autoComplete="name"
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
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
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
                  Phone <span className="text-red-500">*</span>
                </label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <Phone className={iconClass} />
                  </div>
                  <input
                    id="ph-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={24}
                    value={phone}
                    onChange={(e) => {
                      setPhone(cleanPhoneInput(e.target.value));
                      clearFieldError("phone");
                    }}
                    placeholder="+44 7700 000000"
                    aria-invalid={!!fieldErrors.phone}
                    className={inputClass(!!fieldErrors.phone)}
                  />
                </div>
                <FieldError message={fieldErrors.phone} />
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={guestCount}
                    onChange={(e) => {
                      setGuestCount(e.target.value.replace(/\D/g, ""));
                      clearFieldError("guestCount");
                    }}
                    onBlur={handleGuestCountBlur}
                    placeholder={`e.g. ${minGuests}`}
                    aria-invalid={!!fieldErrors.guestCount}
                    className={`${inputClass(!!fieldErrors.guestCount)} ${guestCountInputClass}`}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Fewer guests"
                      disabled={guestCountValue <= minGuests}
                      onClick={() => stepGuestCount(-1)}
                      className={stepperButtonClass}
                    >
                      <Minus />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="More guests"
                      disabled={maxCapacity !== null && guestCountValue >= maxCapacity}
                      onClick={() => stepGuestCount(1)}
                      className={stepperButtonClass}
                    >
                      <Plus />
                    </Button>
                  </div>
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
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <div className="group relative">
                    <div className={iconContainerClass}>
                      <CalendarIcon className={iconClass} />
                    </div>
                    <PopoverTrigger asChild>
                      <button
                        id="ph-date"
                        type="button"
                        aria-describedby={fieldErrors.preferredDate ? "ph-date-error" : undefined}
                        className={`${inputClass(!!fieldErrors.preferredDate)} ${dateTriggerClass}`}
                      >
                        {selectedDate ? (
                          format(selectedDate, "EEE d MMM yyyy")
                        ) : (
                          <span className="text-stone-700">Pick a date</span>
                        )}
                      </button>
                    </PopoverTrigger>
                  </div>
                  <PopoverContent
                    align="start"
                    style={calendarThemeVars}
                    className="w-auto rounded-2xl border-white/10 bg-[#26300D] p-2 text-white shadow-xl"
                  >
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (!date) return;
                        setPreferredDate(format(date, "yyyy-MM-dd"));
                        clearFieldError("preferredDate");
                        setDateOpen(false);
                      }}
                      disabled={{ before: todayDate }}
                      startMonth={startOfMonth(todayDate)}
                      defaultMonth={selectedDate ?? todayDate}
                      autoFocus
                      className="bg-transparent p-1 text-white [--cell-size:2.375rem] sm:[--cell-size:2.5rem]"
                    />
                  </PopoverContent>
                </Popover>
                <FieldError id="ph-date-error" message={fieldErrors.preferredDate} />
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
                  <TimeSelect
                    id="ph-start-time"
                    value={preferredStartTime}
                    onChange={handleStartTimeChange}
                    hasError={!!fieldErrors.preferredStartTime}
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
                  <TimeSelect
                    id="ph-end-time"
                    value={preferredEndTime}
                    onChange={(value) => {
                      setPreferredEndTime(value);
                      clearFieldError("preferredEndTime");
                    }}
                    hasError={!!fieldErrors.preferredEndTime}
                  />
                </div>
                <FieldError
                  message={fieldErrors.preferredEndTime === timeOrderError ? undefined : fieldErrors.preferredEndTime}
                />
              </div>
            </div>
            <FieldError id="ph-time-error" message={timeOrderError} />
            {overnightNote && (
              <p className="ml-1 flex items-start gap-1.5 text-xs leading-relaxed text-ink-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
                <span>{overnightNote}</span>
              </p>
            )}
            <FieldError id="ph-slot-error" message={timeOrderError ? undefined : openClashMessage} />

            <div className="space-y-1">
              <label htmlFor="ph-reason" className={labelClass}>
                Reason for Hire <span className="text-red-500">*</span>
              </label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  <Tag className={iconClass} />
                </div>
                <Select
                  value={eventSubtypeId}
                  onValueChange={(value) => {
                    setEventSubtypeId(value);
                    clearFieldError("eventSubtypeId");
                  }}
                >
                  <SelectTrigger
                    id="ph-reason"
                    aria-invalid={!!fieldErrors.eventSubtypeId}
                    className={`${inputClass(!!fieldErrors.eventSubtypeId)} ${selectTriggerClass}`}
                  >
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {subtypes.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {privateHireSubtypeLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <NotesTextarea
                id="ph-additional"
                icon={<MessageSquareQuote className={iconClass} />}
                value={additionalReqs}
                onChange={(e) => setAdditionalReqs(e.target.value)}
                placeholder="Food, music, decorations, accessibility needs…"
                className={`${inputClass(false)} py-3 placeholder:text-stone-700 focus-visible:border-[#fdcc4b] focus-visible:ring-1 focus-visible:ring-[#fdcc4b]`}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="ph-preferred" className={labelClass}>
                How should we get in touch?
              </label>
              <div className="group relative">
                <div className={iconContainerClass}>
                  {preferredChannel === "instagram" ? (
                    <SiInstagram className={iconClass} />
                  ) : preferredChannel === "messenger" ? (
                    <SiMessenger className={iconClass} />
                  ) : (
                    <Mail className={iconClass} />
                  )}
                </div>
                <Select value={preferredChannel} onValueChange={(v) => setPreferredChoice(v as MessageChannel)}>
                  <SelectTrigger id="ph-preferred" className={`${inputClass(false)} ${selectTriggerClass}`}>
                    <SelectValue>{preferredOptions.find((o) => o.channel === preferredChannel)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {preferredOptions.map((o) => (
                      <SelectItem key={o.channel} value={o.channel} disabled={!o.available}>
                        {o.label}
                        {o.detail ? ` · ${o.detail}` : o.why ? ` · ${o.why}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="ml-1 text-xs leading-relaxed text-ink-2">
                {preferredDetail ? `We'll reply to ${preferredDetail}.` : "Pick where you'd like our replies to go."}
              </p>
            </div>

            {showInstagramField && (
              <div className="space-y-1">
                <label htmlFor="ph-instagram" className={labelClass}>
                  Instagram handle
                </label>
                <div className="group relative">
                  <div className={iconContainerClass}>
                    <SiInstagram className={iconClass} />
                  </div>
                  <input
                    id="ph-instagram"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="yourhandle"
                    autoComplete="off"
                    className={inputClass(false)}
                  />
                </div>
              </div>
            )}
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
            aria-describedby={
              step !== 2 ? undefined : timeOrderError ? "ph-time-error" : openClashMessage ? "ph-slot-error" : undefined
            }
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
