"use client";

import React, { useState } from "react";
import { CheckCircle, ChevronRight, CalendarDays } from "lucide-react";

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
            setDateError("Quiz nights are only held on Thursdays. Please select a Thursday.");
            setFormData((prev) => ({ ...prev, quizDate: "" }));
        } else {
            setDateError("");
            setFormData((prev) => ({ ...prev, quizDate: val }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Safety check just in case they bypassed the HTML validation
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
            <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                    <CheckCircle className="w-20 h-20 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">You&apos;re Locked In!</h2>
                <p className="text-slate-600 mb-6">
                    Table reserved for <strong className="text-slate-900">{formData.teamName || formData.name}&apos;s Team</strong> on {formData.quizDate}. We&apos;ve sent a confirmation to {formData.email}.
                </p>
                <button
                    onClick={() => {
                        setIsSuccess(false);
                        setFormData({ quizDate: "", name: "", teamName: "", teamSize: "4", email: "", phone: "" });
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-xl transition duration-200"
                >
                    Book Another Table
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">

            {/* Quiz Date Selection */}
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-6">
                <label htmlFor="quizDate" className="flex text-sm font-semibold text-slate-800 mb-2 items-center">
                    <CalendarDays className="w-4 h-4 mr-2 text-amber-600" />
                    Select Quiz Date (Thursdays Only) <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                    type="date"
                    id="quizDate"
                    name="quizDate"
                    required
                    min={minDate}
                    suppressHydrationWarning
                    value={formData.quizDate}
                    onChange={handleDateChange}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
                {dateError && <p className="text-red-500 text-sm mt-2 font-medium">{dateError}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Person's Name */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                        placeholder="John Doe"
                    />
                </div>

                {/* Team Name */}
                <div>
                    <label htmlFor="teamName" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Team Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="teamName"
                        name="teamName"
                        required
                        value={formData.teamName}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                        placeholder="Quizzy McQuizface"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Email Address */}
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                        placeholder="john@example.com"
                    />
                </div>
            </div>

            {/* Number of People */}
            <div>
                <label htmlFor="teamSize" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Number of People
                </label>
                <select
                    id="teamSize"
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all cursor-pointer"
                >
                    {[4, 5, 6].map((num) => (
                        <option key={num} value={num}>
                            {num} {num === 1 ? "Person" : "People"}
                        </option>
                    ))}
                </select>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full flex items-center justify-center py-4 px-4 rounded-xl text-white font-bold text-lg transition-all ${isSubmitting
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-amber-500 hover:bg-amber-600 shadow-md hover:shadow-lg"
                        }`}
                >
                    {isSubmitting ? (
                        <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </span>
                    ) : (
                        <span className="flex items-center">
                            Confirm Reservation <ChevronRight className="ml-2 w-5 h-5" />
                        </span>
                    )}
                </button>
            </div>
        </form>
    );
}
