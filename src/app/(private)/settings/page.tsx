import React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Grid2X2,
  Component,
  Dices,
  BookUser,
  Medal,
  UserCog2,
  Building2,
  Shapes,
  Guitar,
  UtensilsCrossed,
  Sparkles,
  ShoppingBag,
  Image as ImageIcon,
  Camera,
} from "lucide-react";

const settingsItems = [
  {
    title: "Company Info",
    description: "Business details and socials",
    href: "/settings/company",
    icon: Building2,
    color: "bg-amber-50 text-amber-600",
  },
  {
    title: "Customers",
    description: "Database and contact info",
    href: "/settings/customers",
    icon: BookUser,
    color: "bg-green-50 text-green-600",
  },
  {
    title: "Teams",
    description: "Leaderboards and history",
    href: "/settings/teams",
    icon: Medal,
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "Music Acts",
    description: "Bands, DJs and performers",
    href: "/settings/music-acts",
    icon: Guitar,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "Seating Plan",
    description: "Floor plans and capacities",
    href: "/settings/tables",
    icon: Grid2X2,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Venue Layout",
    description: "Room shape, obstacles, fixtures",
    href: "/settings/venue",
    icon: Shapes,
    color: "bg-teal-50 text-teal-600",
  },
  {
    title: "Menu",
    description: "Categories and items",
    href: "/settings/menu",
    icon: UtensilsCrossed,
    color: "bg-orange-50 text-orange-600",
  },
  {
    title: "Specials",
    description: "Drink deals and offers",
    href: "/settings/specials",
    icon: Sparkles,
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    title: "Merchandise",
    description: "Products and pricing",
    href: "/settings/merchandise",
    icon: ShoppingBag,
    color: "bg-pink-50 text-pink-600",
  },
  {
    title: "Promo Content",
    description: "Homepage promo cards",
    href: "/settings/promo-content",
    icon: ImageIcon,
    color: "bg-sky-50 text-sky-600",
  },
  {
    title: "Gallery",
    description: "Photos and videos",
    href: "/settings/gallery",
    icon: Camera,
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    title: "Event Categories",
    description: "Categories and requirements",
    href: "/event-setups/event-types",
    icon: Component,
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "Quiz Rules",
    description: "Category round configurations",
    href: "/event-setups/quiz-categories",
    icon: Dices,
    color: "bg-rose-50 text-rose-600",
  },
  {
    title: "System Users",
    description: "Staff permissions and roles",
    href: "/settings/users",
    icon: UserCog2,
    color: "bg-[#F4F1E8] text-[#5E6654]",
  },
];

export default function SettingsBasePage() {
  return (
    <div className="space-y-6 px-2 py-2 sm:px-8 sm:py-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-3xl border border-[#D8D5C8] bg-white p-3 shadow-sm transition-all hover:border-[#34451F] hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl ${item.color} flex shrink-0 items-center justify-center transition-transform group-hover:scale-110`}>
                <item.icon className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-black leading-none tracking-tight text-[#20231A] uppercase">
                  {item.title}
                </span>
                <span className="mt-1.5 text-[11px] font-bold tracking-wider text-[#5E6654] uppercase opacity-60">
                  {item.description}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#D8D5C8] transition-colors group-hover:text-[#34451F]" />
          </Link>
        ))}
      </div>
    </div>
  );
}