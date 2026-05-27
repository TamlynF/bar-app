import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  Instagram,
  Facebook,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

export const metadata = {
  title: "Contact Us | Don Fenticas",
  description: "Find us, get in touch, or follow us on social media.",
};

export default async function ContactPage() {
  const supabase = await createClient();
  const { data: info } = await supabase
    .from("company_information")
    .select("*")
    .single();

  return (
    <main className="min-h-dvh w-full bg-[#26300D] text-white selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <div className="max-w-xl mx-auto px-4 py-8 sm:py-16">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-stone-500 text-xs font-bold uppercase tracking-wide hover:text-stone-300 transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tight">
            Contact Us
          </h1>
          <p className="text-stone-400 text-sm mt-2">
            We&apos;d love to hear from you — drop by, give us a call, or send us a message.
          </p>
        </div>

        {/* Contact Details */}
        <div className="space-y-4">
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
        </div>

        {/* Social Media */}
        {(info?.instagram || info?.facebook || info?.twitter || info?.tiktok || info?.youtube) && (
          <div className="mt-8">
            <h2 className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mb-4">
              Follow Us
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {info.instagram && (
                <SocialCard
                  icon={Instagram}
                  label="Instagram"
                  handle={`@${info.instagram}`}
                  href={`https://instagram.com/${info.instagram}`}
                />
              )}
              {info.facebook && (
                <SocialCard
                  icon={Facebook}
                  label="Facebook"
                  handle={info.facebook}
                  href={`https://facebook.com/${info.facebook}`}
                />
              )}
              {info.tiktok && (
                <SocialCard
                  label="TikTok"
                  handle={`@${info.tiktok}`}
                  href={`https://tiktok.com/@${info.tiktok}`}
                />
              )}
              {info.twitter && (
                <SocialCard
                  label="X / Twitter"
                  handle={`@${info.twitter}`}
                  href={`https://x.com/${info.twitter}`}
                />
              )}
              {info.youtube && (
                <SocialCard
                  label="YouTube"
                  handle={info.youtube}
                  href={`https://youtube.com/${info.youtube}`}
                />
              )}
            </div>
          </div>
        )}

        {/* No info fallback */}
        {!info?.address && !info?.phone && !info?.email && (
          <div className="text-center py-16 bg-white/3 border border-white/5 rounded-2xl">
            <Mail className="w-8 h-8 text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500 text-sm font-bold">Contact details coming soon</p>
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
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4">
      <div className="shrink-0 w-11 h-11 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#FDCC4B]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wide">{label}</p>
        <p className="text-white text-sm font-bold mt-1 whitespace-pre-line break-all">{value}</p>
        {href && action && (
          <a
            href={href}
            className="inline-flex items-center gap-1 text-[#FDCC4B] text-[10px] font-black uppercase tracking-wide mt-2 hover:text-[#e5b843] transition-colors"
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
      className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300"
    >
      <div className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
        {Icon ? (
          <Icon className="w-4 h-4 text-stone-400" />
        ) : (
          <span className="text-stone-400 text-xs font-black">{label.charAt(0)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-black uppercase tracking-tight">{label}</p>
        <p className="text-stone-500 text-[11px] font-bold truncate">{handle}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-stone-600 group-hover:text-stone-400 transition-colors shrink-0" />
    </a>
  );
}
