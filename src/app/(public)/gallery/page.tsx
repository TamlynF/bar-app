import { createClient } from "@/lib/supabase/server";
import { Camera } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import GalleryGrid, { type GalleryItem } from "./gallery-grid";
import { format } from "date-fns";

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

  const galleryItems: GalleryItem[] = (
    (images ?? []) as {
      id: number;
      title: string;
      description: string | null;
      image_url: string;
      media_type: string;
      created_at: string;
    }[]
  ).map(({ created_at, ...item }) => ({
    ...item,
    created_label: format(new Date(created_at), "d MMM yyyy"),
  }));

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#1a2008] text-stone-300 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
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

      <div className="mx-auto w-full max-w-400 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <SectionHeading eyebrow="Photos & videos" title="Gallery" />

        {galleryItems.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/3 py-20 text-center">
            <Camera className="mx-auto mb-3 h-8 w-8 text-stone-700" />
            <p className="font-black text-sm tracking-tight text-stone-500 uppercase">
              No Photos Yet
            </p>
            <p className="mt-1 text-xs text-stone-600">Check back soon</p>
          </div>
        ) : (
          <GalleryGrid items={galleryItems} />
        )}

        <div className="mt-8 flex flex-col items-center gap-4 pt-12">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] tracking-widest text-stone-600 uppercase opacity-30">
            Licensed Venue &middot; Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}