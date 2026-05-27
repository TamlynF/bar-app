import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/components/ui/print-button";

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
    <main className="min-h-dvh w-full bg-[#2a3612] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body { background-color: #2a3612 !important; margin: 0; padding: 0; overflow-x: hidden; }

            @media print {
              @page { size: A4; margin: 0mm; }
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              html, body, main {
                background: #2a3612 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
              }
              .no-print { display: none !important; }

              /* Frame */
              .menu-frame {
                margin: 0 !important;
                border-radius: 0 !important;
                border-width: 6px !important;
                border-color: #3d4a22 !important;
                min-height: 100vh !important;
              }
              .menu-inner {
                border-width: 2px !important;
                border-color: #B8962E !important;
                padding: 10px 14px !important;
              }

              /* Header */
              .menu-logo { margin-bottom: 3px !important; }
              .menu-logo img { width: 180px !important; height: auto !important; }
              .menu-subtitle { font-size: 6px !important; margin-top: 1px !important; letter-spacing: 0.2em !important; }
              .spirits-pill { font-size: 6px !important; padding: 2px 8px !important; margin-bottom: 6px !important; }

              /* FORCE two-column grid */
              .menu-grid {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 3px 10px !important;
              }
              .menu-col {
                display: flex !important;
                flex-direction: column !important;
                gap: 3px !important;
              }

              /* Category banners */
              .cat-banner {
                padding: 1px 0 !important;
                border-top-width: 2px !important;
                border-bottom-width: 2px !important;
              }
              .cat-banner h2 { font-size: 8px !important; line-height: 1.2 !important; }

              /* Items */
              .cat-items { padding: 0px 4px 1px !important; }
              .cat-note { font-size: 5px !important; padding: 0 !important; margin: 0 !important; }
              .menu-row { padding: 0.5px 0 !important; gap: 3px !important; }
              .menu-row-name { font-size: 6.5px !important; line-height: 1.15 !important; }
              .menu-row-price { font-size: 6px !important; line-height: 1.15 !important; }
            }
          `,
        }}
      />

      {/* Screen-only nav */}
      <div className="no-print max-w-4xl mx-auto px-4 pt-6 sm:pt-10 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[#8B7536] text-xs font-bold uppercase tracking-wide hover:text-[#FDCC4B] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
        <PrintButton />
      </div>

      {/* Menu frame — the bordered page */}
      <div className="menu-frame max-w-4xl mx-auto my-4 sm:my-8 rounded-sm border-[5px] border-[#4a5a28] relative">
        {/* Gold inner border */}
        <div className="menu-inner border-2 border-[#B8962E] bg-[#2a3612] p-4 sm:p-8">

          {/* Logo */}
          <div className="menu-logo text-center mb-4 sm:mb-6">
            <Image
              src="/CompanyName.png"
              alt="Don Fenticas"
              width={360}
              height={90}
              className="w-[220px] sm:w-[300px] mx-auto h-auto object-contain"
              priority
            />
            <p className="menu-subtitle text-[#FDCC4B]/40 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.25em] mt-2">
              Drinks &amp; Snacks Menu
            </p>
          </div>

          {/* Spirits note */}
          <div className="text-center mb-4 sm:mb-5">
            <span className="spirits-pill inline-block bg-[#FDCC4B] text-[#26300D] text-[8px] sm:text-[10px] font-black uppercase tracking-wide px-3 sm:px-4 py-1 rounded-sm">
              Spirits* — (+ £1.45 for mixers, + £1.95 for tonic)
            </span>
          </div>

          {/* Two-column grid */}
          <div className="menu-grid grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="menu-col flex flex-col gap-3 sm:gap-4">
              {col1.map((cat) => (
                <CategoryBlock key={cat.id} category={cat} />
              ))}
            </div>
            <div className="menu-col flex flex-col gap-3 sm:gap-4">
              {col2.map((cat) => (
                <CategoryBlock key={cat.id} category={cat} />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Screen-only footer */}
      <div className="no-print max-w-4xl mx-auto px-4 pb-8 text-center">
        <p className="text-[#4a5a28] text-[9px] font-bold uppercase tracking-widest">
          &copy; {new Date().getFullYear()} Don Fenticas &middot; Regent Street, Hinckley
        </p>
      </div>
    </main>
  );
}

function CategoryBlock({ category }: { category: MenuCategory }) {
  if (category.menu_items.length === 0) return null;

  return (
    <div>
      {/* Yellow banner header with dark top/bottom borders */}
      <div className="cat-banner bg-[#FDCC4B] border-y-[3px] border-[#2a3612] py-0.5 sm:py-1">
        <h2 className="text-[#2a3612] font-black text-xs sm:text-sm uppercase tracking-wide text-center leading-tight">
          {category.name}
        </h2>
      </div>

      {/* Items — no visible border, just rows on dark green */}
      <div className="cat-items px-2 sm:px-3 py-1">
        {category.note && (
          <p className="cat-note text-[#FDCC4B]/50 text-[7px] sm:text-[8px] font-bold uppercase tracking-wide text-center py-0.5">
            {category.note}
          </p>
        )}
        {category.menu_items.map((item) => (
          <div
            key={item.id}
            className="menu-row flex items-baseline justify-between py-[3px] sm:py-1 gap-2"
          >
            <span className="menu-row-name text-white text-[11px] sm:text-xs font-medium leading-tight flex-1 min-w-0">
              {item.name}
            </span>
            <span className="menu-row-price text-[#FDCC4B] text-[10px] sm:text-[11px] font-bold shrink-0 text-right leading-tight">
              {item.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
