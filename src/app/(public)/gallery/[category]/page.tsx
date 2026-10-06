import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PageHeader } from "@/components/editorial/page-header";
import { countLabel } from "@/lib/gallery-categories";
import { dateLabel, loadGalleryGroups } from "@/lib/gallery-data";
import GalleryGrid from "../gallery-grid";

async function findGroup(slug: string) {
  const supabase = await createClient();
  const groups = await loadGalleryGroups(supabase);
  return groups.find((g) => g.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const group = await findGroup(category);
  if (!group) return { title: "Gallery" };
  return {
    title: `${group.name} · Gallery`,
    description: `${countLabel(group)} from Don Fenticas: ${group.name.toLowerCase()}.`,
  };
}

export default async function GalleryCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const group = await findGroup(category);
  if (!group) notFound();

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#1a2008] text-stone-300 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <PublicNav currentPath="/gallery" />

      <div className="mx-auto w-full max-w-400 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <Link
          href="/gallery"
          className="mb-4 inline-flex min-h-11 items-center gap-2 text-meta font-semibold text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All galleries
        </Link>

        <PageHeader eyebrow={countLabel(group)} title={group.name} />

        <GalleryGrid items={group.items.map((item) => ({ ...item, created_label: dateLabel(item) }))} />
      </div>
    </main>
  );
}
