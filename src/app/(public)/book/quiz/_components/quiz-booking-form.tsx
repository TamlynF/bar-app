"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// Using absolute aliases which are defined in tsconfig.json and verified to work for other imports
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
  MessageSquareQuote
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BookingResponse {
  success: boolean;
  isWaitlisted?: boolean;
  error?: string;
  message?: string;
  data?: unknown;
}

/**
 * Helper to get the next upcoming Thursday as a Date object at local midnight.
 */
const getNextThursdayDate = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // 4 represents Thursday (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  const nextThursday = new Date(today);
  // Ensure we get the local day correctly
  nextThursday.setDate(today.getDate() + (daysUntilThursday === 0 ? 0 : daysUntilThursday));
  nextThursday.setHours(0, 0, 0, 0);
  return nextThursday;
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
    // Initialize with local-formatted string
    quizDate: format(getNextThursdayDate(), "yyyy-MM-dd"),
    name: "",
    teamName: "",
    teamSize: "4",
    email: "",
    phone: "",
    specialRequests: "",
  });

  // Calculate the specific date object for the next Thursday to use as a modifier
  const nextThursdayDate = useMemo(() => getNextThursdayDate(), []);

  // Helper to convert "yyyy-MM-dd" back to a local Date object without UTC shifting
  const getSelectedDateObj = (dateStr: string) => {
    if (!dateStr) return undefined;
    // Appending time ensures the Date constructor treats it as local time
    return new Date(dateStr + "T00:00:00");
  };

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
    const displayDate = getSelectedDateObj(formData.quizDate);
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
            ? `We're full for ${displayDate ? format(displayDate, "do MMMM") : "that date"}, but you're next in line. Check your email for details.`
            : `Great news! Team "${formData.teamName}" is booked for ${displayDate ? format(displayDate, "do MMMM") : "that date"}. Check your email for your unique link.`
          }
        </p>        
        <Button
          onClick={() => {
            setIsSuccess(false);
            setIsWaitlisted(false);
            setFormData({ 
              quizDate: format(getNextThursdayDate(), "yyyy-MM-dd"), 
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

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`relative ${inputBaseClasses} text-left group ${!formData.quizDate ? "text-stone-600" : ""}`}
              >
                <div className={iconContainerClasses}>
                  <CalendarDays className={iconClasses} />
                </div>
                {formData.quizDate ? (
                  format(getSelectedDateObj(formData.quizDate)!, "dd MMMM yyyy")
                ) : (
                  <span>Select a Thursday</span>
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent 
              className="w-auto p-0 border-white/10 shadow-2xl rounded-2xl overflow-hidden z-100"
              align="start"
            >
              <Calendar
                mode="single"
                selected={getSelectedDateObj(formData.quizDate)}
                defaultMonth={getSelectedDateObj(formData.quizDate)}
                onSelect={(date) => {
                  if (date) {
                    // Use local format to prevent UTC day-shifting
                    const dateString = format(date, "yyyy-MM-dd");
                    setFormData((prev) => ({ ...prev, quizDate: dateString }));
                    setDateError("");
                    setIsCalendarOpen(false);
                  }
                }}
                disabled={(date) =>
                  date.getDay() !== 4 || date < new Date(new Date().setHours(0, 0, 0, 0))
                }
                autoFocus
                className="bg-transparent"
                classNames={{
                  // Brand styles for month header and arrows
                  caption_label: "text-[#26300D] font-black uppercase tracking-widest text-[11px]",
                  button_previous: "text-[#26300D] hover:bg-[#26300D]/10",
                  button_next: "text-[#26300D] hover:bg-[#26300D]/10",
                  // Weekday alignment fix: ensure they span full width
                  weekday: "text-[#26300D]/50 font-black uppercase text-[10px] tracking-tighter flex-1 text-center",
                  week: "flex w-full mt-2",
                  // Date cell alignment and styling
                  day: "text-[#26300D] font-bold text-sm h-9 w-9 p-0 aria-selected:opacity-100 flex items-center justify-center aspect-square mx-auto rounded-xl transition-colors",
                }}
                modifiers={{
                  nextThursday: nextThursdayDate
                }}
                modifiersClassNames={{
                  // Next Thursday: Yellow bg + dark green border
                  nextThursday: "bg-[#FDCC4B]! text-[#26300D]! border-2! border-[#26300D]! font-black shadow-sm"
                }}
              />
            </PopoverContent>
          </Popover>
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
