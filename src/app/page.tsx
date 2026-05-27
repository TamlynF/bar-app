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
  Sparkles,
  Instagram,
  Facebook,
} from "lucide-react";

export const metadata = {
  title: "Don Fenticas | Bar & Restaurant",
  description:
    "Welcome to Don Fenticas — quiz nights, live music, great food, and unforgettable nights out.",
};

export const revalidate = 300; // revalidate every 5 minutes

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
    <main className="min-h-dvh w-full bg-[#26300D] text-white selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#26300D]/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-black uppercase tracking-tight text-[#FDCC4B]">
            Don Fenticas
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <NavLink href="/contact">Contact</NavLink>
            <NavLink href="/menu">Menu</NavLink>
            <Link
              href="/book"
              className="ml-1 sm:ml-2 bg-[#FDCC4B] text-[#26300D] text-[10px] sm:text-xs font-black uppercase tracking-wide px-3 sm:px-4 py-2 rounded-full hover:bg-[#e5b843] transition-colors active:scale-95"
            >
              Book Now
            </Link>
            <NavLink href="/login" subtle>Staff</NavLink>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-dvh flex flex-col items-center justify-center px-4 pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(253,204,75,0.06)_0%,_transparent_70%)] pointer-events-none" />
        <div className="relative text-center max-w-lg mx-auto">
          <Image
            src="/CompanyName.png"
            alt="Don Fenticas"
            width={400}
            height={100}
            className="w-full max-w-xs sm:max-w-sm mx-auto h-auto object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
            priority
          />
          <p className="text-stone-400 text-sm sm:text-base font-medium mt-6 leading-relaxed max-w-sm mx-auto">
            Your neighbourhood bar for quiz nights, live music, great drinks, and good times.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Link
              href="/book"
              className="bg-[#FDCC4B] text-[#26300D] font-black text-xs uppercase tracking-wide px-6 py-3.5 rounded-full hover:bg-[#e5b843] transition-all duration-300 active:scale-95 shadow-lg shadow-[#FDCC4B]/20"
            >
              Make a Booking
            </Link>
            <Link
              href="/menu"
              className="bg-white/5 border border-white/15 text-white font-black text-xs uppercase tracking-wide px-6 py-3.5 rounded-full hover:bg-white/10 hover:border-white/25 transition-all duration-300 active:scale-95"
            >
              View Menu
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-5 h-5 text-stone-600" />
        </div>
      </section>

      {/* ── What's On ── */}
      <section className="px-4 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto">
          <SectionHeader title="What's On" subtitle="Upcoming events at Don Fenticas" />

          {events && events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
              {events.map((event) => {
                type EventType = { type: string; sub_type: string; badge_color: string | null; type_color: string | null };
                const ev = event as unknown as { id: number; date: string; start_time: string | null; title: string | null; description: string | null; event_types: EventType | EventType[] | null };
                const eventType = Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types;
                const dateObj = new Date(ev.date + "T00:00:00");
                const day = dateObj.toLocaleDateString("en-GB", { day: "numeric" });
                const month = dateObj.toLocaleDateString("en-GB", { month: "short" });
                const weekday = dateObj.toLocaleDateString("en-GB", { weekday: "short" });

                return (
                  <div
                    key={ev.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-14 h-14 rounded-2xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex flex-col items-center justify-center">
                        <span className="text-[#FDCC4B] text-lg font-black leading-none">{day}</span>
                        <span className="text-[#FDCC4B] text-[9px] font-bold uppercase">{month}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-black text-sm uppercase tracking-tight truncate">
                          {ev.title || "Event"}
                        </h3>
                        <p className="text-stone-500 text-[11px] font-bold uppercase tracking-wide mt-0.5">
                          {weekday}
                          {ev.start_time ? ` · ${formatTime(ev.start_time)}` : ""}
                        </p>
                        {eventType && (
                          <span
                            className="inline-block mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${eventType.badge_color || "#FDCC4B"}20`,
                              color: eventType.badge_color || "#FDCC4B",
                              borderWidth: 1,
                              borderColor: `${eventType.badge_color || "#FDCC4B"}40`,
                            }}
                          >
                            {eventType.sub_type || eventType.type}
                          </span>
                        )}
                      </div>
                    </div>
                    {ev.description && (
                      <p className="text-stone-400 text-xs leading-relaxed mt-3 line-clamp-2">
                        {ev.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 text-center py-12 bg-white/3 border border-white/5 rounded-2xl">
              <Calendar className="w-8 h-8 text-stone-700 mx-auto mb-3" />
              <p className="text-stone-500 text-sm font-bold">No upcoming events right now</p>
              <p className="text-stone-600 text-xs mt-1">Check back soon for new dates</p>
            </div>
          )}

          <div className="text-center mt-8">
            <Link
              href="/book"
              className="inline-flex items-center gap-2 text-[#FDCC4B] text-xs font-black uppercase tracking-wide hover:text-[#e5b843] transition-colors"
            >
              Book Your Spot <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Specials ── */}
      {specials && specials.length > 0 && (
        <section className="px-4 py-16 sm:py-24 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <SectionHeader title="Specials" subtitle="Deals and offers you won't want to miss" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              {specials.map((raw) => {
                const sp = raw as unknown as { id: number; title: string; description: string | null; badges: string[]; image_url: string | null; start_date: string | null; end_date: string | null };
                return (
                <div
                  key={sp.id}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300"
                >
                  {sp.image_url && (
                    <div className="relative h-40 bg-black/20">
                      <Image
                        src={sp.image_url}
                        alt={sp.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {(sp.badges || []).map((badge) => (
                        <span
                          key={badge}
                          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 text-[#FDCC4B]"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-white font-black text-sm uppercase tracking-tight">
                      {sp.title}
                    </h3>
                    {sp.description && (
                      <p className="text-stone-400 text-xs leading-relaxed mt-2 line-clamp-3">
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
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Menu CTA ── */}
      <section className="px-4 py-16 sm:py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/menu"
            className="group flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-[#FDCC4B]" />
              </div>
              <div>
                <h3 className="text-white font-black text-base sm:text-lg uppercase tracking-tight">
                  Explore Our Menu
                </h3>
                <p className="text-stone-400 text-xs sm:text-sm mt-0.5">
                  Drinks, bites, and everything in between
                </p>
              </div>
            </div>
            <ArrowRight className="shrink-0 w-5 h-5 text-stone-500 group-hover:text-stone-400 group-hover:translate-x-1 transition-all duration-200" />
          </Link>
        </div>
      </section>

      {/* ── Find Us ── */}
      <section className="px-4 py-16 sm:py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <SectionHeader title="Find Us" subtitle="Drop by for a drink or get in touch" />

          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {companyInfo?.address && (
                <ContactItem icon={MapPin} label="Address" value={companyInfo.address} />
              )}
              {companyInfo?.phone && (
                <ContactItem icon={Phone} label="Phone" value={companyInfo.phone} href={`tel:${companyInfo.phone}`} />
              )}
              {companyInfo?.email && (
                <ContactItem icon={Mail} label="Email" value={companyInfo.email} href={`mailto:${companyInfo.email}`} />
              )}
            </div>

            {/* Socials */}
            {(companyInfo?.instagram || companyInfo?.facebook) && (
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/5">
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

            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-[#FDCC4B] text-xs font-black uppercase tracking-wide hover:text-[#e5b843] transition-colors"
              >
                View Full Contact Details <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-4 py-8 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] text-stone-700 uppercase tracking-widest font-bold opacity-40 mt-2">
            &copy; {new Date().getFullYear()} Don Fenticas &middot; Licensed Venue &middot; Please Drink Responsibly
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ─── Helper Components ─── */

function NavLink({ href, children, subtle }: { href: string; children: React.ReactNode; subtle?: boolean }) {
  return (
    <Link
      href={href}
      className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2 sm:px-3 py-2 rounded-full transition-colors ${
        subtle
          ? "text-stone-600 hover:text-stone-400"
          : "text-stone-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-2 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-4 py-1.5 mb-4">
        <Sparkles className="w-3 h-3 text-[#FDCC4B]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]">{title}</span>
      </div>
      <h2 className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tight">{title}</h2>
      <p className="text-stone-400 text-sm mt-2">{subtitle}</p>
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
      <div className="shrink-0 w-9 h-9 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4 text-[#FDCC4B]" />
      </div>
      <div>
        <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wide">{label}</p>
        <p className="text-white text-sm font-bold mt-0.5 whitespace-pre-line">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="hover:opacity-80 transition-opacity">
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
      className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
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
