import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Instagram,
  Music,
  Mic,
  PartyPopper,
  ExternalLink,
  Clock,
  Sparkles,
  ChevronRight,
  Flame,
  MapPin,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";

export const metadata = {
  title: "Don Fenticas | Bar & Live Music Venue",
  description:
    "Don Fenticas, Regent Street, Hinckley — quiz nights, live music, karaoke, and unforgettable nights out.",
};

export const revalidate = 300;

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

type EventType = {
  type: string;
  sub_type: string;
  badge_color: string | null;
  type_color: string | null;
};

type HomeEvent = {
  id: number;
  date: string;
  start_time: string | null;
  title: string | null;
  description: string | null;
  external_link: string | null;
  event_types: EventType | null;
};

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const [{ data: rawEvents }, { data: specials }, { data: promos }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, date, start_time, title, description, external_link, event_types(type, sub_type, badge_color, type_color)"
        )
        .gte("date", todayStr)
        .eq("is_active", true)
        .order("date", { ascending: true })
        .limit(40),
      supabase
        .from("specials")
        .select("*")
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${todayStr}`)
        .order("display_order", { ascending: true }),
      supabase
        .from("promo_content")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

  const events: HomeEvent[] = (rawEvents ?? []).map((e) => {
    const raw = e as unknown as HomeEvent & {
      event_types: EventType | EventType[] | null;
    };
    return {
      ...raw,
      event_types: Array.isArray(raw.event_types)
        ? raw.event_types[0]
        : raw.event_types,
    };
  });

  const todayEvents = events.filter((e) => e.date === todayStr);
  const thisWeek = getThisWeekEvents(events);
  const restOfMonth = getRestOfMonthEvents(events, thisWeek);

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-white selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased overflow-x-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      {/* ─── Top Nav ──────────────────────────────────────────────────── */}
      <PublicNav />

      {/* ─── Hero — compact, identity + immediate CTA ─────────────────── */}
      <HeroSection todayEvent={todayEvents[0]} nextEvent={events[0]} />

      {/* ─── What's On — THE PRIORITY SECTION ─────────────────────────── */}
      <WhatsOnSection
        today={todayEvents}
        thisWeek={thisWeek}
        restOfMonth={restOfMonth}
      />

      {/* ─── Specials ─────────────────────────────────────────────────── */}
      {specials && specials.length > 0 && (
        <SpecialsSection specials={specials} />
      )}

      {/* ─── Gallery / Socials ────────────────────────────────────────── */}
      {promos && promos.length > 0 && <PromoSection promos={promos} />}

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <SiteFooter />
    </main>
  );
}


// ───────────────────────────────────────────────────────────────────────────
// Hero — tight, identity above the fold, immediate "tonight" CTA if applicable
// ───────────────────────────────────────────────────────────────────────────

function HeroSection({
  todayEvent,
  nextEvent,
}: {
  todayEvent: HomeEvent | undefined;
  nextEvent: HomeEvent | undefined;
}) {
  const featured = todayEvent ?? nextEvent;
  const isTonight = !!todayEvent;

  return (
    <section className="relative pt-20 pb-10 sm:pt-24 sm:pb-12 px-4 overflow-hidden">
      {/* Atmospheric glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#FDCC4B]/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -right-20 w-[300px] h-[300px] bg-[#7A1F1F]/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-md mx-auto text-center">
        {/* Location badge */}
        <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-4">
          <MapPin className="w-3 h-3 text-[#FDCC4B]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-300">
            Regent Street, Hinckley
          </span>
        </div>

        {/* Logo */}
        <Image
          src="/CompanyName.png"
          alt="Don Fenticas"
          width={500}
          height={130}
          className="w-[75%] max-w-[280px] mx-auto h-auto object-contain drop-shadow-[0_8px_40px_rgba(253,204,75,0.2)]"
          priority
        />

        {/* Tagline */}
        <p className="text-stone-300 text-sm font-medium mt-4 leading-relaxed max-w-xs mx-auto">
          Live music, quiz nights, karaoke, and the best nights out in town.
        </p>

        {/* Vibe pills */}
        <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
          <VibePill icon={Music} label="Live Bands" />
          <VibePill icon={Mic} label="Karaoke" />
          <VibePill icon={PartyPopper} label="Quiz Nights" />
        </div>

        {/* Tonight / Next CTA — the most important above-the-fold action */}
        {featured && (
          <Link
            href={getEventLink(featured).href}
            target={getEventLink(featured).external ? "_blank" : undefined}
            className="group mt-7 flex items-center gap-3 bg-gradient-to-r from-[#FDCC4B] to-[#e5b843] text-[#1a2008] rounded-2xl px-4 py-3.5 shadow-[0_10px_30px_-5px_rgba(253,204,75,0.4)] active:scale-[0.98] transition-all"
          >
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isTonight ? "bg-[#FF6B35]" : "bg-[#1a2008]/15"}`}>
              {isTonight ? (
                <Flame className="w-5 h-5 text-white drop-shadow" />
              ) : (
                <Calendar className="w-5 h-5 text-[#1a2008]" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">
                {isTonight ? "Tonight" : `Next — ${formatDateShort(featured.date)}`}
              </p>
              <p className="text-sm font-black uppercase tracking-tight truncate mt-0.5">
                {featured.title ?? "Event"}
                {featured.start_time && (
                  <span className="font-bold opacity-60 ml-1.5 normal-case">
                    · {formatTime(featured.start_time)}
                  </span>
                )}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 group-active:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>
    </section>
  );
}

function VibePill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
      <Icon className="w-3 h-3 text-[#FDCC4B]" />
      <span className="text-[10px] font-black uppercase tracking-wide text-stone-200">
        {label}
      </span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// What's On — the priority section. Today first, then this week, then later.
// ───────────────────────────────────────────────────────────────────────────

function WhatsOnSection({
  today,
  thisWeek,
  restOfMonth,
}: {
  today: HomeEvent[];
  thisWeek: HomeEvent[];
  restOfMonth: HomeEvent[];
}) {
  const hasAnything = today.length > 0 || thisWeek.length > 0 || restOfMonth.length > 0;

  return (
    <section id="whats-on" className="px-4 py-10 sm:py-16">
      <div className="max-w-3xl mx-auto">
        <SectionHeader
          eyebrow="What's On"
          title="The Schedule"
          subtitle="Live music, quizzes, bingo, themed nights"
          color="gold"
        />

        {!hasAnything && (
          <div className="mt-8 text-center py-12 bg-white/[0.03] border border-white/5 rounded-2xl">
            <Calendar className="w-8 h-8 text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500 text-sm font-bold">
              No upcoming events right now
            </p>
            <p className="text-stone-600 text-xs mt-1">Check back soon</p>
          </div>
        )}

        {/* TODAY — neon-accented if there's anything on tonight */}
        {today.length > 0 && (
          <div className="mt-6 space-y-2">
            <DaySubheader label="Tonight" highlight />
            <div className="space-y-2">
              {today.map((ev) => (
                <EventCard key={ev.id} event={ev} emphasis />
              ))}
            </div>
          </div>
        )}

        {/* THIS WEEK */}
        {thisWeek.length > 0 && (
          <div className="mt-6 space-y-2">
            <DaySubheader label="This Week" />
            <div className="space-y-2">
              {thisWeek.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        )}

        {/* LATER */}
        {restOfMonth.length > 0 && (
          <div className="mt-6 space-y-2">
            <DaySubheader label="Coming Up" />
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
              {restOfMonth.map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function DaySubheader({
  label,
  highlight,
}: {
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      {highlight && (
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex w-full h-full bg-[#FF6B35] rounded-full animate-ping opacity-75" />
          <span className="relative inline-flex w-2 h-2 bg-[#FF6B35] rounded-full" />
        </span>
      )}
      <span
        className={`text-[10px] font-black uppercase tracking-[0.25em] ${
          highlight ? "text-[#FF6B35]" : "text-stone-500"
        }`}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-stone-800/50" />
    </div>
  );
}

// Card layout — used for tonight & this week (more visual weight)
function EventCard({
  event,
  emphasis,
}: {
  event: HomeEvent;
  emphasis?: boolean;
}) {
  const link = getEventLink(event);
  const dateObj = new Date(event.date + "T00:00:00");
  const eventType = event.event_types;
  const color = eventType?.type_color || eventType?.badge_color || "#FDCC4B";

  const content = (
    <div
      className={`group flex items-center gap-3 rounded-2xl p-3 sm:p-4 transition-all active:scale-[0.99] ${
        emphasis
          ? "bg-linear-to-br from-[#FF6B35]/10 to-[#7A1F1F]/10 border border-[#FF6B35]/30"
          : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07]"
      }`}
    >
      {/* Date block */}
      <div
        className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${
          emphasis ? "bg-[#FF6B35] text-white" : "bg-white/5 border border-white/10 text-[#FDCC4B]"
        }`}
      >
        <span className="text-[9px] font-black uppercase tracking-wider opacity-80">
          {dateObj.toLocaleDateString("en-GB", { weekday: "short" })}
        </span>
        <span className="text-xl font-black leading-none tabular-nums">
          {dateObj.getDate()}
        </span>
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm sm:text-base font-black uppercase tracking-tight text-white truncate">
          {event.title || "Event"}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {event.start_time && (
            <span className="inline-flex items-center gap-1 text-[11px] text-stone-400 font-bold">
              <Clock className="w-3 h-3" />
              {formatTime(event.start_time)}
            </span>
          )}
          {eventType && (
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full event-type-badge bg-[var(--badge-bg)] text-[var(--badge-color)] border border-[var(--badge-border)]"
              style={{ "--badge-bg": `${color}25`, "--badge-color": color, "--badge-border": `${color}40` } as React.CSSProperties}
            >
              {eventType.sub_type || eventType.type}
            </span>
          )}
        </div>
      </div>

      {/* External icon or chevron */}
      {link.external ? (
        <ExternalLink className="w-4 h-4 shrink-0 text-stone-500" />
      ) : (
        <ChevronRight className="w-4 h-4 shrink-0 text-stone-500 group-active:translate-x-0.5 transition-transform" />
      )}
    </div>
  );

  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <Link href={link.href}>{content}</Link>
  );
}

// Compact row layout — used for "coming up" later in month
function EventRow({ event }: { event: HomeEvent }) {
  const link = getEventLink(event);
  const dateObj = new Date(event.date + "T00:00:00");
  const eventType = event.event_types;
  const color = eventType?.type_color || eventType?.badge_color || "#FDCC4B";

  const content = (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group">
      <span className="shrink-0 text-[11px] font-black uppercase tracking-wider text-[#FDCC4B] tabular-nums w-20">
        {dateObj.toLocaleDateString("en-GB", { weekday: "short" })}{" "}
        {dateObj.getDate()}
      </span>
      <span className="text-stone-700 shrink-0">·</span>
      <span className="flex-1 min-w-0 text-xs sm:text-sm font-black uppercase tracking-tight text-white truncate">
        {event.title || "Event"}
        {event.start_time && (
          <span className="text-stone-500 font-bold ml-2 normal-case">
            {formatTime(event.start_time)}
          </span>
        )}
      </span>
      {eventType && (
        <span
          className="hidden sm:inline text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 bg-[var(--badge-bg)] text-[var(--badge-color)] border border-[var(--badge-border)]"
          style={{ "--badge-bg": `${color}20`, "--badge-color": color, "--badge-border": `${color}40` } as React.CSSProperties}
        >
          {eventType.sub_type || eventType.type}
        </span>
      )}
      {link.external && (
        <ExternalLink className="w-3 h-3 shrink-0 text-stone-600" />
      )}
    </div>
  );

  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <Link href={link.href}>{content}</Link>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Specials — burgundy/red, sits visually below events
// ───────────────────────────────────────────────────────────────────────────

type Special = {
  id: number;
  title: string;
  description: string | null;
  badges: string[] | null;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
};

function SpecialsSection({ specials }: { specials: unknown[] }) {
  const list = specials as Special[];
  return (
    <section className="px-4 py-10 sm:py-16">
      <div className="max-w-3xl mx-auto">
        <SectionHeader
          eyebrow="Specials"
          title="Deals on the Bar"
          subtitle="Drink offers running this month"
          color="burgundy"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
          {list.map((sp) => (
            <div
              key={sp.id}
              className="bg-gradient-to-br from-[#7A1F1F]/15 to-[#1a2008] border border-[#7A1F1F]/30 rounded-2xl overflow-hidden hover:border-[#7A1F1F]/50 transition-all"
            >
              {sp.image_url && (
                <div className="relative h-40 bg-black/30">
                  <Image
                    src={sp.image_url}
                    alt={sp.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a2008] to-transparent" />
                </div>
              )}
              <div className="p-4">
                {(sp.badges || []).length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {sp.badges!.map((badge) => (
                      <span
                        key={badge}
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FF6B35]/15 border border-[#FF6B35]/30 text-[#FF6B35]"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
                <h3 className="text-white font-black text-base uppercase tracking-tight">
                  {sp.title}
                </h3>
                {sp.description && (
                  <p className="text-stone-400 text-xs leading-relaxed mt-1.5 line-clamp-3">
                    {sp.description}
                  </p>
                )}
                {(sp.start_date || sp.end_date) && (
                  <p className="text-stone-600 text-[10px] font-bold uppercase tracking-wide mt-3 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {sp.start_date && formatDateShort(sp.start_date)}
                    {sp.start_date && sp.end_date && " – "}
                    {sp.end_date && formatDateShort(sp.end_date)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Promo / Gallery snippet
// ───────────────────────────────────────────────────────────────────────────

type Promo = {
  id: number;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string;
  external_url: string | null;
};

function PromoSection({ promos }: { promos: unknown[] }) {
  const list = promos as Promo[];
  return (
    <section id="gallery" className="px-4 py-10 sm:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end justify-between">
          <SectionHeader
            eyebrow="Gallery"
            title="From the Bar"
            subtitle="Latest moments and posts"
            color="gold"
          />
          <Link
            href="/gallery"
            className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B] hover:text-white transition-colors mb-1 shrink-0 flex items-center gap-1"
          >
            View All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 mt-8 -mx-4 px-4 no-scrollbar">
          {list.map((p) => {
            const card = (
              <div className="snap-start shrink-0 w-[240px] sm:w-[280px] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all group">
                <div className="relative aspect-[4/5] bg-black/30">
                  {p.media_type === "video" ? (
                    <video
                      src={p.media_url}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={p.media_url}
                      alt={p.title}
                      fill
                      className="object-cover"
                      sizes="280px"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
                    <h4 className="text-white font-black text-sm uppercase tracking-tight line-clamp-2">
                      {p.title}
                    </h4>
                    {p.description && (
                      <p className="text-stone-300 text-[10px] mt-1 line-clamp-1">
                        {p.description}
                      </p>
                    )}
                  </div>
                  {p.external_url && (
                    <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <Instagram className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              </div>
            );

            return p.external_url ? (
              <a
                key={p.id}
                href={p.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="snap-start shrink-0"
              >
                {card}
              </a>
            ) : (
              <div key={p.id} className="snap-start shrink-0">
                {card}
              </div>
            );
          })}
        </div>

        {/* Instagram CTA */}
        <a
          href="https://www.instagram.com/donfenticas"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 mx-auto flex items-center justify-center gap-2 max-w-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-4 py-2.5 transition-colors"
        >
          <Instagram className="w-4 h-4 text-[#FDCC4B]" />
          <span className="text-xs font-black uppercase tracking-wide text-stone-200">
            @donfenticas
          </span>
        </a>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Footer
// ───────────────────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="px-4 py-10 border-t border-white/5 mt-4">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <Image
          src="/CompanyName.png"
          alt="Don Fenticas"
          width={140}
          height={36}
          className="h-6 w-auto mx-auto object-contain opacity-30"
        />
        <p className="text-[9px] text-stone-700 uppercase tracking-widest font-bold">
          Regent Street, Hinckley LE10 0BB
        </p>
        <p className="text-[8px] text-stone-800 uppercase tracking-widest font-bold">
          &copy; {new Date().getFullYear()} Don Fenticas &middot; Licensed Venue
          &middot; Please Drink Responsibly
        </p>
      </div>
    </footer>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Section header — colour-themed
// ───────────────────────────────────────────────────────────────────────────

const HEADER_COLORS = {
  gold: {
    bg: "bg-[#FDCC4B]/10",
    border: "border-[#FDCC4B]/20",
    text: "text-[#FDCC4B]",
  },
  burgundy: {
    bg: "bg-[#7A1F1F]/15",
    border: "border-[#7A1F1F]/30",
    text: "text-[#FF6B35]",
  },
  neon: {
    bg: "bg-[#FF6B35]/15",
    border: "border-[#FF6B35]/30",
    text: "text-[#FF6B35]",
  },
} as const;

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  color = "gold",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  color?: keyof typeof HEADER_COLORS;
}) {
  const c = HEADER_COLORS[color];
  return (
    <div className="text-center">
      <div
        className={`inline-flex items-center gap-2 ${c.bg} ${c.border} border rounded-full px-3 py-1 mb-3`}
      >
        <Sparkles className={`w-3 h-3 ${c.text}`} />
        <span
          className={`text-[10px] font-black uppercase tracking-[0.25em] ${c.text}`}
        >
          {eyebrow}
        </span>
      </div>
      <h2 className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tighter">
        {title}
      </h2>
      {subtitle && (
        <p className="text-stone-500 text-xs sm:text-sm mt-2 font-medium">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function getThisWeekEvents(events: HomeEvent[]): HomeEvent[] {
  const todayStr = new Date().toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00");
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const endStr = endOfWeek.toISOString().split("T")[0];
  return events.filter((e) => e.date > todayStr && e.date <= endStr);
}

function getRestOfMonthEvents(
  events: HomeEvent[],
  thisWeek: HomeEvent[]
): HomeEvent[] {
  const todayStr = new Date().toISOString().split("T")[0];
  const weekIds = new Set(thisWeek.map((e) => e.id));
  return events
    .filter((e) => e.date > todayStr && !weekIds.has(e.id))
    .slice(0, 8);
}

function getEventLink(ev: {
  external_link: string | null;
  event_types: { type: string; sub_type: string } | null;
}): { href: string; external: boolean } {
  if (ev.external_link) return { href: ev.external_link, external: true };
  const subType = ev.event_types?.sub_type?.toLowerCase() ?? "";
  if (subType.includes("quiz")) return { href: "/book/quiz", external: false };
  if (subType.includes("bingo")) return { href: "/book/bingo", external: false };
  return { href: "/book", external: false };
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}${m !== "00" ? `:${m}` : ""}${ampm}`;
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}