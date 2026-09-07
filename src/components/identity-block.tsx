import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import {
  Beer,
  Brain,
  Disc3,
  Guitar,
  Mic,
  Mic2,
  PartyPopper,
  Pizza,
  Sparkles,
  Trophy,
  Tv,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

/* Screen 1 - who we are. Wordmark, "Bar & live music", a "What's on" rule,
   and the offer as glass signs. The signs come from the company tagline
   (comma-separated); icon, colour and the next matching event are derived
   from each phrase, so the owner controls the list from Settings. */

type Theme = {
  Icon: LucideIcon;
  colour: string;
  /* lowercase fragments matched against the tagline phrase AND event sub-type/title */
  match: string[];
};

const THEMES: Theme[] = [
  { Icon: Guitar, colour: "#F5C042", match: ["live music", "band", "live", "gig", "acoustic", "music"] },
  { Icon: Disc3, colour: "#E8742A", match: ["dj", "disco", "club"] },
  { Icon: Mic2, colour: "#4FC3E8", match: ["karaoke", "sing"] },
  { Icon: Mic, colour: "#4FBFA8", match: ["open mic", "openmic", "comedy", "spoken"] },
  { Icon: Brain, colour: "#C85BD9", match: ["quiz", "trivia"] },
  { Icon: Trophy, colour: "#C4B5FD", match: ["bingo", "tournament", "league", "pool", "darts"] },
  { Icon: Tv, colour: "#FF6B6B", match: ["sport", "football", "rugby", "boxing", "match", "fixture"] },
  { Icon: Beer, colour: "#F8C828", match: ["drink", "beer", "cocktail", "happy hour", "market", "late"] },
  { Icon: Pizza, colour: "#FFB347", match: ["pizza"] },
  { Icon: Utensils, colour: "#FFB347", match: ["food", "kitchen", "menu", "brunch"] },
  { Icon: PartyPopper, colour: "#F472B6", match: ["party", "birthday", "private", "hire", "celebration"] },
];
const FALLBACK: Theme = { Icon: Sparkles, colour: "#FFF4CC", match: [] };

function themeFor(phrase: string) {
  const p = phrase.toLowerCase();
  return THEMES.find((t) => t.match.some((m) => p.includes(m))) ?? FALLBACK;
}

function nextFor(theme: Theme, phrase: string, events: SerializedEvent[]) {
  const keys = theme.match.length ? theme.match : [phrase.toLowerCase()];
  return events.find((e) => {
    const hay = `${e.subType ?? ""} ${e.title}`.toLowerCase();
    return keys.some((m) => hay.includes(m));
  });
}

function whenLabel(e: SerializedEvent, todayStr: string) {
  if (e.date === todayStr) return "Tonight";
  return format(parseDate(e.date), "EEE d MMM");
}

export function splitTagline(tagline: string | null | undefined) {
  return (tagline ?? "")
    .replace(/\.$/, "")
    .split(/,|·|\|/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export function IdentityBlock({
  events,
  todayStr,
  tagline,
  subtitle = "Bar & live music",
}: {
  events: SerializedEvent[];
  todayStr: string;
  tagline: string | null;
  subtitle?: string;
}) {
  const phrases = splitTagline(tagline);
  const signs = (phrases.length ? phrases : ["Live music", "DJ sets", "Karaoke", "Quiz night"]).map((label) => {
    const theme = themeFor(label);
    return { label, ...theme, next: nextFor(theme, label, events) };
  });

  return (
    <section
      aria-labelledby="identity-heading"
      className="mx-auto flex w-full max-w-400 flex-col items-center px-4 text-center sm:px-6 lg:px-10"
    >
      {/* Wordmark + subtitle */}
      <h1 id="identity-heading" className="m-0 flex flex-col items-center gap-2.5">
        <Image
          src="/CompanyName.png"
          alt="Don Fenticas"
          width={869}
          height={176}
          priority
          className="animate-reveal h-12 w-auto object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] sm:h-14 lg:h-16"
        />
        <span className="animate-reveal font-bold text-[10px] tracking-[0.42em] text-ink-2 uppercase [animation-delay:120ms] sm:text-[11px]">
          {subtitle}
        </span>
      </h1>

      {/* rule · WHAT'S ON · rule */}
      <p className="mt-7 flex w-full max-w-md items-center gap-4 sm:mt-9" aria-hidden="true">
        <span className="ad-rule-in h-px flex-1 origin-right bg-linear-to-r from-transparent to-white/45" />
        <span className="flex font-bold text-[12px] leading-none tracking-[0.4em] text-ink uppercase sm:text-[13px]">
          {Array.from("what's on").map((ch, i) => (
            <span
              key={i}
              style={{ "--i": i + 4 } as React.CSSProperties}
              className={cn("ad-letter inline-block", ch === " " && "w-[0.5em]")}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </span>
        <span className="ad-rule-in h-px flex-1 origin-left bg-linear-to-l from-transparent to-white/45" />
      </p>

      {/* Glass signs: 2-up on phones (odd one centred), 3 + 2 centred from sm */}
      <ul className="mt-5 grid w-full grid-cols-2 gap-3 sm:mt-6 sm:flex sm:max-w-2xl sm:flex-wrap sm:justify-center sm:gap-4 [&>li:last-child:nth-child(odd)]:col-span-2 [&>li:last-child:nth-child(odd)]:mx-auto [&>li:last-child:nth-child(odd)]:w-[calc(50%-0.375rem)] sm:[&>li:last-child:nth-child(odd)]:mx-0 sm:[&>li:last-child:nth-child(odd)]:w-auto">
        {signs.map(({ label, colour, Icon, next }) => {
          const on = next?.date === todayStr;
          return (
            <li key={label} style={{ "--g": colour } as React.CSSProperties} className="sm:w-44 lg:w-48">
              <Link
                href={next ? `/whats-on/${next.id}` : "/whats-on"}
                aria-label={`${label}${on ? " - on tonight" : next ? ` - next ${whenLabel(next, todayStr)}: ${next.title}` : ""}`}
                className={cn(
                  "ad-sign flex min-h-11 items-center justify-center gap-2 px-[15px] font-extrabold text-[11px] leading-none tracking-[0.11em] uppercase active:scale-[0.97] sm:min-h-12 sm:text-[12px]",
                  on && "ad-sign-on"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" aria-hidden="true" strokeWidth={2.2} />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
