"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createBooking, checkTeamName } from "../_actions/create-booking";
import {
  CheckCircle,
  ChevronRight,
  CalendarDays,
  User,
  Mail,
  Beer,
  Clock,
  Loader2,
  MessageSquareQuote
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingResponse {
  success: boolean;
  isWaitlisted?: boolean;
  error?: string;
  message?: string;
  data?: unknown;
}

const getNextThursday = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // 4 represents Thursday (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  const nextThursday = new Date(today);
  nextThursday.setDate(today.getDate() + (daysUntilThursday === 0 ? 0 : daysUntilThursday));
  return nextThursday.toISOString().split("T")[0];
};

export default function BookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [dateError, setDateError] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCheckingTeam, setIsCheckingTeam] = useState(false);
  const [teamNameError, setTeamNameError] = useState("");

  const [formData, setFormData] = useState({
    quizDate: getNextThursday(),
    name: "",
    teamName: "",
    teamSize: "4",
    email: "",
    phone: "",
    specialRequests: "", // New state field
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (teamNameError) return;

    if (!formData.quizDate) {
      setDateError("Please select a valid Thursday.");
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
        special_requests: formData.specialRequests, // Passed to server
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
      setDateError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-6 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-full ${isWaitlisted ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
            {isWaitlisted ? <Clock className="w-12 h-12 text-amber-500" /> : <CheckCircle className="w-12 h-12 text-emerald-500" />}
          </div>
        </div>        
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
          {isWaitlisted ? "On the Waitlist" : "You're Locked In!"}
        </h2>
        <p className="text-stone-400 mb-8 text-sm leading-relaxed max-w-xs mx-auto">
          {isWaitlisted 
            ? `We're full for ${format(new Date(formData.quizDate), "do MMMM")}, but you're next in line.`
            : `Confirmation sent to ${formData.email}. See you on the ${format(new Date(formData.quizDate), "do MMMM")}!`
          }
        </p>        
        <Button
          onClick={() => {
            setIsSuccess(false);
            setIsWaitlisted(false);
            setFormData({ quizDate: getNextThursday(), name: "", teamName: "", teamSize: "4", email: "", phone: "", specialRequests: "" });
          }}
          className="w-full bg-white text-[#26300D] font-bold py-4 rounded-xl uppercase tracking-widest hover:bg-stone-200 transition-all shadow-lg"
        >
          Book Another Table
        </Button>
      </div>
    );
  }

  const inputBaseClasses = "w-full bg-black/30 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-stone-600 focus:outline-none focus:border-[#fdcc4b]/50 focus:ring-1 focus:ring-[#fdcc4b]/50 transition-all duration-200";
  const labelClasses = "block text-[10px] font-black text-stone-400 mb-1.5 uppercase tracking-[0.15em] ml-1";
  const iconContainerClasses = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
  const iconClasses = "w-4 h-4 text-stone-500 transition-colors duration-200 peer-focus:text-[#fdcc4b]";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Date and Size Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1">
          <label htmlFor="quizDate" className={labelClasses}>
            Date <span className="text-red-400">*</span>
          </label>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`relative ${inputBaseClasses} text-left text-sm group ${!formData.quizDate ? "text-stone-500" : ""}`}
              >
                <div className={iconContainerClasses}>
                  <CalendarDays className={iconClasses} />
                </div>
                {formData.quizDate ? (
                  format(new Date(formData.quizDate), "dd MMMM yyyy")
                ) : (
                  <span>Select a Thursday</span>
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0 bg-[#1e260a] border-white/10 shadow-2xl rounded-2xl overflow-hidden" align="start">
              <Calendar
                mode="single"
                selected={formData.quizDate ? new Date(formData.quizDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    const dateString = date.toISOString().split("T")[0];
                    setFormData((prev) => ({ ...prev, quizDate: dateString }));
                    setDateError("");
                    setIsCalendarOpen(false);
                  }
                }}
                disabled={(date) =>
                  date.getDay() !== 4 || date < new Date(new Date().setHours(0, 0, 0, 0))
                }
                autoFocus
                className="text-white bg-[#1e260a]"
              />
            </PopoverContent>
          </Popover>
          {dateError && <p className="text-red-400 text-[10px] font-bold mt-1 ml-1">{dateError}</p>}
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
                className={`flex-1 cursor-pointer rounded-xl border py-3 text-center text-sm font-bold transition-all ${formData.teamSize === num.toString() ? "bg-[#fdcc4b] border-[#fdcc4b] text-[#26300D] shadow-md" : "bg-black/30 border-white/10 text-stone-400 hover:border-white/30"}`}
              >
                <RadioGroupItem value={num.toString()} className="sr-only" />
                {num}
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Names Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1">
          <label htmlFor="name" className={labelClasses}>
            Your Name <span className="text-red-400">*</span>
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
              className={`${inputBaseClasses} peer text-sm`}
              placeholder="John Doe"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="teamName" className={labelClasses}>
            Team Name <span className="text-red-400">*</span>
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
              className={`${inputBaseClasses} peer text-sm ${teamNameError ? 'border-red-500/40' : ''}`}
              placeholder="Quizzy McQuizface"
            />
            {isCheckingTeam && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-3 h-3 text-[#fdcc4b] animate-spin" /></div>}
          </div>
          {teamNameError && <p className="text-red-400 text-[9px] font-bold uppercase mt-1 ml-1">{teamNameError}</p>}
        </div>
      </div>

      <div className="space-y-1">
          <label htmlFor="email" className={labelClasses}>
            Email <span className="text-red-400">*</span>
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
              className={`${inputBaseClasses} peer text-sm`}
              placeholder="john@example.com"
            />
          </div>
        </div>

      {/* Special Requests Field */}
      <div className="space-y-1">
        <label htmlFor="specialRequests" className={labelClasses}>
          Special Requests
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
            placeholder="e.g. Dietary requirements, table preference..."
          />
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting || !!teamNameError}
          className="w-full flex items-center justify-center py-4 px-6 rounded-xl bg-[#fdcc4b] hover:bg-[#e5b843] text-[#26300D] font-black text-base uppercase tracking-widest transition-all shadow-[0_10px_25px_-5px_rgba(253,204,75,0.4)] active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span className="flex items-center">Confirm Booking <ChevronRight className="ml-2 w-5 h-5" /></span>}
        </button>
        <p className="text-center text-stone-500 text-[9px] mt-5 uppercase tracking-[0.2em] font-medium">
          By booking, you agree to show up or cancel at least 24 hours in advance.
        </p>
      </div>
    </form>
  );
}
