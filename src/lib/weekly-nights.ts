export type WeeklyNight = {
  key: "thu" | "fri" | "sat";
  day: string;
  dayShort: string;
  title: string;
  meta: string;
  metaShort: string;
  bookable: boolean;
  bookLabel: string | null;
};

export const WEEKLY_NIGHTS: WeeklyNight[] = [
  {
    key: "thu",
    day: "Thursday",
    dayShort: "Thu",
    title: "Quiz night",
    meta: "9pm · free entry · £10 pizza for teams",
    metaShort: "9pm · free entry",
    bookable: true,
    bookLabel: "Book for the quiz",
  },
  {
    key: "fri",
    day: "Friday",
    dayShort: "Fri",
    title: "Karaoke",
    meta: "From 8pm · £15 pitchers till 9pm",
    metaShort: "From 8pm",
    bookable: false,
    bookLabel: null,
  },
  {
    key: "sat",
    day: "Saturday",
    dayShort: "Sat",
    title: "Live band, then DJ",
    meta: "Band from 8pm · DJ set after till 2am",
    metaShort: "Band 8pm · DJ after",
    bookable: false,
    bookLabel: null,
  },
];
