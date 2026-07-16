"use client";

import React, { useState, useEffect } from "react";
import { createBooking, checkTeamName } from "@/app/(public)/_actions/create-booking";
import {
  CheckCircle,
  ChevronRight,
  CalendarDays,
  User,
  Mail,
  Beer,
  Clock,
  Loader2,
  MessageSquareQuote,
  AlertCircle
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/events-display";

interface BookingResponse {
  success: boolean;
  isWaitlisted?: boolean;
  error?: string;
  message?: string;
  data?: unknown;
}

export interface QuizEvent {
  id: number;
  date: string;
  start_time: string | null;
  payment_amount: number | null;
  is_fully_booked: boolean;
}

interface Props {
  events: QuizEvent[];
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Dropdown label: long date, plus the start time when present (disambiguates same-day events). */
function eventOptionLabel(ev: QuizEvent) {
  const time = formatTime(ev.start_time);
  return time ? `${formatEventDate(ev.date)} · ${time}` : formatEventDate(ev.date);
}

export default function BookingForm({ events }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [dateError, setDateError] = useState("");
  const [isCheckingTeam, setIsCheckingTeam] = useState(false);
  const [teamNameError, setTeamNameError] = useState("");

  const [formData, setFormData] = useState({
    quizEventId: String(events[0]?.id ?? ""),
    name: "",
    teamName: "",
    teamSize: "4",
    email: "",
    phone: "",
    specialRequests: "",
  });

  // Resolve the chosen event by id (unique), not by date — two events can share a date.
  const selectedEvent =
    events.find((e) => String(e.id) === formData.quizEventId) ?? events[0];
  const selectedDate = selectedEvent?.date ?? "";
  const fullyBooked = selectedEvent?.is_fully_booked ?? false;

  useEffect(() => {
    const validateTeam = async () => {
      if (formData.teamName.trim().length < 2) {
        setTeamNameError("");
        return;
      }

      setIsCheckingTeam(true);
      try {
        const { isAvailable } = await checkTeamName(formData.teamName, selectedDate);
        if (!isAvailable) {
          setTeamNameError("This team name is already taken for the selected date.");
        } else {
          setTeamNameError("");
        }
      } catch (err) {
        console.error("Validation error:", err);
      } finally {
        setIsCheckingTeam(false);
      }
    };

    const timer = setTimeout(validateTeam, 500);
    return () => clearTimeout(timer);
  }, [formData.teamName, selectedDate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (teamNameError) return;

    if (!formData.quizEventId) {
      setDateError("Please select a date.");
      return;
    }

    setIsSubmitting(true);
    setDateError("");

    try {
      const response: BookingResponse = await createBooking({
        event_id: Number(formData.quizEventId),
        name: formData.name,
        team_name: formData.teamName,
        team_size: parseInt(formData.teamSize, 10),
        email: formData.email,
        phone: formData.phone,
        special_requests: formData.specialRequests,
      });

      if (response.success) {
        setIsSuccess(true);
        if (response.isWaitlisted) {
          setIsWaitlisted(true);
        }
      } else {
        setDateError(response.error || response.message || "Failed to make reservation. Please try again.");
      }
    } catch (error) {
      console.error("Booking submission error:", error);
      setDateError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="animate-in py-4 text-center duration-300 fade-in zoom-in">
        <div className="mb-6 flex justify-center">
          <div className={`rounded-full p-4 ${isWaitlisted ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
            {isWaitlisted ? <Clock className="h-10 w-10 text-amber-500" /> : <CheckCircle className="h-10 w-10 text-emerald-500" />}
          </div>
        </div>
        <h2 className="mb-2 font-black text-2xl tracking-tight text-white uppercase">
          {isWaitlisted ? "On the Waitlist" : "You're Locked In!"}
        </h2>
        <p className="mx-auto mb-8 max-w-xs text-xs leading-relaxed text-stone-400 sm:text-sm">
          {isWaitlisted
            ? `We're full for ${formatEventDate(selectedDate)}, but you're next in line. Check your email for details.`
            : `Great news! Team "${formData.teamName}" is booked for ${formatEventDate(selectedDate)}. Check your email for your unique link.`
          }
        </p>
        <Button
          onClick={() => {
            setIsSuccess(false);
            setIsWaitlisted(false);
            setFormData({
              quizEventId: String(events[0]?.id ?? ""),
              name: "",
              teamName: "",
              teamSize: "4",
              email: "",
              phone: "",
              specialRequests: ""
            });
          }}
          className="h-14 w-full rounded-2xl bg-white font-black tracking-widest text-[#26300D] uppercase shadow-lg transition-all hover:bg-stone-200"
        >
          Book Another Table
        </Button>
      </div>
    );
  }

  if (fullyBooked) {
    return (
      <div className="animate-in py-4 text-center duration-300 fade-in zoom-in">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-500/20 p-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>
        <h2 className="mb-2 font-black text-2xl tracking-tight text-white uppercase">
          Fully Booked
        </h2>
        <p className="mx-auto mb-8 max-w-xs text-xs leading-relaxed text-stone-400 sm:text-sm">
          Sorry, we are fully booked for {formatEventDate(selectedDate)}. Please keep an eye on our Instagram page{' '}
          <a
            href="https://www.instagram.com/donfenticas"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); window.open('https://www.instagram.com/donfenticas', '_blank') }}
            className="font-black text-[#fdcc4b] hover:underline"
          >
            @donfenticas
          </a>
          {' '}for updates.
        </p>
        {events.filter(e => !e.is_fully_booked).length > 0 && (
          <Button
            onClick={() => {
              const available = events.find(e => !e.is_fully_booked);
              if (available) setFormData(prev => ({ ...prev, quizEventId: String(available.id) }));
            }}
            className="h-14 w-full rounded-2xl bg-white font-black tracking-widest text-[#26300D] uppercase shadow-lg transition-all hover:bg-stone-200"
          >
            Try Another Date
          </Button>
        )}
      </div>
    );
  }

  const inputBaseClasses = "w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-stone-700 focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all duration-300 text-sm font-bold";
  const labelClasses = "block text-[10px] font-black text-stone-500 mb-2 uppercase tracking-[0.15em] ml-1";
  const iconContainerClasses = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
  const iconClasses = "w-4 h-4 text-stone-600 transition-colors duration-200 group-focus-within:text-[#fdcc4b]";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      {/* Date and Size Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <div className="space-y-1">
          <label htmlFor="quizDate" className={labelClasses}>
            Select Date <span className="text-red-500">*</span>
          </label>
          <div className="group relative">
            <div className={iconContainerClasses}>
              <CalendarDays className={iconClasses} />
            </div>
            <select
              id="quizDate"
              name="quizEventId"
              value={formData.quizEventId}
              onChange={handleInputChange}
              required
              className={cn(inputBaseClasses, "cursor-pointer appearance-none pr-10")}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {eventOptionLabel(ev)}
                </option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-stone-600" />
          </div>
          {dateError && <p className="mt-1 ml-1 font-black text-[10px] text-red-500 uppercase">{dateError}</p>}
        </div>

        <div className="space-y-1">
          <label className={labelClasses}>
            Team Size
          </label>
          <RadioGroup
            value={formData.teamSize}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, teamSize: value }))}
            className="flex gap-2"
          >
            {[4, 5, 6].map((num) => (
              <label
                key={num}
                className={`flex h-14 flex-1 cursor-pointer items-center justify-center rounded-2xl border-2 font-black text-sm transition-all ${formData.teamSize === num.toString() ? "scale-[1.02] border-[#fdcc4b] bg-[#fdcc4b] text-[#26300D] shadow-lg" : "border-white/10 bg-black/40 text-stone-500 hover:border-white/30"}`}
              >
                <RadioGroupItem value={num.toString()} className="sr-only" />
                {num}
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Names Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <div className="space-y-1">
          <label htmlFor="name" className={labelClasses}>
            Your Name <span className="text-red-500">*</span>
          </label>
          <div className="group relative">
            <div className={iconContainerClasses}>
              <User className={iconClasses} />
            </div>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleInputChange}
              className={inputBaseClasses}
              placeholder="e.g. John Doe"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="teamName" className={labelClasses}>
            Team Name <span className="text-red-500">*</span>
          </label>
          <div className="group relative">
            <div className={iconContainerClasses}>
              <Beer className={iconClasses} />
            </div>
            <input
              type="text"
              id="teamName"
              name="teamName"
              required
              value={formData.teamName}
              onChange={handleInputChange}
              className={cn(inputBaseClasses, teamNameError && "border-red-500/50")}
              placeholder="e.g. Quizzy McQuizface"
            />
            {isCheckingTeam && <div className="absolute top-1/2 right-4 -translate-y-1/2"><Loader2 className="h-3 w-3 animate-spin text-[#fdcc4b]" /></div>}
          </div>
          {teamNameError && <p className="mt-1.5 ml-1 font-black text-[9px] text-red-500 uppercase">{teamNameError}</p>}
        </div>
      </div>

      <div className="space-y-1">
          <label htmlFor="email" className={labelClasses}>
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="group relative">
            <div className={iconContainerClasses}>
              <Mail className={iconClasses} />
            </div>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className={inputBaseClasses}
              placeholder="e.g. john@example.com"
            />
          </div>
        </div>

      {/* Special Requests Field */}
      <div className="space-y-1">
        <label htmlFor="specialRequests" className={labelClasses}>
          Additional Requests (Optional)
        </label>
        <div className="group relative">
          <div className={iconContainerClasses}>
            <MessageSquareQuote className={iconClasses} />
          </div>
          <textarea
            id="specialRequests"
            name="specialRequests"
            value={formData.specialRequests}
            onChange={handleInputChange}
            className={`${inputBaseClasses} min-h-25 resize-none py-3 text-sm`}
            placeholder="Dietary requirements, table preference..."
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !!teamNameError}
          className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#fdcc4b] font-black text-lg tracking-widest text-[#26300D] uppercase shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] transition-all hover:bg-[#e5b843] active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="flex items-center">Confirm Booking <ChevronRight className="ml-2 h-6 w-6" /></span>}
        </button>
        <p className="mt-6 px-4 text-center text-[9px] font-bold tracking-[0.2em] text-stone-600 uppercase opacity-60">
          By booking, you agree to show up or cancel at least 24 hours in advance.
        </p>
      </div>
    </form>
  );
}
