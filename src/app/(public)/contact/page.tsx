import { createClient } from "@/lib/supabase/server";
import {
  MapPin,
  Phone,
  Mail,
  Instagram,
  Facebook,
  ExternalLink,
  Clock,
  MessageSquare,
} from "lucide-react";
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
    <main className="bg-[#1a2008] selection:bg-[#FDCC4B] w-full min-h-dvh text-white selection:text-[#1a2008] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/contact" />

      <div className="mx-auto px-4 py-6 sm:py-10 max-w-xl">
        {/* Page header */}
        <SectionHeading eyebrow="Find us · get in touch" title="About Us" />
        {info?.description && (
          <p className="-mt-2 mb-8 font-medium text-stone-400 text-sm leading-relaxed">
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
            <div className="bg-white/5 mt-3 border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
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
                          <span className="inline-flex absolute opacity-75 rounded-full w-full h-full animate-ping neon-bg" />
                          <span className="inline-flex relative rounded-full w-1.5 h-1.5 neon-bg" />
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
                      <span className="font-bold text-stone-600 text-xs">Closed</span>
                    ) : (
                      <span className="font-black tabular-nums text-white text-xs">
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
            <SectionLabel icon={Instagram} label="Follow Us" />
            <div className="gap-3 grid grid-cols-2 mt-3">
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
          <div className="bg-white/3 py-16 border border-white/5 rounded-2xl text-center">
            <Mail className="mx-auto mb-3 w-8 h-8 text-stone-700" />
            <p className="font-bold text-stone-500 text-sm uppercase tracking-tight">
              Contact details coming soon
            </p>
            <p className="mt-1 text-stone-600 text-xs">
              Check back later or visit us in person
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="flex justify-center items-center gap-3 text-stone-800">
            <div className="bg-stone-800/50 w-6 h-px" />
            <span className="font-bold text-[9px] uppercase tracking-[0.4em]">
              Don Fenticas
            </span>
            <div className="bg-stone-800/50 w-6 h-px" />
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
      <span className="font-black text-[10px] text-stone-500 uppercase tracking-[0.25em]">
        {label}
      </span>
      <div className="flex-1 bg-stone-800/50 h-px" />
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
    <div className="flex items-start gap-4 bg-white/5 p-4 sm:p-5 border border-white/10 rounded-2xl">
      <div className="flex justify-center items-center bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-xl w-11 h-11 shrink-0">
        <Icon className="w-5 h-5 text-[#FDCC4B]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-[10px] text-stone-500 uppercase tracking-[0.2em]">
          {label}
        </p>
        <p className="mt-1 font-bold text-white text-sm break-all whitespace-pre-line">
          {value}
        </p>
        {href && action && (
          <a
            href={href}
            className="inline-flex items-center gap-1 mt-2 font-black text-[#FDCC4B] text-[10px] hover:text-white uppercase tracking-widest transition-colors"
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
      className="group flex items-center gap-3 bg-white/5 hover:bg-white/8 p-4 border border-white/10 hover:border-white/20 rounded-2xl transition-all"
    >
      <div className="flex justify-center items-center bg-white/5 group-hover:bg-white/10 border border-white/10 rounded-xl w-9 h-9 transition-colors shrink-0">
        {Icon ? (
          <Icon className="w-4 h-4 text-stone-400" />
        ) : (
          <span className="font-black text-stone-400 text-xs">
            {label.charAt(0)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-white text-xs uppercase tracking-tight">
          {label}
        </p>
        <p className="font-bold text-[11px] text-stone-500 truncate">{handle}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-stone-600 group-hover:text-stone-400 transition-colors shrink-0" />
    </a>
  );
}