import {
  BookUser,
  Building2,
  Camera,
  CandlestickChart,
  Component,
  Crown,
  Dices,
  Grid2X2,
  Guitar,
  History,
  Image as ImageIcon,
  Mail,
  Medal,
  ShoppingBag,
  Scale,
  Sparkles,
  TrendingUp,
  UserCog2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

/* The schedule is a destination, not a hub - the nav points straight at it. */
export const SCHEDULE_HREF = "/event-setups/events";

export const QUIZ_HUB_HREF = "/event-setups/quiz";

/* A single weekly read, not a section - /marketing redirects here. */
export const MARKET_TRENDS_ITEM: AdminNavItem = {
  label: "Market trends",
  href: "/marketing/trends",
  icon: TrendingUp,
  description: "Ideas, events and price-offs from venues near you",
};

export function isMarketTrendsPath(path: string): boolean {
  return path === "/marketing" || path.startsWith("/marketing/");
}

export const QUIZ_NAV_ITEMS: AdminNavItem[] = [
  {
    label: "Quiz history",
    href: "/event-setups/quiz-history",
    icon: Grid2X2,
    description: "Past rounds and questions",
  },
  {
    label: "Quiz categories",
    href: "/event-setups/quiz-categories",
    icon: Dices,
    description: "Category round configurations",
  },
  {
    label: "Leaderboard",
    href: "/event-setups/quiz-leaderboards",
    icon: Crown,
    description: "Season standings and scores",
  },
  {
    label: "Teams",
    href: "/settings/teams",
    icon: Medal,
    description: "Team profiles and history",
  },
];

export const SETTINGS_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Venue",
    items: [
      {
        label: "Company Information",
        href: "/settings/company",
        icon: Building2,
        description: "Business details, socials and venue layout",
      },
      {
        label: "Seating plan",
        href: "/settings/tables",
        icon: Grid2X2,
        description: "Floor plans and capacities",
      },
      {
        label: "Event categories",
        href: "/event-setups/event-types",
        icon: Component,
        description: "Categories and requirements",
      },
      {
        label: "Music acts",
        href: "/settings/music-acts",
        icon: Guitar,
        description: "Bands, DJs and performers",
      },
      {
        label: "Customers",
        href: "/settings/customers",
        icon: BookUser,
        description: "Database and contact info",
      },
      {
        label: "System users",
        href: "/settings/users",
        icon: UserCog2,
        description: "Staff permissions and roles",
      },
      {
        label: "Email templates",
        href: "/settings/email-templates",
        icon: Mail,
        description: "Wording of every automatic email",
      },
      {
        label: "AI settings",
        href: "/settings/ai",
        icon: Sparkles,
        description: "Which provider and model each part of the app uses",
      },
    ],
  },
  {
    label: "Website",
    items: [
      {
        label: "Menu",
        href: "/settings/menu",
        icon: UtensilsCrossed,
        description: "Categories and items",
      },
      {
        label: "Price rounds",
        href: "/settings/price-rounds",
        icon: Scale,
        description: "What the price page compares",
      },
      {
        label: "Drinks market",
        href: "/settings/market",
        icon: CandlestickChart,
        description: "Live price board for market nights",
      },
      {
        label: "Market history",
        href: "/settings/market/history",
        icon: History,
        description: "Price and stock changes from past market nights",
      },
      {
        label: "Specials",
        href: "/settings/specials",
        icon: Sparkles,
        description: "Drink deals and offers",
      },
      {
        label: "Merchandise",
        href: "/settings/merchandise",
        icon: ShoppingBag,
        description: "Products and pricing",
      },
      {
        label: "Promo content",
        href: "/settings/promo-content",
        icon: ImageIcon,
        description: "Homepage promo cards",
      },
      {
        label: "Gallery",
        href: "/settings/gallery",
        icon: Camera,
        description: "Photos and videos",
      },
    ],
  },
];

/* Routes whose content fills the window instead of sitting inside the standard
   7xl page frame. Both the private shell and the settings frame read this, so a
   wide route has to be released by one list rather than two. */
export const WIDE_PATHS: string[] = [
  "/event-bookings/music-bookings",
  "/event-bookings/private-bookings",
  "/marketing/trends",
  "/settings/company",
  "/settings/users",
  "/settings/customers",
  "/settings/music-acts",
  "/settings/merchandise",
  "/settings/promo-content",
  "/settings/gallery",
  "/settings/specials",
  "/settings/price-rounds",
  "/settings/market/history",
  "/event-setups/quiz-categories",
  "/event-setups/quiz-leaderboards",
  SCHEDULE_HREF,
];

/* Dynamic routes whose every child fills the window. */
export const WIDE_PREFIXES: string[] = ["/settings/market/"];

export function isWidePath(pathname: string | null | undefined): boolean {
  const path = pathname ?? "";
  return WIDE_PATHS.includes(path) || WIDE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export const SETTINGS_NAV_ITEMS: AdminNavItem[] = SETTINGS_NAV_GROUPS.flatMap((group) => group.items);

export const WEBSITE_NAV_ITEMS: AdminNavItem[] =
  SETTINGS_NAV_GROUPS.find((group) => group.label === "Website")?.items ?? [];

/* Teams lives under /settings but belongs to the quiz section, so quiz
   ownership is decided by this list rather than by URL prefix. */
export const QUIZ_PATHS: string[] = [
  QUIZ_HUB_HREF,
  "/event-setups/quiz-generator",
  ...QUIZ_NAV_ITEMS.map((item) => item.href),
];

export function isQuizPath(path: string): boolean {
  return QUIZ_PATHS.some((quizPath) => path === quizPath || path.startsWith(`${quizPath}/`));
}

export function isSchedulePath(path: string): boolean {
  return path === "/event-setups" || path === SCHEDULE_HREF || path.startsWith(`${SCHEDULE_HREF}/`);
}

/* Event categories sits under /event-setups and Teams under /settings, so
   section ownership comes from the lists above rather than the URL prefix. */
export function isSettingsPath(path: string): boolean {
  if (isQuizPath(path)) return false;
  if (path === "/settings" || path.startsWith("/settings/")) return true;
  return SETTINGS_NAV_ITEMS.some((item) => path === item.href || path.startsWith(`${item.href}/`));
}
