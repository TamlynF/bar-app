import React from "react";
import Link from "next/link";
import {
  ChevronRight,
  CalendarDays,
  Component,
  Grid2X2,
  Dices,
  Crown,
  Medal,
} from "lucide-react";

type EventSetupItem = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const primaryItems: EventSetupItem[] = [
  {
    title: "Event List",
    description: "Schedule and event details",
    href: "/event-setups/events",
    icon: CalendarDays,
    color: "bg-amber-50 text-amber-600",
  },
  {
    title: "Event Categories",
    description: "Categories and requirements",
    href: "/event-setups/event-types",
    icon: Component,
    color: "bg-indigo-50 text-indigo-600",
  },
];

const quizItems: EventSetupItem[] = [
  {
    title: "Quiz History",
    description: "Past rounds and questions",
    href: "/event-setups/quiz-history",
    icon: Grid2X2,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Quiz Rules",
    description: "Category round configurations",
    href: "/event-setups/quiz-categories",
    icon: Dices,
    color: "bg-rose-50 text-rose-600",
  },
  {
    title: "Leaderboard",
    description: "Season standings and scores",
    href: "/event-setups/quiz-leaderboards",
    icon: Crown,
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    title: "Teams",
    description: "Leaderboards and history",
    href: "/settings/teams",
    icon: Medal,
    color: "bg-indigo-50 text-indigo-600",
  },
];

function EventSetupTile({ item }: { item: EventSetupItem }) {
  return (
    <Link
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
  );
}

export default function EventSetupsBasePage() {
  return (
    <div className="space-y-6 px-2 py-2 sm:px-8 sm:py-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {primaryItems.map((item) => (
          <EventSetupTile key={item.href} item={item} />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="px-1 font-black text-[11px] tracking-widest text-[#5E6654] uppercase opacity-70">
          Quiz
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quizItems.map((item) => (
            <EventSetupTile key={item.href} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
