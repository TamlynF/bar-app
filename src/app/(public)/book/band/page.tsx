import React from "react";
import { Music, ArrowLeft } from "lucide-react";
import Link from "next/link";
import BandBookingForm from "./_components/band-booking-form";

export const metadata = {
  title: "Book the Stage | Don Fenticas",
  description: "Apply to perform live at Don Fenticas.",
};

export default function BandBookingPage() {
  return (
    <main className="min-h-dvh w-full bg-[#26300D] text-stone-300 flex flex-col selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; } main { padding-top: env(safe-area-inset-top, 10px); padding-bottom: env(safe-area-inset-bottom, 20px); }`
      }} />

      <div className="flex-1 w-full max-w-2xl mx-auto py-6 sm:py-12 px-4 sm:px-6 flex flex-col">

        {/* Back nav */}
        <Link
          href="/book"
          className="flex items-center gap-2 text-stone-600 hover:text-stone-400 text-xs font-bold uppercase tracking-widest mb-8 transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All Bookings
        </Link>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "#7DD3FC18", border: "1px solid #7DD3FC30" }}>
            <Music className="w-6 h-6 text-[#7DD3FC]" />
          </div>
          <h1 className="text-white font-black text-3xl sm:text-4xl uppercase tracking-tight leading-none mb-2">
            Book the Stage
          </h1>
          <p className="text-stone-500 text-sm max-w-sm leading-relaxed">
            Apply to perform live at Don Fenticas. Fill in your details and we'll review your application.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/3 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-10 border border-white/10 shadow-2xl relative overflow-hidden ring-1 ring-white/5 mb-12">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#7DD3FC]/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <BandBookingForm />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto mb-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] text-stone-600 uppercase tracking-widest opacity-30">
            Licensed Venue · Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}
