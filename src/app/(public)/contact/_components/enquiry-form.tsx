"use client";

import React, { useState, useTransition } from "react";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import { createEnquiry } from "@/app/(public)/_actions/create-enquiry";

const inputClasses =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FDCC4B]/50 focus:ring-1 focus:ring-[#FDCC4B]/30 transition-all";

export default function EnquiryForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createEnquiry(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-3 bg-white/5 p-8 border border-[#FDCC4B]/20 rounded-2xl text-center">
        <CheckCircle2 className="mx-auto w-10 h-10 text-[#FDCC4B]" />
        <h3 className="font-black text-white text-lg uppercase tracking-tight">
          Message Sent!
        </h3>
        <p className="font-medium text-stone-400 text-sm leading-relaxed">
          Thanks for getting in touch — we&apos;ll get back to you as soon as
          we can. Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="enquiry-name" className="block font-black text-[11px] text-stone-400 uppercase tracking-widest">
            Name *
          </label>
          <input
            id="enquiry-name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            placeholder="Your name"
            className={inputClasses}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="enquiry-email" className="block font-black text-[11px] text-stone-400 uppercase tracking-widest">
            Email *
          </label>
          <input
            id="enquiry-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClasses}
          />
        </div>
      </div>

      <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="enquiry-phone" className="block font-black text-[11px] text-stone-400 uppercase tracking-widest">
            Phone
          </label>
          <input
            id="enquiry-phone"
            name="phone_no"
            type="tel"
            autoComplete="tel"
            placeholder="Optional"
            className={inputClasses}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="enquiry-subject" className="block font-black text-[11px] text-stone-400 uppercase tracking-widest">
            Subject
          </label>
          <input
            id="enquiry-subject"
            name="subject"
            type="text"
            placeholder="What's it about?"
            className={inputClasses}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="enquiry-message" className="block font-black text-[11px] text-stone-400 uppercase tracking-widest">
          Message *
        </label>
        <textarea
          id="enquiry-message"
          name="message"
          required
          rows={5}
          maxLength={4000}
          placeholder="Ask us anything — gigs, karaoke, the menu, lost property..."
          className={`${inputClasses} resize-none`}
        />
      </div>

      {error && (
        <p className="bg-red-500/10 px-4 py-3 border border-red-500/20 rounded-xl font-medium text-red-400 text-xs">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex justify-center items-center gap-2 bg-[#FDCC4B] hover:bg-[#FDCC4B]/90 disabled:opacity-50 shadow-[#FDCC4B]/20 shadow-lg py-3.5 rounded-xl w-full font-black text-[#26300D] text-sm uppercase tracking-wider active:scale-[0.98] transition-all disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {isPending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}