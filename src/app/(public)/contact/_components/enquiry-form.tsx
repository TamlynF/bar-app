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
      <div className="space-y-3 rounded-2xl border border-[#FDCC4B]/20 bg-white/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[#FDCC4B]" />
        <h3 className="font-black text-lg tracking-tight text-white uppercase">
          Message Sent!
        </h3>
        <p className="text-sm leading-relaxed font-medium text-stone-400">
          Thanks for getting in touch - we&apos;ll get back to you as soon as
          we can. Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="enquiry-name" className="block font-black text-[11px] tracking-widest text-stone-400 uppercase">
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
          <label htmlFor="enquiry-email" className="block font-black text-[11px] tracking-widest text-stone-400 uppercase">
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

      <div className="space-y-1.5">
        <label htmlFor="enquiry-subject" className="block font-black text-[11px] tracking-widest text-stone-400 uppercase">
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

      <div className="space-y-1.5">
        <label htmlFor="enquiry-message" className="block font-black text-[11px] tracking-widest text-stone-400 uppercase">
          Message *
        </label>
        <textarea
          id="enquiry-message"
          name="message"
          required
          rows={5}
          maxLength={4000}
          placeholder="Ask us anything - gigs, karaoke, the menu, lost property..."
          className={`${inputClasses} resize-none`}
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FDCC4B] py-3.5 font-black text-sm tracking-wider text-[#26300D] uppercase shadow-lg shadow-[#FDCC4B]/20 transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isPending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}