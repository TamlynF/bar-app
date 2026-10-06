import { createClient } from "@/lib/supabase/server";
import { Camera } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { PublicNav } from "@/components/public-nav";
import { PageHeader } from "@/components/editorial/page-header";
import GalleryGrid from "./gallery-grid";
import { CategoryCard, galleryHref } from "@/components/gallery/category-tile";
import { countLabel } from "@/lib/gallery-categories";
import { dateLabel, loadGalleryGroups } from "@/lib/gallery-data";
import { CompanyWordmark } from "@/components/company-wordmark";

export const metadata = {
  title: "Gallery",
  description: "Photos and videos from Don Fenticas.",
};

export default async function GalleryPage() {
  const supabase = await createClient();

  const groups = await loadGalleryGroups(supabase);

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
        <PageHeader eyebrow="Photos & videos" title="Gallery" />

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/3 py-20 text-center">
            <Camera className="mx-auto mb-3 h-8 w-8 text-stone-700" />
            <p className="font-black text-sm tracking-tight text-stone-500 uppercase">
              No Photos Yet
            </p>
            <p className="mt-1 text-xs text-stone-600">Check back soon</p>
          </div>
        ) : (
          <div className="flex flex-col gap-12">
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
              {groups.map((group) => (
                <li key={group.slug}>
                  <CategoryCard
                    group={group}
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 17vw"
                  />
                </li>
              ))}
            </ul>

            {groups.map((group) => (
              <section key={group.slug} aria-labelledby={`gallery-${group.slug}`}>
                <SectionHeading
                  eyebrow={countLabel(group)}
                  title={group.name}
                  id={`gallery-${group.slug}`}
                  action={{ href: galleryHref(group.slug), label: "Open" }}
                  actionInline
                />
                <GalleryGrid items={group.items.map((item) => ({ ...item, created_label: dateLabel(item) }))} />
              </section>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-4 pt-12">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <CompanyWordmark className="h-3.5 opacity-50" />
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