import { createClient } from "@/lib/supabase/server";
import {
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Clock,
  MessageSquare,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok, SiX } from "react-icons/si";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import EnquiryForm from "./_components/enquiry-form";

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
    <main className="min-h-dvh w-full bg-[#1a2008] text-white antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/contact" />

      <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
        {/* Page header */}
        <SectionHeading eyebrow="Find us · get in touch" title="About Us" />
        {info?.description && (
          <p className="-mt-2 mb-8 text-sm leading-relaxed font-medium text-stone-400">
            {info.description}
          </p>
        )}

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
            <div className="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
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
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="neon-bg absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                          <span className="neon-bg relative inline-flex h-1.5 w-1.5 rounded-full" />
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold tracking-wide uppercase ${
                          isToday ? "text-[#FDCC4B]" : closed ? "text-stone-500" : "text-stone-300"
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </span>
                    </div>
                    {closed ? (
                      <span className="text-xs font-bold text-stone-600">Closed</span>
                    ) : (
                      <span className="font-black text-xs text-white tabular-nums">
                        {hours!.open} &ndash; {hours!.close}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-8">
  <SectionLabel icon={MessageSquare} label="Send Us a Message" />
  <div className="mt-3">
    <EnquiryForm />
  </div>
</section>

        {/* Social */}
        {(info?.instagram || info?.facebook || info?.twitter || info?.tiktok || info?.youtube) && (
          <section className="mt-8">
            <SectionLabel icon={SiInstagram} label="Follow Us" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              {info?.instagram && (
                <SocialCard
                  icon={SiInstagram}
                  label="Instagram"
                  handle={`@${info.instagram.replace("@", "")}`}
                  href={`https://instagram.com/${info.instagram.replace("@", "")}`}
                />
              )}
              {info?.facebook && (
                <SocialCard
                  icon={SiFacebook}
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
                  icon={SiTiktok}
                  label="TikTok"
                  handle={`@${info.tiktok.replace("@", "")}`}
                  href={`https://tiktok.com/@${info.tiktok.replace("@", "")}`}
                />
              )}
              {info?.twitter && (
                <SocialCard
                  icon={SiX}
                  label="X / Twitter"
                  handle={`@${info.twitter.replace("@", "")}`}
                  href={`https://x.com/${info.twitter.replace("@", "")}`}
                />
              )}
              {info?.youtube && (
                <SocialCard
                  icon={SiYoutube}
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
          <div className="rounded-2xl border border-white/5 bg-white/3 py-16 text-center">
            <Mail className="mx-auto mb-3 h-8 w-8 text-stone-700" />
            <p className="text-sm font-bold tracking-tight text-stone-500 uppercase">
              Contact details coming soon
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Check back later or visit us in person
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-3 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold tracking-[0.4em] uppercase">
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
      <Icon className="h-3 w-3 text-[#FDCC4B]" />
      <span className="font-black text-[10px] tracking-[0.25em] text-stone-500 uppercase">
        {label}
      </span>
      <div className="h-px flex-1 bg-stone-800/50" />
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
    <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FDCC4B]/20 bg-[#FDCC4B]/10">
        <Icon className="h-5 w-5 text-[#FDCC4B]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[10px] tracking-[0.2em] text-stone-500 uppercase">
          {label}
        </p>
        <p className="mt-1 text-sm font-bold break-all whitespace-pre-line text-white">
          {value}
        </p>
        {href && action && (
          <a
            href={href}
            className="mt-2 inline-flex items-center gap-1 font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase transition-colors hover:text-white"
          >
            {action} <ExternalLink className="h-3 w-3" />
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
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/8"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-colors group-hover:bg-white/10">
        {Icon ? (
          <Icon className="h-4 w-4 text-stone-400" />
        ) : (
          <span className="font-black text-xs text-stone-400">
            {label.charAt(0)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-xs tracking-tight text-white uppercase">
          {label}
        </p>
        <p className="truncate text-[11px] font-bold text-stone-500">{handle}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-600 transition-colors group-hover:text-stone-400" />
    </a>
  );
}