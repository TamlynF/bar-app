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
  AlertCircle,
  Loader2
} from "lucide-react";

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



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (teamNameError) return; // Don't submit if name is taken

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
      <div className={`text-center py-10 animate-in fade-in zoom-in duration-300 bg-black/20 rounded-2xl border p-8 ${isWaitlisted ? 'border-amber-500/20' : 'border-[#fdcc4b]/10'}`}>
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className={`absolute inset-0 blur-xl opacity-20 rounded-full ${isWaitlisted ? 'bg-amber-500' : 'bg-[#fdcc4b]'}`}></div>
            {isWaitlisted ? (
              <Clock className="w-20 h-20 text-amber-500 relative z-10" />
            ) : (
              <CheckCircle className="w-20 h-20 text-[#fdcc4b] relative z-10" />
            )}
          </div>
        </div>
        
        <h2 className="text-3xl font-black text-white mb-2 tracking-wide uppercase">
          {isWaitlisted ? "You're on the waitlist!" : "You're Locked In!"}
        </h2>
        
        <p className="text-[#fdcc4b]/80 mb-8 text-base max-w-sm mx-auto">
          {isWaitlisted ? (
            <>
              All tables are currently taken for {format(new Date(formData.quizDate), "do MMMM yyyy")}. You have been added to the waitlist for <strong className="text-white">{formData.teamName || formData.name}&apos;s Team</strong>. We will notify <span className="text-white">{formData.email}</span> if a table becomes available.
            </>
          ) : (
            <>
              Table reserved for <strong className="text-white">{formData.teamName || formData.name}&apos;s Team</strong> on {format(new Date(formData.quizDate), "do MMMM yyyy")}. Confirmation sent to <span className="text-white">{formData.email}</span>.
            </>
          )}
        </p>
        
        <button
          onClick={() => {
            setIsSuccess(false);
            setIsWaitlisted(false);
            setFormData({ quizDate: getNextThursday(), name: "", teamName: "", teamSize: "4", email: "", phone: "" });
          }}
          className={`font-black py-4 px-8 rounded-xl transition-all duration-200 hover:-translate-y-1 w-full sm:w-auto uppercase tracking-wider text-[#26300D] ${
            isWaitlisted 
            ? "bg-amber-500 hover:bg-amber-400 hover:shadow-[0_10px_20px_rgba(245,158,11,0.3)]" 
            : "bg-[#fdcc4b] hover:bg-[#e5b843] hover:shadow-[0_10px_20px_rgba(253,204,75,0.3)]"
          }`}
        >
          Book Another Table
        </button>
      </div>
    );
  }

  const inputBaseClasses = "w-full bg-black/40 border border-[#fdcc4b]/20 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] focus:scale-[1.01] transition-all duration-200 hover:border-[#fdcc4b]/40";
  const labelClasses = "block text-xs font-bold text-[#fdcc4b]/90 mb-2 uppercase tracking-wider ml-1";
  const iconContainerClasses = "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none";
  const iconClasses = "w-5 h-5 text-[#fdcc4b]/60 transition-colors duration-200 peer-focus:text-[#fdcc4b]";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Date and Size Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-5">
        <div>
          <label htmlFor="quizDate" className={labelClasses}>
            Date <span className="text-red-400">*</span>
          </label>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`relative w-full text-left bg-black/40 border border-[#fdcc4b]/20 rounded-xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] focus:scale-[1.01] transition-all duration-200 hover:border-[#fdcc4b]/40 group ${!formData.quizDate ? "text-white/60" : ""}`}
              >
                <div className={iconContainerClasses}>
                  <CalendarDays className="w-5 h-5 text-[#fdcc4b]/60 transition-colors duration-200 group-focus:text-[#fdcc4b]" />
                </div>
                {formData.quizDate ? (
                  format(new Date(formData.quizDate), "dd MMMM yyyy")
                ) : (
                  <span>Select a Thursday</span>
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0 bg-[#3d3d17] border-[#fdcc4b]/60 text-white shadow-2xl rounded-xl" align="start">
              <Calendar
                mode="single"
                selected={formData.quizDate ? new Date(formData.quizDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    // Convert back to YYYY-MM-DD string
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
                className="bg-[#887d1a]/40 text-white rounded-xl"
              />
            </PopoverContent>
          </Popover>

          {dateError && <p className="text-red-400 text-xs mt-2 font-medium ml-1 animate-in fade-in">{dateError}</p>}
        </div>

        <div>
          <label className={labelClasses}>
            Team Size
          </label>
          {/* Replaced Select with Touch-Friendly Radio Buttons */}
          <RadioGroup
            value={formData.teamSize}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, teamSize: value }))}
            className="flex gap-2 w-full"
          >
            {[4, 5, 6].map((num) => (
              <label
                key={num}
                className={`flex-1 cursor-pointer rounded-xl border py-3.5 text-center text-sm font-bold transition-all duration-200 select-none ${
                  formData.teamSize === num.toString()
                    ? "bg-[#fdcc4b] border-[#fdcc4b] text-[#26300D] shadow-[0_0_15px_rgba(253,204,75,0.2)] scale-[1.02]"
                    : "bg-black/40 border-[#fdcc4b]/20 text-white/70 hover:border-[#fdcc4b]/50 hover:text-white hover:bg-black/60"
                }`}
              >
                <RadioGroupItem value={num.toString()} className="sr-only" />
                {num}
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Names Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-5">
        <div>
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
              className={`${inputBaseClasses} peer`}
              placeholder="John Doe"
            />
          </div>
        </div>

        <div>
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
              className={`${inputBaseClasses} peer ${teamNameError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              placeholder="Quizzy McQuizface"
            />
          
          {/* Real-time status indicators */}
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              {isCheckingTeam && <Loader2 className="w-4 h-4 text-[#fdcc4b] animate-spin" />}
              {!isCheckingTeam && teamNameError && <AlertCircle className="w-4 h-4 text-red-400" />}
          </div>
          </div>
          {teamNameError && (
            <p className="text-red-400 text-[10px] mt-1.5 font-bold uppercase tracking-tight ml-1 animate-in slide-in-from-top-1">
              {teamNameError}
            </p>
          )}
        </div>
      </div>

      {/* Contact Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-5">
        <div>
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
              className={`${inputBaseClasses} peer`}
              placeholder="john@example.com"
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting || !!teamNameError}
          className={`relative overflow-hidden w-full flex items-center justify-center py-4 px-4 rounded-xl text-[#26300D] font-black text-lg uppercase tracking-widest transition-all duration-300 ${(isSubmitting || !!teamNameError)
            ? "bg-[#fdcc4b]/50 cursor-not-allowed"
            : "bg-[#fdcc4b] hover:bg-[#e5b843] shadow-[0_0_20px_rgba(253,204,75,0.15)] hover:shadow-[0_5px_25px_rgba(253,204,75,0.35)] hover:-translate-y-1"
            }`}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center">
              Confirm Reservation <ChevronRight className="ml-1 w-6 h-6" />
            </span>
          )}
        </button>
        <p className="text-center text-[#fdcc4b]/50 text-xs mt-4">
          By booking, you agree to show up or cancel at least 24 hours in advance.
        </p>
      </div>
    </form>
  );
}
