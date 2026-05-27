import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin, Phone, Mail, Instagram, Facebook, ArrowLeft,
  ExternalLink, Clock,
} from "lucide-react";

export const metadata = {
  title: "Contact Us | Don Fenticas",
  description: "Find us, get in touch, or follow us on social media.",
};

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
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

  return (
    <main className="min-h-dvh w-full bg-[#26300D] text-white selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`,
      }} />

      <div className="max-w-xl mx-auto px-4 py-8 sm:py-16">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-stone-500 text-xs font-bold uppercase tracking-wide hover:text-stone-300 transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        {/* Logo + Header */}
        <div className="flex flex-col items-center text-center pt-4 pb-6 mb-14">
          {info?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.logo_url} alt={info.name || "Logo"} className="h-16 sm:h-20 w-auto object-contain mb-4" />
          ) : (
            <div className="w-full max-w-[160px] mb-4">
              <Image src="/CompanyName.png" alt="Don Fenticas" width={300} height={90} className="w-full h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]" priority />
            </div>
          )}
          <h1 className="text-white font-black text-lg sm:text-xl uppercase tracking-tight">
            About Us
          </h1>
          {info?.description && (
            <p className="text-stone-400 text-sm mt-2 mb-6 max-w-sm leading-relaxed">{info.description}</p>
          )}
        </div>

        {/* Contact Details */}
        <div className="space-y-3">
          {info?.address && (
            <ContactCard icon={MapPin} label="Address" value={info.address} />
          )}
          {info?.phone && (
            <ContactCard icon={Phone} label="Phone" value={info.phone} href={`tel:${info.phone}`} action="Call" />
          )}
          {info?.email && (
            <ContactCard icon={Mail} label="Email" value={info.email} href={`mailto:${info.email}`} action="Send Email" />
          )}
        </div>

        {/* Opening Hours */}
        {hasHours && (
          <div className="mt-8">
            <h2 className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mb-4">Opening Hours</h2>
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
              {DAYS.map((day) => {
                const hours = openingHours[day];
                const isToday = new Date().toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase() === day;
                if (!hours?.open && !hours?.close) return (
                  <div key={day} className="flex items-center justify-between px-5 py-3.5">
                    <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-[#FDCC4B]" : "text-stone-500"}`}>{DAY_LABELS[day]}</span>
                    <span className="text-xs font-bold text-stone-600">Closed</span>
                  </div>
                );
                return (
                  <div key={day} className={`flex items-center justify-between px-5 py-3.5 ${isToday ? "bg-[#FDCC4B]/5" : ""}`}>
                    <div className="flex items-center gap-2">
                      {isToday && <div className="w-1.5 h-1.5 rounded-full bg-[#FDCC4B] animate-pulse" />}
                      <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-[#FDCC4B]" : "text-stone-400"}`}>{DAY_LABELS[day]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-stone-300">
                      <Clock className="w-3 h-3 text-stone-600" />
                      <span className="text-xs font-black tabular-nums">{hours.open} – {hours.close}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Social Media */}
        {(info?.instagram || info?.facebook || info?.twitter || info?.tiktok || info?.youtube) && (
          <div className="mt-8">
            <div className="flex items-center justify-center gap-4">
              {info.instagram && (
                <a href={`https://instagram.com/${info.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" title="Instagram" className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300">
                  <Instagram className="w-5 h-5 text-stone-400" />
                </a>
              )}
              {info.facebook && (
                <a href={info.facebook.startsWith("http") ? info.facebook : `https://facebook.com/${info.facebook}`} target="_blank" rel="noopener noreferrer" title="Facebook" className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300">
                  <Facebook className="w-5 h-5 text-stone-400" />
                </a>
              )}
            </div>
            {(info.tiktok || info.twitter || info.youtube) && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                {info.tiktok && (
                  <SocialCard label="TikTok" handle={`@${info.tiktok}`} href={`https://tiktok.com/@${info.tiktok.replace("@", "")}`} />
                )}
                {info.twitter && (
                  <SocialCard label="X / Twitter" handle={`@${info.twitter}`} href={`https://x.com/${info.twitter.replace("@", "")}`} />
                )}
                {info.youtube && (
                  <SocialCard label="YouTube" handle={info.youtube} href={info.youtube.startsWith("http") ? info.youtube : `https://youtube.com/${info.youtube}`} />
                )}
              </div>
            )}
          </div>
        )}

        {/* No info fallback */}
        {!info?.address && !info?.phone && !info?.email && (
          <div className="text-center py-16 bg-white/3 border border-white/5 rounded-2xl">
            <Mail className="w-8 h-8 text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500 text-sm font-bold">Contact details coming soon</p>
            <p className="text-stone-600 text-xs mt-1">Check back later or visit us in person</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-3 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
        </div>
      </div>
    </main>
  );
}

function ContactCard({ icon: Icon, label, value, href, action }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; href?: string; action?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4">
      <div className="shrink-0 w-11 h-11 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#FDCC4B]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wide">{label}</p>
        <p className="text-white text-sm font-bold mt-1 whitespace-pre-line break-all">{value}</p>
        {href && action && (
          <a href={href} className="inline-flex items-center gap-1 text-[#FDCC4B] text-[10px] font-black uppercase tracking-wide mt-2 hover:text-[#e5b843] transition-colors">
            {action} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function SocialCard({ icon: Icon, label, handle, href }: {
  icon?: React.ComponentType<{ className?: string }>; label: string; handle: string; href: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300">
      <div className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
        {Icon ? <Icon className="w-4 h-4 text-stone-400" /> : <span className="text-stone-400 text-xs font-black">{label.charAt(0)}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-black uppercase tracking-tight">{label}</p>
        <p className="text-stone-500 text-[11px] font-bold truncate">{handle}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-stone-600 group-hover:text-stone-400 transition-colors shrink-0" />
    </a>
  );
}
