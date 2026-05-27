import React from "react";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GalleryGrid from "./gallery-grid";

export const metadata = {
  title: "Gallery | Don Fenticas",
  description: "Photos and videos from Don Fenticas.",
};

export default async function GalleryPage() {
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("gallery_images")
    .select("id, title, description, image_url, media_type, created_at")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const galleryItems = (images ?? []) as {
    id: number;
    title: string;
    description: string | null;
    image_url: string;
    media_type: string;
    created_at: string;
  }[];

  return (
    <main className="min-h-dvh w-full bg-[#26300D] text-stone-300 flex flex-col selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #26300D !important;
          margin: 0; padding: 0;
          width: 100%; height: 100%;
          overflow-x: hidden;
        }
        main {
          padding-top: env(safe-area-inset-top, 10px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
      `}} />

      <div className="w-full max-w-5xl mx-auto py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-12">
          <Link
            href="/"
            className="self-start inline-flex items-center gap-1.5 text-stone-500 hover:text-[#FDCC4B] text-[11px] font-black uppercase tracking-wide transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="w-full max-w-[160px] sm:max-w-[200px]">
            <Image
              src="/CompanyName.png"
              alt="Don Fenticas"
              width={300}
              height={90}
              className="w-full h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
              priority
            />
          </div>
          <div className="mt-5 space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter">Gallery</h1>
            <p className="text-stone-400 text-xs sm:text-sm font-medium">Moments from Don Fenticas</p>
          </div>
        </div>

        {/* Gallery */}
        {galleryItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-500 font-black text-lg uppercase tracking-tight mb-2">No Photos Yet</p>
            <p className="text-stone-600 text-sm">Check back soon!</p>
          </div>
        ) : (
          <GalleryGrid items={galleryItems} />
        )}

        {/* Footer */}
        <div className="pt-12 mt-8 flex flex-col items-center gap-4">
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
