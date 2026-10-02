export type WeeklyListing = {
  key: "quiz" | "karaoke" | "live";
  day: string;
  dayKey: "thursday" | "friday" | "saturday";
  title: string;
  time: string;
  href: string;
  accentText: string;
};

export const WEEKLY_LISTINGS: WeeklyListing[] = [
  {
    key: "quiz",
    day: "Thu",
    dayKey: "thursday",
    title: "Quiz Thursdays",
    time: "9pm",
    href: "/book/quiz",
    accentText: "text-[#5ED6F0]",
  },
  {
    key: "karaoke",
    day: "Fri",
    dayKey: "friday",
    title: "World Famous Karaoke",
    time: "8pm",
    href: "/whats-on",
    accentText: "text-[#FF8A80]",
  },
  {
    key: "live",
    day: "Sat",
    dayKey: "saturday",
    title: "Live Band + DJ Set",
    time: "8pm",
    href: "/whats-on",
    accentText: "text-gold",
  },
];
