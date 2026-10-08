import React from "react";
import type { Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { getBandAvailability } from "@/lib/band-availability-data";
import { describeBandNights } from "@/lib/band-availability";
import { getVideoUploadLimitBytes } from "@/lib/video-upload-limit-data";
import BandBookingForm from "./_components/band-booking-form";
import { PublicNav } from "@/components/public-nav";
import { readBookingArrival } from "@/lib/meta/booking-arrival";

export const metadata = {
  title: "Book the Stage",
  description: "Apply to perform live at Don Fenticas.",
  openGraph: {
    title: "Play on stage at Don Fenticas",
    description: "Tell us about your act and the nights that suit you.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#26300D",
};

export default async function BandBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ via?: string; c?: string }>;
}) {
  const supabase = await createClient();
  const arrival = await readBookingArrival(await searchParams);


  const { data: subtypeRows } = await supabase
    .from("event_subtypes")
    .select("name, title")
    .eq("behavior", "music_act")
    .order("name");

  const dbTypeOptions = (subtypeRows ?? []).map((r) => {
    const label = r.title?.trim() || r.name;
    return { value: r.name, label };
  });

  const typeOptions = dbTypeOptions.length > 0 ? dbTypeOptions : [
    { value: "band", label: "Band" },
    { value: "singer", label: "Singer / Solo Artist" },
    { value: "dj", label: "DJ" },
  ];

  const [{ dates: availableDates, rules }, maxVideoBytes] = await Promise.all([
    getBandAvailability(),
    getVideoUploadLimitBytes(),
  ]);

  return (
    <main className="flex min-h-dvh w-full max-sm:min-h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col overflow-x-hidden bg-[#26300D] text-stone-300 antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]">
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
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <PublicNav currentPath="/book/band" />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6 sm:pt-14 sm:pb-12 lg:px-8">

        <div className="flex flex-col justify-center max-sm:flex-1 max-sm:py-4">
          <div className="relative rounded-[2.5rem] border border-white/10 bg-white/[0.07] p-4 shadow-2xl sm:mb-12 ring-1 ring-white/10 backdrop-blur-xl sm:p-10">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
              <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]" />
            </div>

            <div className="relative z-10 mb-3 text-center sm:mb-8">
              <h3 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">Book the Stage</h3>
              <p className="mt-1.5 text-sm font-medium text-ink-2 sm:mt-2 sm:text-base sm:text-stone-500">Fill in your details and we&apos;ll review your application.</p>
            </div>

            <div className="relative z-10">
              <BandBookingForm
                typeOptions={typeOptions}
                availableDates={availableDates}
                bandNights={describeBandNights(rules)}
                maxVideoBytes={maxVideoBytes}
                arrival={arrival}
              />
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
