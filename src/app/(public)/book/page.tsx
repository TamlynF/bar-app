import React from "react";
import Link from "next/link";
import { Trophy, Music, Building2, ArrowRight, Disc3, CalendarDays, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";

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

export default async function BookingHubPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: bookableEvents } = await supabase
    .from("events")
    .select("id, date, title, payment_amount, is_fully_booked, event_types_id")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(10);

  const events = bookableEvents ?? [];

  return (
    <main className="min-h-dvh w-full bg-[#26300D] px-4 pb-12 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`
      }} />

      <PublicNav currentPath="/book" />

      <div className="max-w-5xl mx-auto pt-6 sm:pt-10">
        {/* Header — H1 is the page's purpose, not the bar name */}
        <SectionHeading eyebrow="Reservations & bookings" title="Book" />

        {/* Booking Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bookingOptions.map((opt) => (
            <Link
              key={opt.href}
              href={opt.href}
              className="group flex flex-col bg-white/5 hover:bg-white/12 border border-white/15 hover:border-white/30 rounded-2xl p-6 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 active:scale-[0.99] min-h-44"
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${opt.iconClass}`}>
                  <opt.icon className={`w-6 h-6 ${opt.iconColor}`} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${opt.badgeClass}`}>
                  {opt.badge}
                </span>
              </div>

              <span className="text-white font-black uppercase tracking-tighter leading-[0.95] text-2xl sm:text-3xl">
                {opt.label}
              </span>
              <p className="text-stone-400 text-xs leading-relaxed mt-2 line-clamp-2">{opt.description}</p>

              <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#FDCC4B] group-hover:gap-2.5 transition-all">
                Book now
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>

        {/* Upcoming Bookable Events */}
        {events.length > 0 && (
          <div className="mt-16 sm:mt-20">
            <SectionHeading eyebrow="Tickets" title="Upcoming Events" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((ev) => {
                const dateStr = new Date(ev.date + "T00:00:00").toLocaleDateString("en-GB", {
                  weekday: "short", day: "numeric", month: "short",
                });
                const isFree = !ev.payment_amount || ev.payment_amount === 0;
                return (
                  <Link
                    key={ev.id}
                    href={`/book/event/${ev.id}`}
                    className="group flex items-center gap-4 bg-white/5 hover:bg-white/12 border border-white/15 hover:border-white/30 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 active:scale-[0.99]"
                  >
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-[#FDCC4B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-white font-black text-sm uppercase tracking-tight truncate">{ev.title || "Event"}</span>
                        {ev.is_fully_booked ? (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Full</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FDCC4B]/10 text-[#FDCC4B] border border-[#FDCC4B]/20">
                            {isFree ? "Free" : `£${ev.payment_amount!.toFixed(2)}`}
                          </span>
                        )}
                      </div>
                      <p className="text-stone-500 text-xs font-bold">{dateStr}</p>
                    </div>
                    <Ticket className="shrink-0 w-4 h-4 text-stone-500 group-hover:text-[#FDCC4B] transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] text-stone-700 uppercase tracking-widest font-bold opacity-40">
            Licensed Venue · Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}