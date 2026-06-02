import { createClient } from "@/lib/supabase/server";
import {
  MapPin,
  Phone,
  Mail,
  Instagram,
  Facebook,
  ExternalLink,
  Clock,
  MessageCircle,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";

export const metadata = {
  title: "Contact Us | Don Fenticas",
  description: "Find us, get in touch, or follow us on social media.",
};

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

type DayHours = { open: string; close: string };
type OpeningHours = Partial<Record<string, DayHours>>;

export default async function ContactPage() {
  const supabase = await createClient();
  const { data: info } = await supabase
    .from("company_information")
    .select("*")
    .single();

  const openingHours = (info?.opening_hours ?? {}) as OpeningHours;
  const hasHours = DAYS.some((d) => openingHours[d]?.open);
  const todayName = new Date()
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toLowerCase();

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-white selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/contact" />

      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        {/* Page header */}
        <header className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-3 py-1 mb-3">
            <MessageCircle className="w-3 h-3 text-[#FDCC4B]" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
              Find Us &middot; Get In Touch
            </span>
          </div>
          <h1 className="text-white font-black text-3xl sm:text-4xl uppercase tracking-tighter">
            About Us
          </h1>

          {info?.description && (
            <p className="text-stone-400 text-sm font-medium mt-4 leading-relaxed max-w-md mx-auto">
              {info.description}
            </p>
          )}
        </header>

        {/* Contact details */}
        <section className="space-y-3">
          {info?.address && (
            <ContactCard
              icon={MapPin}
              label="Address"
              value={info.address}
            />
          )}
          {info?.phone && (
            <ContactCard
              icon={Phone}
              label="Phone"
              value={info.phone}
              href={`tel:${info.phone}`}
              action="Call"
            />
          )}
          {info?.email && (
            <ContactCard
              icon={Mail}
              label="Email"
              value={info.email}
              href={`mailto:${info.email}`}
              action="Send Email"
            />
          )}
        </section>

        {/* Opening hours */}
        {hasHours && (
          <section className="mt-8">
            <SectionLabel icon={Clock} label="Opening Hours" />
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 mt-3">
              {DAYS.map((day) => {
                const hours = openingHours[day];
                const isToday = todayName === day;
                const closed = !hours?.open && !hours?.close;
                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between px-5 py-3 ${
                      isToday ? "bg-[#FDCC4B]/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="relative flex w-1.5 h-1.5">
                          <span className="absolute inline-flex w-full h-full neon-bg rounded-full animate-ping opacity-75" />
                          <span className="relative inline-flex w-1.5 h-1.5 neon-bg rounded-full" />
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold uppercase tracking-wide ${
                          isToday ? "text-[#FDCC4B]" : closed ? "text-stone-500" : "text-stone-300"
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </span>
                    </div>
                    {closed ? (
                      <span className="text-xs font-bold text-stone-600">Closed</span>
                    ) : (
                      <span className="text-xs font-black text-white tabular-nums">
                        {hours!.open} &ndash; {hours!.close}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Social */}
        {(info?.instagram || info?.facebook || info?.twitter || info?.tiktok || info?.youtube) && (
          <section className="mt-8">
            <SectionLabel icon={Instagram} label="Follow Us" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              {info?.instagram && (
                <SocialCard
                  icon={Instagram}
                  label="Instagram"
                  handle={`@${info.instagram.replace("@", "")}`}
                  href={`https://instagram.com/${info.instagram.replace("@", "")}`}
                />
              )}
              {info?.facebook && (
                <SocialCard
                  icon={Facebook}
                  label="Facebook"
                  handle={info.facebook}
                  href={
                    info.facebook.startsWith("http")
                      ? info.facebook
                      : `https://facebook.com/${info.facebook}`
                  }
                />
              )}
              {info?.tiktok && (
                <SocialCard
                  label="TikTok"
                  handle={`@${info.tiktok.replace("@", "")}`}
                  href={`https://tiktok.com/@${info.tiktok.replace("@", "")}`}
                />
              )}
              {info?.twitter && (
                <SocialCard
                  label="X / Twitter"
                  handle={`@${info.twitter.replace("@", "")}`}
                  href={`https://x.com/${info.twitter.replace("@", "")}`}
                />
              )}
              {info?.youtube && (
                <SocialCard
                  label="YouTube"
                  handle={info.youtube}
                  href={
                    info.youtube.startsWith("http")
                      ? info.youtube
                      : `https://youtube.com/${info.youtube}`
                  }
                />
              )}
            </div>
          </section>
        )}

        {/* Fallback if nothing configured */}
        {!info?.address && !info?.phone && !info?.email && (
          <div className="text-center py-16 bg-white/3 border border-white/5 rounded-2xl">
            <Mail className="w-8 h-8 text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500 text-sm font-bold uppercase tracking-tight">
              Contact details coming soon
            </p>
            <p className="text-stone-600 text-xs mt-1">
              Check back later or visit us in person
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-3 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">
              Don Fenticas
            </span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionLabel({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="w-3 h-3 text-[#FDCC4B]" />
      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-500">
        {label}
      </span>
      <div className="flex-1 h-px bg-stone-800/50" />
    </div>
  );
}

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
      <div className="shrink-0 w-11 h-11 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#FDCC4B]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em]">
          {label}
        </p>
        <p className="text-white text-sm font-bold mt-1 whitespace-pre-line break-all">
          {value}
        </p>
        {href && action && (
          <a
            href={href}
            className="inline-flex items-center gap-1 text-[#FDCC4B] text-[10px] font-black uppercase tracking-widest mt-2 hover:text-white transition-colors"
          >
            {action} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function SocialCard({
  icon: Icon,
  label,
  handle,
  href,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  handle: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/8 hover:border-white/20 transition-all"
    >
      <div className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
        {Icon ? (
          <Icon className="w-4 h-4 text-stone-400" />
        ) : (
          <span className="text-stone-400 text-xs font-black">
            {label.charAt(0)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-black uppercase tracking-tight">
          {label}
        </p>
        <p className="text-stone-500 text-[11px] font-bold truncate">{handle}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-stone-600 group-hover:text-stone-400 transition-colors shrink-0" />
    </a>
  );
}