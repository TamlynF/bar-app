import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import PrintButton from "./print-button";

export const metadata = {
  title: "Menu | Don Fenticas",
  description: "Explore the Don Fenticas menu — draught, cocktails, spirits, wine, and snacks.",
};

export const revalidate = 300;

type MenuItem = {
  id: number;
  name: string;
  price: string;
  display_order: number;
  is_active: boolean;
};

type MenuCategory = {
  id: number;
  name: string;
  note: string | null;
  display_order: number;
  is_active: boolean;
  menu_items: MenuItem[];
};

export default async function MenuPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("menu_categories")
    .select("*, menu_items(*)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const sorted = ((categories as MenuCategory[]) || []).map((cat) => ({
    ...cat,
    menu_items: cat.menu_items
      .filter((i) => i.is_active)
      .sort((a, b) => a.display_order - b.display_order),
  }));

  // Split into two columns for desktop (like the real menu)
  const mid = Math.ceil(sorted.length / 2);
  const col1 = sorted.slice(0, mid);
  const col2 = sorted.slice(mid);

  return (
    <main className="min-h-dvh w-full bg-[#26300D] text-white selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }
            @media print {
              html, body { background-color: #26300D !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
              .print-grid { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
              main { font-size: 10px; }
              .print-tight { padding: 8px 16px !important; margin: 0 auto !important; max-width: 100% !important; }
            }
          `,
        }}
      />

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-12 print-tight">
        {/* Back + Print */}
        <div className="flex items-center justify-between mb-6 no-print">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-stone-500 text-xs font-bold uppercase tracking-wide hover:text-stone-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <PrintButton />
        </div>

        {/* Logo */}
        <div className="text-center mb-8 sm:mb-10">
          <Image
            src="/CompanyName.png"
            alt="Don Fenticas"
            width={300}
            height={80}
            className="w-[200px] sm:w-[260px] mx-auto h-auto object-contain"
            priority
          />
          <p className="text-[#FDCC4B]/50 text-[10px] font-bold uppercase tracking-[0.3em] mt-3">
            Drinks &amp; Snacks Menu
          </p>
        </div>

        {/* Spirits note */}
        <div className="text-center mb-6">
          <span className="inline-block bg-[#FDCC4B] text-[#26300D] text-[10px] sm:text-[11px] font-black uppercase tracking-wide px-4 py-1.5 rounded-full">
            Spirits — + £1.45 for mixers, + £1.95 for tonic
          </span>
        </div>

        {/* Menu grid — 2 columns on desktop, single on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 print-grid">
          <div className="space-y-4 sm:space-y-5">
            {col1.map((cat) => (
              <CategorySection key={cat.id} category={cat} />
            ))}
          </div>
          <div className="space-y-4 sm:space-y-5">
            {col2.map((cat) => (
              <CategorySection key={cat.id} category={cat} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 sm:mt-16 text-center space-y-2 no-print">
          <p className="text-stone-600 text-[10px] font-bold uppercase tracking-wide">
            Menu items subject to availability &middot; Prices may vary
          </p>
          <div className="flex items-center justify-center gap-3 text-stone-800 pt-2">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">
              Don Fenticas
            </span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
        </div>
      </div>
    </main>
  );
}

function CategorySection({ category }: { category: MenuCategory }) {
  if (category.menu_items.length === 0) return null;

  return (
    <div className="overflow-hidden">
      {/* Category header — styled like the real menu's yellow banner */}
      <div className="bg-[#FDCC4B] rounded-t-lg px-4 py-1.5 flex items-center justify-center">
        <h2 className="text-[#26300D] font-black text-sm sm:text-base uppercase tracking-tight text-center">
          {category.name}
        </h2>
      </div>

      {/* Items */}
      <div className="bg-[#26300D] border border-[#FDCC4B]/20 border-t-0 rounded-b-lg px-4 py-2">
        {category.note && (
          <p className="text-[#FDCC4B]/60 text-[9px] font-bold uppercase tracking-wide text-center py-1 mb-1">
            {category.note}
          </p>
        )}
        {category.menu_items.map((item) => (
          <div
            key={item.id}
            className="flex items-baseline justify-between py-1.5 gap-2"
          >
            <span className="text-white text-xs sm:text-sm font-medium flex-1 min-w-0">
              {item.name}
            </span>
            <span className="text-[#FDCC4B] text-[11px] sm:text-xs font-bold shrink-0 text-right">
              {item.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
