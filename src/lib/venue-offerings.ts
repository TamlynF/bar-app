export type WeeklyListing = {
  key: "quiz" | "karaoke" | "live";
  day: string;
  dayKey: "thursday" | "friday" | "saturday";
  title: string;
  shortTitle: string;
  time: string;
  href: string;
  actionLabel: string;
  accentText: string;
  accentBg: string;
};

export const WEEKLY_LISTINGS: WeeklyListing[] = [
  {
    key: "quiz",
    day: "Thu",
    dayKey: "thursday",
    title: "Quiz Thursdays",
    shortTitle: "Quiz",
    time: "9pm",
    href: "/book/quiz",
    actionLabel: "Book",
    accentText: "text-[#5ED6F0]",
    accentBg: "bg-[#5ED6F0]",
  },
  {
    key: "karaoke",
    day: "Fri",
    dayKey: "friday",
    title: "World Famous Karaoke",
    shortTitle: "Karaoke",
    time: "8pm",
    href: "/whats-on",
    actionLabel: "Info",
    accentText: "text-[#FF8A80]",
    accentBg: "bg-[#FF8A80]",
  },
  {
    key: "live",
    day: "Sat",
    dayKey: "saturday",
    title: "Live Band + DJ Set",
    shortTitle: "Live + DJ",
    time: "8pm",
    href: "/whats-on",
    actionLabel: "Gigs",
    accentText: "text-gold",
    accentBg: "bg-gold",
  },
];
