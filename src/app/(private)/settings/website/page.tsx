import React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Sparkles,
  UtensilsCrossed,
  ImageIcon,
  Camera,
} from "lucide-react";

const websiteItems = [
  {
    title: "Menu",
    description: "Categories, items, and prices",
    href: "/settings/menu",
    icon: UtensilsCrossed,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "Specials",
    description: "Deals and offers on the homepage",
    href: "/settings/specials",
    icon: Sparkles,
    color: "bg-orange-50 text-orange-600",
  },
  {
    title: "Promo Content",
    description: "Social media posts and event promos",
    href: "/settings/promo-content",
    icon: ImageIcon,
    color: "bg-pink-50 text-pink-600",
  },
  {
    title: "Gallery",
    description: "Upload and manage gallery photos",
    href: "/settings/gallery",
    icon: Camera,
    color: "bg-sky-50 text-sky-600",
  },
];

export default function WebsiteBasePage() {
  return (
    <div className="space-y-6 px-2 py-2 sm:px-8 sm:py-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {websiteItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-3xl border border-[#E6DFC8] bg-white p-3 shadow-sm transition-all hover:border-[#5C4033] hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl ${item.color} flex shrink-0 items-center justify-center transition-transform group-hover:scale-110`}>
                <item.icon className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-black leading-none tracking-tight text-[#1F1F1A] uppercase">
                  {item.title}
                </span>
                <span className="mt-1.5 text-[11px] font-bold tracking-wider text-[#5F624F] uppercase opacity-60">
                  {item.description}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#E6DFC8] transition-colors group-hover:text-[#5C4033]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
