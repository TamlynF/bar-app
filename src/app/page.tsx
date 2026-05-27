import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  ChevronDown,
  UtensilsCrossed,
  Instagram,
  Facebook,
  Music,
  Mic,
  PartyPopper,
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

  const [{ data: events }, { data: specials }, { data: companyInfo }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, date, start_time, title, description, event_types(type, sub_type, badge_color, type_color)"
        )
        .gte("date", todayStr)
        .eq("is_active", true)
        .order("date", { ascending: true })
        .limit(6),
      supabase
        .from("specials")
        .select("*")
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${todayStr}`)
        .order("display_order", { ascending: true }),
      supabase.from("company_information").select("*").single(),
    ]);

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-white selection:bg-[#fdcc4b] selection:text-[#1a2008] antialiased overflow-x-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a2008]/90 backdrop-blur-xl border-b border-[#FDCC4B]/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2.5">
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
            <NavLink href="/contact">Contact</NavLink>
            <NavLink href="/menu">Menu</NavLink>
            <Link
              href="/book"
              className="ml-1 bg-[#FDCC4B] text-[#1a2008] text-[10px] sm:text-xs font-black uppercase tracking-wide px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-[#e5b843] transition-colors active:scale-95"
            >
              Book Now
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-[85vh] sm:min-h-dvh flex flex-col items-center justify-center px-6 pt-20 pb-12">
        {/* Glow effects */}
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

          {/* Quick feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <FeaturePill icon={Music} label="Live Bands" />
            <FeaturePill icon={Mic} label="Karaoke" />
            <FeaturePill icon={PartyPopper} label="Quiz Nights" />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link
              href="/book"
              className="w-full sm:w-auto bg-[#FDCC4B] text-[#1a2008] font-black text-sm uppercase tracking-wide px-8 py-4 rounded-2xl hover:bg-[#e5b843] transition-all duration-300 active:scale-95 shadow-lg shadow-[#FDCC4B]/20 text-center"
            >
              Make a Booking
            </Link>
            <Link
              href="/menu"
              className="w-full sm:w-auto bg-white/5 border border-white/15 text-white font-black text-sm uppercase tracking-wide px-8 py-4 rounded-2xl hover:bg-white/10 hover:border-white/25 transition-all duration-300 active:scale-95 text-center"
            >
              View Menu
            </Link>
          </div>

          <Link
            href="/login"
            className="inline-block mt-6 text-stone-600 text-[10px] font-bold uppercase tracking-widest hover:text-stone-400 transition-colors"
          >
            Staff Login
          </Link>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-5 h-5 text-[#FDCC4B]/30" />
        </div>
      </section>

      {/* ── What's On ── */}
      <section className="px-4 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            title="What's On"
            subtitle="Upcoming events at Don Fenticas"
            color="yellow"
          />

          {events && events.length > 0 ? (
            <div className="space-y-3 mt-8">
              {events.map((event) => {
                type EventType = {
                  type: string;
                  sub_type: string;
                  badge_color: string | null;
                  type_color: string | null;
                };
                const ev = event as unknown as {
                  id: number;
                  date: string;
                  start_time: string | null;
                  title: string | null;
                  description: string | null;
                  event_types: EventType | EventType[] | null;
                };
                const eventType = Array.isArray(ev.event_types)
                  ? ev.event_types[0]
                  : ev.event_types;
                const dateObj = new Date(ev.date + "T00:00:00");
                const day = dateObj.toLocaleDateString("en-GB", {
                  day: "numeric",
                });
                const monthShort = dateObj.toLocaleDateString("en-GB", {
                  month: "short",
                });
                const weekday = dateObj.toLocaleDateString("en-GB", {
                  weekday: "short",
                });
                const badgeColor = eventType?.badge_color || "#FDCC4B";

                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 sm:gap-4 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-3.5 sm:p-4 hover:bg-white/[0.07] transition-all duration-300"
                  >
                    {/* Date block */}
                    <div className="shrink-0 w-14 h-14 rounded-xl bg-[#FDCC4B] flex flex-col items-center justify-center">
                      <span className="text-[#1a2008] text-xl font-black leading-none">
                        {day}
                      </span>
                      <span className="text-[#1a2008] text-[8px] font-black uppercase tracking-wide">
                        {monthShort}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-black text-sm uppercase tracking-tight truncate">
                        {ev.title || "Event"}
                      </h3>
                      <p className="text-stone-500 text-[11px] font-bold uppercase tracking-wide mt-0.5">
                        {weekday}
                        {ev.start_time
                          ? ` · ${formatTime(ev.start_time)}`
                          : ""}
                      </p>
                    </div>

                    {/* Type badge */}
                    {eventType && (
                      <span
                        className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: `${badgeColor}20`,
                          color: badgeColor,
                          borderWidth: 1,
                          borderColor: `${badgeColor}40`,
                        }}
                      >
                        {eventType.sub_type || eventType.type}
                      </span>
                    )}
                  </div>
                );
              })}
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

          <div className="text-center mt-8">
            <Link
              href="/book"
              className="inline-flex items-center gap-2 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 text-[#FDCC4B] text-xs font-black uppercase tracking-wide px-5 py-2.5 rounded-full hover:bg-[#FDCC4B]/20 transition-colors"
            >
              Book Your Spot <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
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

      {/* ── Menu CTA ── */}
      <section className="px-4 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/menu"
            className="group flex items-center gap-4 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 sm:p-6 hover:bg-white/[0.07] transition-all duration-300 active:scale-[0.99]"
          >
            <div className="shrink-0 w-12 h-12 rounded-xl bg-[#FDCC4B] flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-[#1a2008]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-black text-base uppercase tracking-tight">
                Explore Our Menu
              </h3>
              <p className="text-stone-500 text-xs mt-0.5">
                Drinks, bites, and everything in between
              </p>
            </div>
            <ArrowRight className="shrink-0 w-5 h-5 text-stone-600 group-hover:text-stone-400 group-hover:translate-x-1 transition-all duration-200" />
          </Link>
        </div>
      </section>

      {/* ── Find Us ── */}
      <section className="px-4 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            title="Find Us"
            subtitle="Drop by for a drink or get in touch"
            color="green"
          />

          <div className="mt-8 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 sm:p-6">
            <div className="space-y-4">
              {companyInfo?.address && (
                <ContactItem
                  icon={MapPin}
                  label="Address"
                  value={companyInfo.address}
                />
              )}
              {companyInfo?.phone && (
                <ContactItem
                  icon={Phone}
                  label="Phone"
                  value={companyInfo.phone}
                  href={`tel:${companyInfo.phone}`}
                />
              )}
              {companyInfo?.email && (
                <ContactItem
                  icon={Mail}
                  label="Email"
                  value={companyInfo.email}
                  href={`mailto:${companyInfo.email}`}
                />
              )}
            </div>

            {(companyInfo?.instagram || companyInfo?.facebook) && (
              <div className="flex items-center gap-2.5 mt-5 pt-5 border-t border-white/5">
                {companyInfo.instagram && (
                  <SocialLink
                    href={`https://instagram.com/${companyInfo.instagram}`}
                    icon={Instagram}
                    label="Instagram"
                  />
                )}
                {companyInfo.facebook && (
                  <SocialLink
                    href={`https://facebook.com/${companyInfo.facebook}`}
                    icon={Facebook}
                    label="Facebook"
                  />
                )}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-white/5 text-center">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-[#FDCC4B] text-xs font-black uppercase tracking-wide hover:text-[#e5b843] transition-colors"
              >
                Full Contact Details <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

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
      className="text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2 sm:px-3 py-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/5 transition-colors"
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

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4 text-emerald-400" />
      </div>
      <div>
        <p className="text-stone-600 text-[10px] font-bold uppercase tracking-wide">
          {label}
        </p>
        <p className="text-white text-sm font-bold mt-0.5 whitespace-pre-line">
          {value}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block hover:opacity-80 transition-opacity">
        {content}
      </a>
    );
  }
  return content;
}

function SocialLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
      title={label}
    >
      <Icon className="w-4 h-4 text-stone-400" />
    </a>
  );
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
