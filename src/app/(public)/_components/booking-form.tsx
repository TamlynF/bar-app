"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  ChevronRight,
  CalendarDays,
  User,
  Users,
  Mail,
  Phone,
  Beer,
  ChevronDown
} from "lucide-react";

export default function BookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [dateError, setDateError] = useState("");
  const [minDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [formData, setFormData] = useState({
    quizDate: "",
    name: "",
    teamName: "",
    teamSize: "4",
    email: "",
    phone: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (!val) {
      setFormData((prev) => ({ ...prev, quizDate: "" }));
      setDateError("");
      return;
    }

    // Check if the selected date is a Thursday
    // getUTCDay() returns 0 for Sunday, 1 for Monday... 4 for Thursday
    const selectedDate = new Date(val);
    if (selectedDate.getUTCDay() !== 4) {
      setDateError("Quiz nights are only on Thursdays.");
      setFormData((prev) => ({ ...prev, quizDate: "" }));
    } else {
      setDateError("");
      setFormData((prev) => ({ ...prev, quizDate: val }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.quizDate) {
      setDateError("Please select a valid Thursday.");
      return;
    }

    setIsSubmitting(true);

    // --- SUPABASE INTEGRATION POINT ---
    // You will put your Supabase .insert() code here later!

    // Simulating a network delay for the booking
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1500);
  };

  if (isSuccess) {
    return (
      <div className="text-center py-10 animate-in fade-in zoom-in duration-300 bg-black/20 rounded-2xl border border-[#fdcc4b]/10 p-8">
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className="absolute inset-0 bg-[#fdcc4b] blur-xl opacity-20 rounded-full"></div>
            <CheckCircle className="w-20 h-20 text-[#fdcc4b] relative z-10" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-white mb-2 tracking-wide uppercase">You&apos;re Locked In!</h2>
        <p className="text-[#fdcc4b]/80 mb-8 text-base max-w-sm mx-auto">
          Table reserved for <strong className="text-white">{formData.teamName || formData.name}&apos;s Team</strong> on {formData.quizDate}. Confirmation sent to <span className="text-white">{formData.email}</span>.
        </p>
        <button
          onClick={() => {
            setIsSuccess(false);
            setFormData({ quizDate: "", name: "", teamName: "", teamSize: "4", email: "", phone: "" });
          }}
          className="bg-[#fdcc4b] hover:bg-[#e5b843] text-[#26300D] font-black py-4 px-8 rounded-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(253,204,75,0.3)] w-full sm:w-auto uppercase tracking-wider"
        >
          Book Another Table
        </button>
      </div>
    );
  }

  // Consistent, premium input styling
  const inputBaseClasses = "w-full bg-black/40 border border-[#fdcc4b]/20 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all duration-200 hover:border-[#fdcc4b]/40";
  const labelClasses = "block text-xs font-bold text-[#fdcc4b]/90 mb-2 uppercase tracking-wider ml-1";
  const iconContainerClasses = "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none";
  const iconClasses = "w-5 h-5 text-[#fdcc4b]/60 transition-colors duration-200 peer-focus:text-[#fdcc4b]";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Date and Size Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="quizDate" className={labelClasses}>
            Date <span className="text-red-400">*</span>
          </label>
          <div className="relative group">
            <div className={iconContainerClasses}>
              <CalendarDays className={iconClasses} />
            </div>
            <input
              type="date"
              id="quizDate"
              name="quizDate"
              required
              min={minDate}
              suppressHydrationWarning
              value={formData.quizDate}
              onChange={handleDateChange}
              className={`${inputBaseClasses} scheme-dark peer`}
            />
          </div>
          {dateError && <p className="text-red-400 text-xs mt-2 font-medium ml-1 animate-in fade-in">{dateError}</p>}
        </div>

        <div>
          <label htmlFor="teamSize" className={labelClasses}>
            Team Size
          </label>
          <div className="relative group">
            <div className={iconContainerClasses}>
              <Users className={iconClasses} />
            </div>
            <select
              id="teamSize"
              name="teamSize"
              value={formData.teamSize}
              onChange={handleInputChange}
              className={`${inputBaseClasses} pr-10 appearance-none cursor-pointer peer`}
            >
              {[4, 5, 6].map((num) => (
                <option key={num} value={num} className="bg-[#26300D] text-white py-2">
                  {num} {num === 1 ? "Person" : "People"}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <ChevronDown className="w-5 h-5 text-[#fdcc4b]/60 group-hover:text-[#fdcc4b] transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* Names Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
          <label htmlFor="teamName" className="flex items-center text-xs font-bold text-[#fdcc4b]/90 mb-2 uppercase tracking-wider ml-1">
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
              className={`${inputBaseClasses} peer`}
              placeholder="Quizzy McQuizface"
            />
          </div>
        </div>
      </div>

      {/* Contact Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
          disabled={isSubmitting}
          className={`relative overflow-hidden w-full flex items-center justify-center py-4 px-4 rounded-xl text-[#26300D] font-black text-lg uppercase tracking-widest transition-all duration-300 ${isSubmitting
              ? "bg-[#fdcc4b]/50 cursor-not-allowed"
              : "bg-[#fdcc4b] hover:bg-[#e5b843] shadow-[0_0_20px_rgba(253,204,75,0.15)] hover:shadow-[0_5px_25px_rgba(253,204,75,0.35)] hover:-translate-y-1"
            }`}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#26300D]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
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
