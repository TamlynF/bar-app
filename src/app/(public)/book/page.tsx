import React from "react";
import Link from "next/link";
import { Trophy, Music, Building2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Book | Don Fenticas",
  description: "Book a table, a band slot, or a private event at Don Fenticas.",
};

const bookingOptions = [
  {
    href: "/book/quiz",
    icon: Trophy,
    label: "Quiz Night",
    description: "Book a table for our weekly quiz night. Eight rounds, great prizes, and happy hour vibes.",
    accent: "#FDCC4B",
    badge: "Every Thursday",
  },
  {
    href: "/book/band",
    icon: Music,
    label: "Book the Stage",
    description: "Apply to perform live at Don Fenticas. Submit your details and we'll be in touch.",
    accent: "#7DD3FC",
    badge: "Open Applications",
  },
  {
    href: "/book/private",
    icon: Building2,
    label: "Private Hire",
    description: "Host your birthday, corporate event, or special occasion at our venue.",
    accent: "#86EFAC",
    badge: "Enquire Now",
  },
];

export default function BookingHubPage() {
  return (
    <main className="min-h-dvh w-full bg-[#26300D] flex flex-col items-center justify-center px-4 py-12 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`
      }} />

      {/* Header */}
      <div className="text-center mb-10 max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FDCC4B] mb-5 shadow-lg">
          <span className="text-[#26300D] font-black text-xl">DF</span>
        </div>
        <h1 className="text-white font-black text-3xl sm:text-4xl uppercase tracking-tight leading-none mb-3">
          Don Fenticas
        </h1>
        <p className="text-stone-500 text-sm font-medium leading-relaxed">
          Choose how you&apos;d like to book with us.
        </p>
      </div>

      {/* Booking Cards */}
      <div className="w-full max-w-2xl space-y-3">
        {bookingOptions.map((opt) => (
          <Link
            key={opt.href}
            href={opt.href}
            className="group flex items-center gap-5 bg-white/4 hover:bg-white/7 border border-white/8 hover:border-white/15 rounded-2xl p-5 sm:p-6 transition-all duration-300 active:scale-[0.99]"
          >
            {/* Icon */}
            <div
              className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${opt.accent}18`, border: `1px solid ${opt.accent}30` }}
            >
              <opt.icon className="w-5 h-5" style={{ color: opt.accent }} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-white font-black text-base uppercase tracking-tight">{opt.label}</span>
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${opt.accent}20`, color: opt.accent }}
                >
                  {opt.badge}
                </span>
              </div>
              <p className="text-stone-500 text-xs leading-relaxed line-clamp-2">{opt.description}</p>
            </div>

            {/* Arrow */}
            <ArrowRight className="shrink-0 w-4 h-4 text-stone-600 group-hover:text-stone-400 group-hover:translate-x-0.5 transition-all duration-200" />
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-10 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 text-stone-800">
          <div className="h-px w-6 bg-stone-800/50" />
          <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
          <div className="h-px w-6 bg-stone-800/50" />
        </div>
        <p className="text-[8px] text-stone-700 uppercase tracking-widest font-bold opacity-40">
          Licensed Venue · Please Drink Responsibly
        </p>
      </div>
    </main>
  );
}
