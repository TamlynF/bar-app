import Image from "next/image";
import { getCompanyInfo } from "@/lib/company-info";
import {
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Clock,
  MessageSquare,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import { toMinutes, type OpeningHours } from "@/lib/opening-hours";
import EnquiryForm from "./_components/enquiry-form";
import CopyAddressButton from "./_components/copy-address-button";

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

export default async function ContactPage() {
  const info = await getCompanyInfo();

  const openingHours = (info?.opening_hours ?? {}) as OpeningHours;
  const openDays = DAYS.filter((day) => {
    const hours = openingHours[day];
    return toMinutes(hours?.open) !== null && toMinutes(hours?.close) !== null;
  });
  const todayName = new Date()
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toLowerCase();

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#1a2008] text-white antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/contact" />

      <div className="mx-auto flex w-full max-w-400 flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-x-14 lg:gap-y-10 xl:gap-x-24">
          <div className="order-1 min-w-0 lg:order-0 lg:col-span-2 lg:col-start-1 lg:row-start-1">
            <SectionHeading eyebrow="Find us · get in touch" title="About Us" />
            {info?.description && (
              <p className="-mt-2 text-sm leading-relaxed font-medium text-stone-400">
                {info.description}
              </p>
            )}
          </div>

          <div className="order-3 min-w-0 space-y-8 lg:order-0 lg:col-span-2 lg:col-start-1 lg:row-start-2">
            {info?.phone && (
              <section className="space-y-3">
                <ContactCard
                  icon={Phone}
                  label="Phone"
                  value={info.phone}
                  href={`tel:${info.phone}`}
                  action="Call"
                />
              </section>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
              {info?.address && <MapCard address={info.address} />}

              {openDays.length > 0 && (
                <section>
                  <SectionLabel icon={Clock} label="Opening Hours" />
                  <div className="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {openDays.map((day) => {
                      const hours = openingHours[day];
                      const isToday = todayName === day;
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
                                isToday ? "text-[#FDCC4B]" : "text-stone-300"
                              }`}
                            >
                              {DAY_LABELS[day]}
                            </span>
                          </div>
                          <span className="font-black text-xs text-white tabular-nums">
                            {hours?.open} &ndash; {hours?.close}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>

          <section className="@container order-2 w-full min-w-0 lg:order-0 lg:col-start-3 lg:row-span-2 lg:row-start-1">
            <SectionLabel icon={MessageSquare} label="Send Us a Message" />
            <div className="mt-3 rounded-2xl border border-[#FDCC4B]/25 bg-white/5 p-4 shadow-[0_0_50px_-24px_rgba(253,204,75,0.8)] sm:p-5">
              <EnquiryForm />
            </div>
          </section>
        </div>

        {!info?.address && !info?.phone && (
          <div className="rounded-2xl border border-white/5 bg-white/3 py-16 text-center sm:mx-auto sm:max-w-xl">
            <Mail className="mx-auto mb-3 h-8 w-8 text-stone-700" />
            <p className="text-sm font-bold tracking-tight text-stone-500 uppercase">
              Contact details coming soon
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Check back later or visit us in person
            </p>
          </div>
        )}

        <div className="mt-auto pt-16 text-center">
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

function MapCard({ address }: { address: string }) {
  const query = encodeURIComponent(address);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const staticMapSrc = process.env.GOOGLE_MAPS_API_KEY ? "/api/static-map" : null;

  return (
    <section>
      <SectionLabel icon={MapPin} label="Find Us" />
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${address} in Google Maps`}
          className="group relative block h-56 w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#FDCC4B] sm:h-64"
        >
          {staticMapSrc ? (
            <Image
              src={staticMapSrc}
              alt={`Map showing Don Fenticas at ${address}`}
              fill
              sizes="(max-width: 1024px) 100vw, 480px"
              className="object-cover"
            />
          ) : (
            <iframe
              src={`https://www.google.com/maps?q=${query}&z=18&output=embed`}
              title="Map of Don Fenticas"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="pointer-events-none h-full w-full border-0"
            />
          )}
          <span
            className="absolute inset-0 bg-[#1a2008]/15 transition-colors group-hover:bg-transparent"
            aria-hidden="true"
          />
        </a>

        <div className="flex items-start gap-3 border-t border-white/10 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="font-black text-[10px] tracking-[0.2em] text-stone-500 uppercase">
              Address
            </p>
            <p className="mt-1 text-sm font-bold whitespace-pre-line text-white select-all">
              {address}
            </p>
          </div>
          <CopyAddressButton address={address} />
        </div>
      </div>
    </section>
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
