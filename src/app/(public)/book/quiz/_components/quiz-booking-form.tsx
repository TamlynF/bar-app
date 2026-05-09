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

export default function BookingForm({ events }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [dateError, setDateError] = useState("");
  const [isCheckingTeam, setIsCheckingTeam] = useState(false);
  const [teamNameError, setTeamNameError] = useState("");

  const [formData, setFormData] = useState({
    quizDate: events[0]?.date ?? "",
    name: "",
    teamName: "",
    teamSize: "4",
    email: "",
    phone: "",
    specialRequests: "",
  });

  useEffect(() => {
    const validateTeam = async () => {
      if (formData.teamName.trim().length < 2) {
        setTeamNameError("");
        return;
      }

      setIsCheckingTeam(true);
      try {
        const { isAvailable } = await checkTeamName(formData.teamName, formData.quizDate);
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
  }, [formData.teamName, formData.quizDate]);

  // Check fully booked from event data
  const selectedEvent = events.find((e) => e.date === formData.quizDate);
  const fullyBooked = selectedEvent?.is_fully_booked ?? false;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (teamNameError) return;

    if (!formData.quizDate) {
      setDateError("Please select a date.");
      return;
    }

    setIsSubmitting(true);
    setDateError("");

    try {
      const response: BookingResponse = await createBooking({
        quiz_date: formData.quizDate,
        name: formData.name,
        team_name: formData.teamName,
        team_size: parseInt(formData.teamSize, 10),
        email: formData.email,
        phone: formData.phone,
        special_requests: formData.specialRequests,
      }, "games", "quiz");

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
      <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-full ${isWaitlisted ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
            {isWaitlisted ? <Clock className="w-10 h-10 text-amber-500" /> : <CheckCircle className="w-10 h-10 text-emerald-500" />}
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
          {isWaitlisted ? "On the Waitlist" : "You're Locked In!"}
        </h2>
        <p className="text-stone-400 mb-8 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
          {isWaitlisted
            ? `We're full for ${formatEventDate(formData.quizDate)}, but you're next in line. Check your email for details.`
            : `Great news! Team "${formData.teamName}" is booked for ${formatEventDate(formData.quizDate)}. Check your email for your unique link.`
          }
        </p>
        <Button
          onClick={() => {
            setIsSuccess(false);
            setIsWaitlisted(false);
            setFormData({
              quizDate: events[0]?.date ?? "",
              name: "",
              teamName: "",
              teamSize: "4",
              email: "",
              phone: "",
              specialRequests: ""
            });
          }}
          className="w-full bg-white text-[#26300D] font-black h-14 rounded-2xl uppercase tracking-widest hover:bg-stone-200 transition-all shadow-lg"
        >
          Book Another Table
        </Button>
      </div>
    );
  }

  if (fullyBooked) {
    return (
      <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
          Fully Booked
        </h2>
        <p className="text-stone-400 mb-8 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
          Sorry, we are fully booked for {formatEventDate(formData.quizDate)}. Please keep an eye on our Instagram page{' '}
          <a
            href="https://www.instagram.com/donfenticas"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); window.open('https://www.instagram.com/donfenticas', '_blank') }}
            className="text-[#fdcc4b] font-black hover:underline"
          >
            @donfenticas
          </a>
          {' '}for updates.
        </p>
        {events.filter(e => !e.is_fully_booked).length > 0 && (
          <Button
            onClick={() => {
              const available = events.find(e => !e.is_fully_booked);
              if (available) setFormData(prev => ({ ...prev, quizDate: available.date }));
            }}
            className="w-full bg-white text-[#26300D] font-black h-14 rounded-2xl uppercase tracking-widest hover:bg-stone-200 transition-all shadow-lg"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-1">
          <label htmlFor="quizDate" className={labelClasses}>
            Select Date <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
            <div className={iconContainerClasses}>
              <CalendarDays className={iconClasses} />
            </div>
            <select
              id="quizDate"
              name="quizDate"
              value={formData.quizDate}
              onChange={handleInputChange}
              required
              className={cn(inputBaseClasses, "appearance-none pr-10 cursor-pointer")}
            >
              {events.map((ev) => (
                <option key={ev.date} value={ev.date}>
                  {formatEventDate(ev.date)}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 rotate-90 pointer-events-none" />
          </div>
          {dateError && <p className="text-red-500 text-[10px] font-black uppercase mt-1 ml-1">{dateError}</p>}
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
                className={`flex-1 cursor-pointer rounded-2xl border-2 h-14 flex items-center justify-center text-sm font-black transition-all ${formData.teamSize === num.toString() ? "bg-[#fdcc4b] border-[#fdcc4b] text-[#26300D] scale-[1.02] shadow-lg" : "bg-black/40 border-white/10 text-stone-500 hover:border-white/30"}`}
              >
                <RadioGroupItem value={num.toString()} className="sr-only" />
                {num}
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Names Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-1">
          <label htmlFor="name" className={labelClasses}>
            Your Name <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
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
          <div className="relative group">
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
            {isCheckingTeam && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-3 h-3 text-[#fdcc4b] animate-spin" /></div>}
          </div>
          {teamNameError && <p className="text-red-500 text-[9px] font-black uppercase mt-1.5 ml-1">{teamNameError}</p>}
        </div>
      </div>

      <div className="space-y-1">
          <label htmlFor="email" className={labelClasses}>
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
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
        <div className="relative group">
          <div className={iconContainerClasses}>
            <MessageSquareQuote className={iconClasses} />
          </div>
          <textarea
            id="specialRequests"
            name="specialRequests"
            value={formData.specialRequests}
            onChange={handleInputChange}
            className={`${inputBaseClasses} min-h-[100px] py-3 text-sm resize-none`}
            placeholder="Dietary requirements, table preference..."
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !!teamNameError}
          className="w-full flex items-center justify-center h-16 rounded-2xl bg-[#fdcc4b] hover:bg-[#e5b843] text-[#26300D] font-black text-lg uppercase tracking-widest transition-all shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span className="flex items-center">Confirm Booking <ChevronRight className="ml-2 w-6 h-6" /></span>}
        </button>
        <p className="text-center text-stone-600 text-[9px] mt-6 uppercase tracking-[0.2em] font-bold opacity-60 px-4">
          By booking, you agree to show up or cancel at least 24 hours in advance.
        </p>
      </div>
    </form>
  );
}
