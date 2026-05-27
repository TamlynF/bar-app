import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Clock,
  ChevronDown,
  Instagram,
  Music,
  Mic,
  PartyPopper,
  ExternalLink,
  User,
} from "lucide-react";

export const metadata = {
  title: "Don Fenticas | Bar & Live Music Venue",
  description:
    "Don Fenticas, Regent Street, Hinckley — quiz nights, live music, karaoke, and unforgettable nights out.",
};

export const revalidate = 300;

export default async function HomePage() {
  const supabase = await createClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const [{ data: events }, { data: specials }, { data: promos }] =
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

  type EventType = {
    type: string;
    sub_type: string;
    badge_color: string | null;
    type_color: string | null;
  };
  type ProcessedEvent = {
    id: number;
    date: string;
    start_time: string | null;
    title: string | null;
    description: string | null;
    external_link: string | null;
    event_types: EventType | null;
  };

  const processedEvents: ProcessedEvent[] = (events ?? []).map((e) => {
    const raw = e as unknown as {
      id: number;
      date: string;
      start_time: string | null;
      title: string | null;
      description: string | null;
      external_link: string | null;
      event_types: EventType | EventType[] | null;
    };
    return {
      ...raw,
      event_types: Array.isArray(raw.event_types)
        ? raw.event_types[0]
        : raw.event_types,
    };
  });

  const weekGroups = groupEventsByWeek(processedEvents);

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-white selection:bg-[#fdcc4b] selection:text-[#1a2008] antialiased overflow-x-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a2008]/90 backdrop-blur-xl border-b border-[#FDCC4B]/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-2 sm:px-4 py-2.5">
          <Link href="/" className="shrink-0">
            <Image
              src="/CompanyName.png"
              alt="Don Fenticas"
              width={120}
              height={32}
              className="h-7 sm:h-8 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/book"
              className="bg-[#FDCC4B] text-[#1a2008] text-[9px] sm:text-xs font-black uppercase tracking-wide px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-[#e5b843] transition-colors active:scale-95"
            >
              Book Now
            </Link>
            <NavLink href="/menu">Menu</NavLink>
            <NavLink href="/#gallery">Gallery</NavLink>
            <NavLink href="/contact">Contact Us</NavLink>
            {/* Staff Login: text on desktop, user icon on mobile */}
            <Link
              href="/login"
              className="inline-flex items-center text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2 sm:px-3 py-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="hidden sm:inline">Staff Login</span>
              <User className="w-3.5 h-3.5 sm:hidden" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-[70vh] sm:min-h-[80vh] flex flex-col items-center justify-center px-6 pt-20 pb-12">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FDCC4B]/8 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative text-center w-full max-w-md mx-auto">
          <Image
            src="/CompanyName.png"
            alt="Don Fenticas"
            width={500}
            height={130}
            className="w-[80%] max-w-[320px] mx-auto h-auto object-contain drop-shadow-[0_8px_40px_rgba(253,204,75,0.15)]"
            priority
          />

          <p className="text-[#FDCC4B]/70 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] mt-5">
            Regent Street, Hinckley
          </p>

          <p className="text-stone-300 text-sm sm:text-base font-medium mt-4 leading-relaxed max-w-xs mx-auto">
            Live music, quiz nights, karaoke, and the best nights out in town.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <FeaturePill icon={Music} label="Live Bands" />
            <FeaturePill icon={Mic} label="Karaoke" />
            <FeaturePill icon={PartyPopper} label="Quiz Nights" />
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-5 h-5 text-[#FDCC4B]/30" />
        </div>
      </section>

      {/* ── Specials ── */}
      {specials && specials.length > 0 && (
        <section className="px-4 py-14 sm:py-20">
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              title="Specials"
              subtitle="Deals and offers you won't want to miss"
              color="red"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
              {specials.map((raw) => {
                const sp = raw as unknown as {
                  id: number;
                  title: string;
                  description: string | null;
                  badges: string[];
                  image_url: string | null;
                  start_date: string | null;
                  end_date: string | null;
                };
                return (
                  <div
                    key={sp.id}
                    className="bg-white/[0.04] border border-white/[0.06] rounded-2xl overflow-hidden hover:bg-white/[0.07] transition-all duration-300"
                  >
                    {sp.image_url && (
                      <div className="relative h-44 bg-black/30">
                        <Image
                          src={sp.image_url}
                          alt={sp.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      {(sp.badges || []).length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {sp.badges.map((badge) => (
                            <span
                              key={badge}
                              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                      <h3 className="text-white font-black text-sm uppercase tracking-tight">
                        {sp.title}
                      </h3>
                      {sp.description && (
                        <p className="text-stone-400 text-xs leading-relaxed mt-1.5 line-clamp-3">
                          {sp.description}
                        </p>
                      )}
                      {(sp.start_date || sp.end_date) && (
                        <p className="text-stone-600 text-[10px] font-bold uppercase tracking-wide mt-2.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {sp.start_date && formatDateShort(sp.start_date)}
                          {sp.start_date && sp.end_date && " – "}
                          {sp.end_date && formatDateShort(sp.end_date)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── What's On ── */}
      <section id="whats-on" className="px-4 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            title="What's On"
            subtitle="Upcoming events at Don Fenticas"
            color="yellow"
          />

          {weekGroups.length > 0 ? (
            <div className="mt-8 bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              {/* Month label */}
              <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-[#FDCC4B] font-black text-lg sm:text-xl uppercase tracking-tight text-center">
                  {getMonthLabel(processedEvents)}
                </h3>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {weekGroups.map((group, gi) => (
                  <div key={gi} className="py-2">
                    {group.events.map((ev) => {
                      const link = getEventLink(ev);
                      const dateObj = new Date(ev.date + "T00:00:00");
                      const dayNum = dateObj.getDate();
                      const daySuffix = getOrdinalSuffix(dayNum);
                      const weekday = dateObj
                        .toLocaleDateString("en-GB", { weekday: "short" })
                        .toUpperCase();
                      const eventType = ev.event_types;
                      const color = eventType?.type_color || eventType?.badge_color || "#FDCC4B";

                      const content = (
                        <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 hover:bg-white/[0.04] transition-colors cursor-pointer">
                          {/* Date */}
                          <div className="shrink-0 w-16 sm:w-20 text-right">
                            <span className="text-[#FDCC4B] text-[11px] sm:text-xs font-black uppercase tracking-wide">
                              {weekday} {dayNum}
                              <sup className="text-[8px]">{daySuffix}</sup>
                            </span>
                          </div>

                          {/* Dash */}
                          <span className="text-stone-600 text-xs font-bold shrink-0">-</span>

                          {/* Title */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-xs sm:text-sm font-black uppercase tracking-tight truncate"
                              style={{ color }}
                            >
                              {ev.title || "Event"}
                              {ev.start_time && (
                                <span className="text-stone-500 text-[10px] font-bold ml-2 normal-case">
                                  {formatTime(ev.start_time)}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Badge + external icon */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {eventType && (
                              <span
                                className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${color}20`,
                                  color,
                                  borderWidth: 1,
                                  borderColor: `${color}40`,
                                }}
                              >
                                {eventType.sub_type || eventType.type}
                              </span>
                            )}
                            {link.external && (
                              <ExternalLink className="w-3 h-3 text-stone-600" />
                            )}
                          </div>
                        </div>
                      );

                      if (link.external) {
                        return (
                          <a
                            key={ev.id}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {content}
                          </a>
                        );
                      }
                      return (
                        <Link key={ev.id} href={link.href}>
                          {content}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center py-12 bg-white/[0.03] border border-white/5 rounded-2xl">
              <Calendar className="w-8 h-8 text-stone-700 mx-auto mb-3" />
              <p className="text-stone-500 text-sm font-bold">
                No upcoming events right now
              </p>
              <p className="text-stone-600 text-xs mt-1">
                Check back soon for new dates
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Gallery / Promo ── */}
      {promos && promos.length > 0 && (
        <section id="gallery" className="px-4 py-14 sm:py-20">
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              title="Gallery"
              subtitle="Latest from our socials"
              color="yellow"
            />

            <div className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-4 mt-8 -mx-4 px-4 scrollbar-hide">
              {promos.map((raw) => {
                const p = raw as unknown as {
                  id: number;
                  title: string;
                  description: string | null;
                  media_url: string;
                  media_type: string;
                  external_url: string | null;
                };
                const card = (
                  <div className="snap-start shrink-0 w-[260px] sm:w-[300px] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-all duration-300 group">
                    <div className="relative aspect-4/5 bg-black/30">
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
                        />
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent p-4 pt-12">
                        <h4 className="text-white font-black text-sm uppercase tracking-tight line-clamp-2">
                          {p.title}
                        </h4>
                        {p.description && (
                          <p className="text-stone-300 text-[11px] mt-1 line-clamp-1">
                            {p.description}
                          </p>
                        )}
                      </div>

                      {/* Instagram icon */}
                      {p.external_url && (
                        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                          <Instagram className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                );

                if (p.external_url) {
                  return (
                    <a
                      key={p.id}
                      href={p.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="snap-start shrink-0"
                    >
                      {card}
                    </a>
                  );
                }
                return (
                  <div key={p.id} className="snap-start shrink-0">
                    {card}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="px-4 py-10 border-t border-white/5">
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
            &copy; {new Date().getFullYear()} Don Fenticas &middot; Licensed
            Venue &middot; Please Drink Responsibly
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ─── Helper Components ─── */

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[9px] sm:text-xs font-bold uppercase tracking-wide px-1.5 sm:px-3 py-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/5 transition-colors"
    >
      {children}
    </Link>
  );
}

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
      <Icon className="w-3 h-3 text-[#FDCC4B]" />
      <span className="text-[10px] font-black uppercase tracking-wide text-stone-300">
        {label}
      </span>
    </div>
  );
}

const SECTION_COLORS = {
  yellow: { bg: "bg-[#FDCC4B]/10", border: "border-[#FDCC4B]/20", text: "text-[#FDCC4B]" },
  red: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400" },
  green: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
};

function SectionHeader({
  title,
  subtitle,
  color = "yellow",
}: {
  title: string;
  subtitle: string;
  color?: keyof typeof SECTION_COLORS;
}) {
  const c = SECTION_COLORS[color];
  return (
    <div className="text-center">
      <div
        className={`inline-flex items-center gap-2 ${c.bg} ${c.border} border rounded-full px-4 py-1.5 mb-4`}
      >
        <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>
          {title}
        </span>
      </div>
      <h2 className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tight">
        {title}
      </h2>
      <p className="text-stone-500 text-sm mt-2">{subtitle}</p>
    </div>
  );
}

/* ─── Event Routing ─── */

type EventForLink = {
  external_link: string | null;
  event_types: { type: string; sub_type: string } | null;
};

function getEventLink(ev: EventForLink): { href: string; external: boolean } {
  if (ev.external_link) {
    return { href: ev.external_link, external: true };
  }

  const subType = ev.event_types?.sub_type?.toLowerCase() ?? "";

  if (subType.includes("quiz")) return { href: "/book/quiz", external: false };
  if (subType.includes("bingo")) return { href: "/book/bingo", external: false };

  return { href: "/book", external: false };
}

/* ─── Week Grouping ─── */

type GroupableEvent = {
  id: number;
  date: string;
  start_time: string | null;
  title: string | null;
  description: string | null;
  external_link: string | null;
  event_types: { type: string; sub_type: string; badge_color: string | null; type_color: string | null } | null;
};

function groupEventsByWeek(events: GroupableEvent[]) {
  if (!events.length) return [];

  const groups: { weekStart: string; events: GroupableEvent[] }[] = [];

  for (const ev of events) {
    const d = new Date(ev.date + "T00:00:00");
    // Get Monday of this week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const weekKey = monday.toISOString().split("T")[0];

    const existing = groups.find((g) => g.weekStart === weekKey);
    if (existing) {
      existing.events.push(ev);
    } else {
      groups.push({ weekStart: weekKey, events: [ev] });
    }
  }

  return groups;
}

function getMonthLabel(events: { date: string }[]) {
  if (!events.length) return "";
  const first = new Date(events[0].date + "T00:00:00");
  const last = new Date(events[events.length - 1].date + "T00:00:00");
  const firstMonth = first.toLocaleDateString("en-GB", { month: "long" });
  const lastMonth = last.toLocaleDateString("en-GB", { month: "long" });
  const year = first.getFullYear();

  if (firstMonth === lastMonth) {
    return `${firstMonth} ${year}`;
  }
  return `${firstMonth} – ${lastMonth} ${year}`;
}

/* ─── Utility Functions ─── */

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

function getOrdinalSuffix(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
