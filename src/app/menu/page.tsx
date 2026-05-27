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
              @page { size: A4; margin: 6mm; }
              html, body {
                background-color: #26300D !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .no-print { display: none !important; }

              /* Page wrapper */
              .menu-page {
                border: 3px solid #8B7536 !important;
                outline: 1px solid #5a4d25 !important;
                outline-offset: 3px;
                padding: 10px 14px !important;
                max-width: 100% !important;
                margin: 0 !important;
              }

              /* Header compact */
              .menu-header { margin-bottom: 4px !important; }
              .menu-header img { width: 180px !important; height: auto !important; }
              .menu-subtitle { font-size: 6px !important; margin-top: 1px !important; letter-spacing: 0.2em !important; }
              .spirits-note { margin-bottom: 6px !important; font-size: 7px !important; padding: 2px 8px !important; }

              /* Grid */
              .menu-grid {
                grid-template-columns: 1fr 1fr !important;
                gap: 4px 10px !important;
                display: grid !important;
              }
              .menu-col { gap: 4px !important; display: flex !important; flex-direction: column !important; }

              /* Category */
              .cat-header { padding: 1px 6px !important; border-radius: 2px !important; }
              .cat-header h2 { font-size: 9px !important; line-height: 1.3 !important; }
              .cat-body { padding: 1px 6px 2px !important; border-width: 1px !important; border-radius: 0 0 2px 2px !important; }
              .cat-note { font-size: 5.5px !important; padding: 0 !important; margin-bottom: 0 !important; }

              /* Items */
              .menu-item { padding: 0.5px 0 !important; gap: 4px !important; }
              .item-name { font-size: 7.5px !important; line-height: 1.2 !important; }
              .item-price { font-size: 7px !important; line-height: 1.2 !important; }
            }
          `,
        }}
      />

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-12 menu-page">
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
        <div className="text-center mb-8 sm:mb-10 menu-header">
          <Image
            src="/CompanyName.png"
            alt="Don Fenticas"
            width={300}
            height={80}
            className="w-[200px] sm:w-[260px] mx-auto h-auto object-contain"
            priority
          />
          <p className="text-[#FDCC4B]/50 text-[10px] font-bold uppercase tracking-[0.3em] mt-3 menu-subtitle">
            Drinks &amp; Snacks Menu
          </p>
        </div>

        {/* Spirits note */}
        <div className="text-center mb-6">
          <span className="spirits-note inline-block bg-[#FDCC4B] text-[#26300D] text-[10px] sm:text-[11px] font-black uppercase tracking-wide px-4 py-1.5 rounded-full">
            Spirits — + £1.45 for mixers, + £1.95 for tonic
          </span>
        </div>

        {/* Menu grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 menu-grid">
          <div className="space-y-4 sm:space-y-5 menu-col">
            {col1.map((cat) => (
              <CategorySection key={cat.id} category={cat} />
            ))}
          </div>
          <div className="space-y-4 sm:space-y-5 menu-col">
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
      {/* Category header — gold banner like the real printed menu */}
      <div className="cat-header bg-[#FDCC4B] rounded-t-lg px-4 py-1.5 flex items-center justify-center">
        <h2 className="text-[#26300D] font-black text-sm sm:text-base uppercase tracking-tight text-center">
          {category.name}
        </h2>
      </div>

      {/* Items */}
      <div className="cat-body bg-[#26300D] border border-[#FDCC4B]/20 border-t-0 rounded-b-lg px-4 py-2">
        {category.note && (
          <p className="cat-note text-[#FDCC4B]/60 text-[9px] font-bold uppercase tracking-wide text-center py-1 mb-1">
            {category.note}
          </p>
        )}
        {category.menu_items.map((item) => (
          <div
            key={item.id}
            className="menu-item flex items-baseline justify-between py-1.5 gap-2"
          >
            <span className="item-name text-white text-xs sm:text-sm font-medium flex-1 min-w-0">
              {item.name}
            </span>
            <span className="item-price text-[#FDCC4B] text-[11px] sm:text-xs font-bold shrink-0 text-right">
              {item.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
