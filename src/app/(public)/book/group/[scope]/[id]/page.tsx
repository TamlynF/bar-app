import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupedBookingForm, { type GroupedEvent } from "./_components/grouped-booking-form";
import ImageThemer from "../../../event/[id]/_components/image-themer";
import Image from "next/image";
import {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";
import { PublicNav } from "@/components/public-nav";

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User,
};

type Scope = "type" | "subtype";

function isScope(v: string): v is Scope {
  return v === "type" || v === "subtype";
}

async function loadHeader(scope: Scope, id: string) {
  console.log("loadHeader called with scope:", scope, "id:", id);
  const supabase = await createClient();
  if (scope === "subtype") {
    const [{ data: subtype }, { data: badges }] = await Promise.all([
      supabase.from("event_subtypes").select("name, tagline, booking_config").eq("id", id).maybeSingle(),
      supabase.from("event_subtype_badges").select("icon, title").eq("event_subtypes_id", id),
    ]);
    return {
      title: (subtype?.name as string | null) || "Events",
      tagline: (subtype?.tagline as string | null) || "",
      badges: badges ?? [],
      bookingConfig: (subtype?.booking_config as BookingConfig | null) ?? {},
    };
  }
  const { data: type } = await supabase.from("event_types").select("name, booking_config").eq("id", id).maybeSingle();
  return {
    title: (type?.name as string | null) || "Events",
    tagline: "",
    badges: [] as { icon: string | null; title: string }[],
    bookingConfig: (type?.booking_config as BookingConfig | null) ?? {},
  };
}

export async function generateMetadata({ params }: { params: Promise<{ scope: string; id: string }> }) {
  console.log("generateMetadata called with params:", params);
  const { scope, id } = await params;
  console.log("generateMetadata resolved scope:", scope, "id:", id);
  if (!isScope(scope)) return { title: "Book | Don Fenticas" };
  const header = await loadHeader(scope, id);
  return {
    title: `${header.title} | Don Fenticas`,
    description: `Book your spot at Don Fenticas.`,
  };
}

const toTitleCase = (s: string) =>
  s.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

export default async function GroupedBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ scope: string; id: string }>;
  searchParams: Promise<{ id?: string }>;
  }) {
  console.log("GroupedBookingPage called with params:", params, "searchParams:", searchParams);
  const { scope, id } = await params;
  const { id: defaultEventId } = await searchParams;
  if (!isScope(scope)) notFound();

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
console.log("Querying events with scope:", scope, "id:", id);
  let query = supabase
    .from("events")
    .select("id, date, start_time, title, tagline, payment_amount, is_fully_booked, seating_required")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true });

  query = scope === "subtype"
    ? query.eq("event_subtypes_id", id)
    : query.eq("event_types_id", id);

  const [{ data: rawEvents }, header] = await Promise.all([query, loadHeader(scope, id)]);

  const events: GroupedEvent[] = (rawEvents ?? []).map((e) => ({
    id: e.id as number,
    date: e.date as string,
    start_time: (e.start_time as string | null) ?? null,
    title: (e.title as string | null) ?? null,
    payment_amount: e.payment_amount as number | null,
    is_fully_booked: (e.is_fully_booked as boolean) ?? false,
    seating_required: (e.seating_required as boolean) ?? false,
  }));
console.log("Loaded events:", events, "header:", header);
  // The whole group shares one booking form/page config (from the type or sub-type).
  const cfg = normalizeBookingConfig(header.bookingConfig);
  console.log("Normalized booking config:", cfg);
  const tagline = cfg.tag_line || header.tagline;
  const title = toTitleCase(header.title);
  const badges = (header.badges || []).map((item) => ({
    Icon: ICON_MAP[item.icon || ""] || Info,
    text: item.title,
  }));

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#26300D] text-stone-300 antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #26300D !important;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        main {
          padding-top: env(safe-area-inset-top, 10px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* Dynamic theme — the shared booking image's dominant colour is sampled
          client-side and bled across the page. Falls back to olive when absent. */}
      {cfg.booking_image_url && (
        <>
          <ImageThemer imageUrl={cfg.booking_image_url} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_bottom,var(--ev-theme,transparent)_0%,var(--ev-theme,transparent)_35%,transparent_82%)] opacity-80"
          />
        </>
      )}

      <PublicNav currentPath="/book/group" />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-12 pt-14 pb-4 pb-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-4 flex flex-col items-center text-center sm:mb-6">
          {cfg.booking_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.booking_image_url}
              alt={title}
              className="mx-auto -mt-2 h-auto w-full object-contain sm:max-w-md"
            />
          ) : (
            <div className="w-full max-w-45 sm:max-w-xs">
              <Image
                src="/CompanyName.png"
                alt="Don Fenticas"
                width={300}
                height={90}
                className="h-auto w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
                priority
              />
            </div>
          )}
          <div className="mt-4 space-y-2 px-2 sm:mt-5">
            {tagline && (
              <p className="mx-auto max-w-sm text-center text-base text-xs leading-relaxed font-medium text-(--ev-fg-dim,#a8a29e) italic sm:max-w-2xl">
                {tagline}
              </p>
            )}
          </div>
        </div>

        {/* Event Badges */}
        {badges.length > 0 && (
          <div className="no-scrollbar -mx-4 mx-0 mb-4 mb-5 flex flex-row flex-wrap justify-center gap-2 gap-3 overflow-x-auto px-0 px-4 pb-4 sm:overflow-visible">
            {badges.map((badge, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-center rounded-xl border border-white/25 bg-black/30 px-4 py-2.5 font-black text-[10px] tracking-wider uppercase shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-black/40 sm:py-3 sm:text-[11px]",
                  "flex-none sm:min-w-37.5 sm:flex-1"
                )}
              >
                <badge.Icon className="mr-2 h-3.5 w-3.5 shrink-0 text-[#fdcc4b]" />
                <span className="whitespace-nowrap text-stone-200">{badge.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Booking Form Card */}
        <div className="relative mb-12 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/3 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]" />

          <div className="relative z-10 mb-8 text-center">
            <h3 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">Book Your Spot</h3>
            <p className="mt-2 text-xs font-medium text-(--ev-fg-dim,#78716c) sm:text-base">
              {events.length > 0
                ? "Select a date below and lock in your place."
                : "Check back soon for upcoming events."}
            </p>
          </div>

          <div className="relative z-10">
            {events.length > 0 ? (
              <GroupedBookingForm events={events} config={header.bookingConfig} showTitleInSelector={scope === "type"} defaultEventId={defaultEventId} />
            ) : (
              <div className="py-8 text-center">
                <p className="mb-2 font-black text-lg tracking-tight text-stone-300 uppercase">No Upcoming Events</p>
                <p className="text-sm font-medium text-stone-500">There are no events scheduled yet. Please check back soon!</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto mb-6 flex flex-col items-center gap-4 pt-8">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] tracking-widest text-stone-600 uppercase opacity-30">
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>

      </div>
    </main>
  );
}
