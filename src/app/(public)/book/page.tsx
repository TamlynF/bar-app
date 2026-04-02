import React from "react";
import Link from "next/link";
import { Trophy, Music, Building2, ArrowRight, Disc3 } from "lucide-react";
import Image from "next/image";

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
    badge: "Thursdays",
    iconClass: "icon-quiz",
    iconColor: "icon-color-quiz",
    badgeClass: "badge-quiz",
  },
  {
    href: "/book/bingo",
    icon: Disc3,
    label: "Music Bingo",
    description: "Book your spot for Music Bingo night. Tickets paid upfront — don't miss out!",
    badge: "Book",
    iconClass: "icon-bingo",
    iconColor: "icon-color-bingo",
    badgeClass: "badge-bingo",
  },
  {
    href: "/book/band",
    icon: Music,
    label: "Book the Stage",
    description: "Apply to perform live at Don Fenticas. Submit your details and we'll be in touch.",
    badge: "Apply Now",
    iconClass: "icon-band",
    iconColor: "icon-color-band",
    badgeClass: "badge-band",
  },
  {
    href: "/book/private",
    icon: Building2,
    label: "Private Hire",
    description: "Host your birthday, corporate event, or special occasion at our venue.",
    badge: "Enquire Now",
    iconClass: "icon-hire",
    iconColor: "icon-color-hire",
    badgeClass: "badge-hire",
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
        {/* <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FDCC4B] mb-5 shadow-lg">
          <span className="text-[#26300D] font-black text-xl">DF</span>
        </div>
        <h1 className="text-white font-black text-3xl sm:text-4xl uppercase tracking-tight leading-none mb-3">
          Don Fenticas
        </h1> */}
        
        <Image
          src="/CompanyName.png"
          alt="Don Fenticas Logo"
          width={300}
          height={80}
          className="w-full h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
          priority
          />
      
      <div className="w-full max-w-sm mx-auto mt-15">
        <h2 className="text-white font-black text-xl sm:text-3xl uppercase tracking-tight leading-none mb-3">
          Book Your Experience
        </h2>
        <p className="text-stone-400 text-sm font-medium leading-relaxed">
          Choose how you&apos;d like to book with us.
        </p>
      </div>
        </div>

      {/* Booking Cards */}
      <div className="w-full max-w-2xl space-y-4">
        {bookingOptions.map((opt) => (
          <Link
            key={opt.href}
            href={opt.href}
            className="group flex items-center gap-4 bg-white/5 hover:bg-white/[0.15] border border-white/20 hover:border-white/30 rounded-2xl p-5 sm:p-6 shadow-lg shadow-black/20 transition-all duration-300 active:scale-[0.99]"
          >
            {/* Icon */}
            <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${opt.iconClass}`}>
              <opt.icon className={`w-6 h-6 ${opt.iconColor}`} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-white font-black text-base uppercase tracking-tight">{opt.label}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${opt.badgeClass}`}>
                  {opt.badge}
                </span>
              </div>
              <p className="text-stone-400 text-xs leading-relaxed line-clamp-2">{opt.description}</p>
            </div>

            {/* Arrow */}
            <ArrowRight className="shrink-0 w-4 h-4 text-stone-500 group-hover:text-stone-400 group-hover:translate-x-0.5 transition-all duration-200" />
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
