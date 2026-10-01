export type VenueOffering = {
  key: "quiz" | "karaoke" | "live" | "private";
  when: string;
  title: string;
  detail: string;
  href: string;
};

export const VENUE_OFFERINGS: VenueOffering[] = [
  {
    key: "quiz",
    when: "Every Thursday",
    title: "Pub quiz",
    detail: "9pm · free entry · book your team",
    href: "/book/quiz",
  },
  {
    key: "karaoke",
    when: "Every Friday",
    title: "Karaoke",
    detail: "From 8pm · walk in · £15 pitchers till 9pm",
    href: "/whats-on",
  },
  {
    key: "live",
    when: "Every Saturday",
    title: "Live music & DJ sets",
    detail: "Band from 8pm · DJ after till 2am",
    href: "/whats-on",
  },
  {
    key: "private",
    when: "Any night",
    title: "Private hire",
    detail: "Parties, birthdays and functions",
    href: "/book/private",
  },
];
