import { createClient } from "@/lib/supabase/server";
import { Camera } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
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
    <main className="min-h-dvh w-full bg-[#1a2008] text-stone-300 flex flex-col selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background-color: #1a2008 !important;
              margin: 0; padding: 0;
              width: 100%; height: 100%;
              overflow-x: hidden;
            }
          `,
        }}
      />

      <PublicNav currentPath="/gallery" />

      <div className="w-full max-w-5xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
        {/* Page header — H1 is "GALLERY", not the bar's name */}
        <header className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-3 py-1 mb-3">
            <Camera className="w-3 h-3 text-[#FDCC4B]" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
              Photos &amp; Videos
            </span>
          </div>
          <h1 className="text-white font-black text-3xl sm:text-4xl uppercase tracking-tighter">
            Gallery
          </h1>
          <p className="text-stone-400 text-xs sm:text-sm font-medium mt-2">
            Moments from the bar &mdash; gigs, nights out, behind the bar
          </p>
        </header>

        {/* Gallery */}
        {galleryItems.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.03] border border-white/5 rounded-2xl">
            <Camera className="w-8 h-8 text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500 font-black text-sm uppercase tracking-tight">
              No Photos Yet
            </p>
            <p className="text-stone-600 text-xs mt-1">Check back soon</p>
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
            Licensed Venue &middot; Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}