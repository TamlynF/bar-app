export type WeeklyListing = {
  key: "quiz" | "karaoke" | "live";
  day: string;
  title: string;
  time: string;
  href: string;
};

export const WEEKLY_LISTINGS: WeeklyListing[] = [
  { key: "quiz", day: "Thu", title: "Pub quiz", time: "9pm", href: "/book/quiz" },
  { key: "karaoke", day: "Fri", title: "Karaoke", time: "8pm", href: "/whats-on" },
  { key: "live", day: "Sat", title: "Live + DJ", time: "8pm", href: "/whats-on" },
];

export const PRIVATE_HIRE_HREF = "/book/private";
