import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { Wine } from "lucide-react";

export const metadata = {
  title: "Menu | Don Fenticas",
  description:
    "Explore the Don Fenticas menu — draught, cocktails, spirits, wine, and snacks.",
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

              .menu-header { margin-bottom: 8px !important; }
              .menu-h1 { font-size: 26px !important; line-height: 1 !important; }
              .menu-subtitle { font-size: 8px !important; margin-top: 3px !important; letter-spacing: 0.25em !important; }
              .spirits-pill { font-size: 6px !important; padding: 2px 8px !important; margin-bottom: 6px !important; }

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

              .cat-banner {
                padding: 1px 0 !important;
                border-top-width: 2px !important;
                border-bottom-width: 2px !important;
              }
              .cat-banner h2 { font-size: 8px !important; line-height: 1.2 !important; }

              .cat-items { padding: 0px 4px 1px !important; }
              .cat-note { font-size: 5px !important; padding: 0 !important; margin: 0 !important; }
              .menu-row { padding: 0.5px 0 !important; gap: 3px !important; }
              .menu-row-name { font-size: 6.5px !important; line-height: 1.15 !important; }
              .menu-row-price { font-size: 6px !important; line-height: 1.15 !important; }
            }
          `,
        }}
      />

      {/* Shared sticky nav */}
      <div className="no-print">
        <PublicNav currentPath="/menu" />
      </div>

      {/* Menu frame — the bordered page (kept for the print aesthetic) */}
      <div className="menu-frame relative mx-3 my-4 max-w-4xl rounded-sm border-[5px] border-[#4a5a28] sm:mx-auto sm:my-8">
        <div className="menu-inner border-2 border-[#B8962E] bg-[#2a3612] p-4 sm:p-8">

          {/* Page header — H1 is "MENU", not the bar's name */}
          <header className="menu-header mb-5 text-center sm:mb-7">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#FDCC4B]/20 bg-[#FDCC4B]/10 px-3 py-1">
              <Wine className="h-3 w-3 text-[#FDCC4B]" />
              <span className="font-black text-[10px] tracking-[0.25em] text-[#FDCC4B] uppercase">
                Drinks &amp; Snacks
              </span>
            </div>
            <h1 className="menu-h1 font-black text-4xl leading-none tracking-tighter text-white uppercase sm:text-6xl">
              Menu
            </h1>
            <p className="menu-subtitle mt-2 text-[10px] font-bold tracking-[0.25em] text-[#FDCC4B]/50 uppercase sm:text-xs">
              Updated regularly &middot; Tap to print
            </p>
          </header>

          {/* Spirits note */}
          <div className="mb-5 text-center">
            <span className="spirits-pill inline-block rounded-sm bg-[#FDCC4B] px-3 py-1 font-black text-[10px] tracking-wide text-[#26300D] uppercase sm:px-4 sm:text-xs">
              Spirits* — (+ £1.45 for mixers, + £1.95 for tonic)
            </span>
          </div>

          {/* Two-column grid */}
          <div className="menu-grid grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
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
      <div className="no-print mx-auto max-w-4xl px-4 pb-10 text-center">
        <p className="text-[9px] font-bold tracking-widest text-[#4a5a28] uppercase">
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
      <div className="cat-banner border-y-[3px] border-[#2a3612] bg-[#FDCC4B] py-0.5 sm:py-1">
        <h2 className="text-center font-black text-xs leading-tight tracking-wide text-[#2a3612] uppercase sm:text-sm">
          {category.name}
        </h2>
      </div>

      <div className="cat-items px-2 py-1 sm:px-3">
        {category.note && (
          <p className="cat-note py-0.5 text-center text-[7px] font-bold tracking-wide text-[#FDCC4B]/50 uppercase sm:text-[8px]">
            {category.note}
          </p>
        )}
        {category.menu_items.map((item) => (
          <div
            key={item.id}
            className="menu-row flex items-baseline justify-between gap-2 py-0.75 sm:py-1"
          >
            <span className="menu-row-name min-w-0 flex-1 text-[11px] leading-tight font-medium text-white sm:text-xs">
              {item.name}
            </span>
            <span className="menu-row-price shrink-0 text-right text-[10px] leading-tight font-bold text-[#FDCC4B] sm:text-[11px]">
              {item.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}