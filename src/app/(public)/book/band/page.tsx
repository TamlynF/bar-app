import React from "react";
import { createClient } from "@/lib/supabase/server";
import { toCamelCase } from "@/lib/utils";
import BandBookingForm from "./_components/band-booking-form";
import { PublicNav } from "@/components/public-nav";

export const metadata = {
  title: "Book the Stage | Don Fenticas",
  description: "Apply to perform live at Don Fenticas.",
};

export default async function BandBookingPage() {
  const supabase = await createClient();


  // Act types come from the music_act subtypes: label = title (fallback name),
  // value = camelCase of the label.
  const { data: subtypeRows } = await supabase
    .from("event_subtypes")
    .select("name, title")
    .eq("behavior", "music_act")
    .order("name");

  const dbTypeOptions = (subtypeRows ?? []).map((r) => {
    const label = r.title?.trim() || r.name;
    return { value: toCamelCase(label), label };
  });

  const typeOptions = dbTypeOptions.length > 0 ? dbTypeOptions : [
    { value: "band", label: "Band" },
    { value: "singer", label: "Singer / Solo Artist" },
    { value: "dj", label: "DJ" },
  ];

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#26300D] text-stone-300 antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #26300D !important;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        main {
          padding-top: env(safe-area-inset-top, 10px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <PublicNav currentPath="/book/band" />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-14 pb-12 sm:px-6 lg:px-8">

        {/* Booking Form Card */}
        <div className="relative mb-12 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]" />

          <div className="relative z-10 mb-8 text-center">
            <h3 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">Book the Stage</h3>
            <p className="mt-2 text-xs font-medium text-stone-500 sm:text-base">Fill in your details and we&apos;ll review your application.</p>
          </div>

          <div className="relative z-10">
            <BandBookingForm typeOptions={typeOptions} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto mb-6 flex flex-col items-center gap-3 pt-8">
          <div className="flex items-center gap-4 text-stone-300">
            <div className="h-px w-6 bg-white/20" />
            <span className="text-[10px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-white/20" />
          </div>
          <p className="text-[9px] tracking-widest text-stone-400 uppercase">
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>

      </div>
    </main>
  );
}
