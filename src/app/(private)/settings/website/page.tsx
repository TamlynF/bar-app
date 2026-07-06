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
    <div className="px-2 py-2 sm:px-8 sm:py-0 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {websiteItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between p-3 bg-white border border-[#E6DFC8] rounded-3xl shadow-sm hover:border-[#5C4033] hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-[#1F1F1A] uppercase tracking-tight leading-none">
                  {item.title}
                </span>
                <span className="text-[11px] text-[#5F624F] font-bold opacity-60 uppercase mt-1.5 tracking-wider">
                  {item.description}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#E6DFC8] group-hover:text-[#5C4033] transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
