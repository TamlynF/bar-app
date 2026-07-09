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
    title: "Guests",
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
    color: "bg-[#F7F4EA] text-[#5F624F]",
  },
];

export default function SettingsBasePage() {
  return (
    <div className="space-y-6 px-2 py-0 py-2 sm:px-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {settingsItems.map((item) => (
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