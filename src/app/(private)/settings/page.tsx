import React from "react";
import Link from "next/link";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Tags, 
  UserCircle, 
  Users, 
  Shield, 
  ChevronRight, 
  BrainCircuit,
  Grid2X2,
  CalendarCogIcon,
  Component,
  Dices,
  BookUser,
  Medal,
  UserCog2
} from "lucide-react";

const settingsItems = [
  {
    title: "Events",
    description: "Schedule and manage dates",
    href: "/settings/events",
    icon: CalendarCogIcon,
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    title: "Event Categories",
    description: "Categories and requirements",
    href: "/settings/event-types",
    icon: Component,
    color: "bg-purple-500/10 text-purple-600",
  },
    {
    title: "Quiz Rules",
    description: "Category round configurations",
    href: "/settings/quiz-categories",
    icon: Dices,
    color: "bg-rose-500/10 text-rose-600",
  },
  {
    title: "Guests",
    description: "Database and contact info",
    href: "/settings/customers",
    icon: BookUser,
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    title: "Teams",
    description: "Leaderboards and history",
    href: "/settings/teams",
    icon: Medal,
    color: "bg-indigo-500/10 text-indigo-600",
  },
    {
    title: "Floor Plan",
    description: "Floor plans and capacities",
    href: "/settings/tables",
    icon: Grid2X2,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    title: "System Users",
    description: "Staff permissions and roles",
    href: "/settings/users",
    icon: UserCog2,
    color: "bg-slate-500/10 text-slate-600",
  },
];

export default function SettingsBasePage() {
  return (
    <div className="p-2 sm:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between p-3 bg-white border border-[#E6DFC8] rounded-3xl shadow-sm hover:border-[#26300D] hover:shadow-md transition-all active:scale-[0.98]"
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
            <ChevronRight className="w-5 h-5 text-[#E6DFC8] group-hover:text-[#26300D] transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}