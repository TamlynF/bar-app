export type WeeklyListing = {
  key: "quiz" | "karaoke" | "live";
  day: string;
  dayKey: "thursday" | "friday" | "saturday";
  title: string;
  time: string;
  href: string;
};

export const WEEKLY_LISTINGS: WeeklyListing[] = [
  { key: "quiz", day: "Thu", dayKey: "thursday", title: "Quiz Thursdays", time: "9pm", href: "/book/quiz" },
  { key: "karaoke", day: "Fri", dayKey: "friday", title: "World Famous Karaoke", time: "8pm", href: "/whats-on" },
  { key: "live", day: "Sat", dayKey: "saturday", title: "Live Band + DJ Set", time: "8pm", href: "/whats-on" },
];
