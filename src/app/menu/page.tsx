import Link from "next/link";
import { ArrowLeft, Beer, Wine, Coffee, UtensilsCrossed } from "lucide-react";

export const metadata = {
  title: "Menu | Don Fenticas",
  description: "Explore the Don Fenticas menu — drinks, bites, and more.",
};

const menuSections = [
  {
    title: "Draught",
    icon: Beer,
    items: [
      { name: "House Lager", detail: "Pint / Half" },
      { name: "Craft IPA", detail: "Pint / Half" },
      { name: "Stout", detail: "Pint / Half" },
      { name: "Cider", detail: "Pint / Half" },
    ],
  },
  {
    title: "Spirits & Cocktails",
    icon: Wine,
    items: [
      { name: "House Spirit & Mixer", detail: "Single / Double" },
      { name: "Premium Spirit & Mixer", detail: "Single / Double" },
      { name: "Espresso Martini", detail: "" },
      { name: "Aperol Spritz", detail: "" },
      { name: "Margarita", detail: "" },
    ],
  },
  {
    title: "Wine",
    icon: Wine,
    items: [
      { name: "House Red", detail: "Glass / Bottle" },
      { name: "House White", detail: "Glass / Bottle" },
      { name: "Prosecco", detail: "Glass / Bottle" },
      { name: "Rose", detail: "Glass / Bottle" },
    ],
  },
  {
    title: "Soft Drinks",
    icon: Coffee,
    items: [
      { name: "Soft Drinks & Mixers", detail: "" },
      { name: "Fresh Juice", detail: "" },
      { name: "Coffee", detail: "" },
      { name: "Tea", detail: "" },
    ],
  },
  {
    title: "Bites",
    icon: UtensilsCrossed,
    items: [
      { name: "Loaded Nachos", detail: "" },
      { name: "Chicken Wings", detail: "" },
      { name: "Halloumi Fries", detail: "" },
      { name: "Cheese Board", detail: "" },
    ],
  },
];

export default function MenuPage() {
  return (
    <main className="min-h-dvh w-full bg-[#26300D] text-white selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <div className="max-w-xl mx-auto px-4 py-8 sm:py-16">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-stone-500 text-xs font-bold uppercase tracking-wide hover:text-stone-300 transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tight">
            Our Menu
          </h1>
          <p className="text-stone-400 text-sm mt-2">
            A selection of what we have on offer. Ask at the bar for the full range.
          </p>
          <div className="inline-flex items-center gap-2 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-3 py-1 mt-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#FDCC4B]">
              Prices available at the bar
            </span>
          </div>
        </div>

        {/* Menu Sections */}
        <div className="space-y-6">
          {menuSections.map((section) => (
            <div
              key={section.title}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
                  <section.icon className="w-4 h-4 text-[#FDCC4B]" />
                </div>
                <h2 className="text-white font-black text-sm uppercase tracking-tight">
                  {section.title}
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {section.items.map((item) => (
                  <div
                    key={item.name}
                    className="px-5 py-3 flex items-center justify-between"
                  >
                    <span className="text-white text-sm font-bold">{item.name}</span>
                    {item.detail && (
                      <span className="text-stone-500 text-[11px] font-bold uppercase tracking-wide shrink-0 ml-4">
                        {item.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-stone-600 text-[10px] font-bold uppercase tracking-wide mb-6">
            Menu items are subject to availability
          </p>
          <div className="flex items-center justify-center gap-3 text-stone-800">
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
