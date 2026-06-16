import { Calendar } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { EventCard } from "@/components/editorial/event-card";
import { type SerializedEvent } from "@/lib/events-display";

/**
 * Home-page "What's On" highlights as an awwwards-style editorial card grid:
 * a SectionHeading with a "See full schedule" action, then up to ~6 EventCards.
 * Empty state keeps the section present with a gentle prompt.
 */
export function HighlightedEvents({
  events,
}: {
  events: SerializedEvent[];
}) {
  return (
    <section id="whats-on" className="scroll-mt-24">
      <SectionHeading
        eyebrow="On the bill"
        title="What's On"
        action={{ href: "/whats-on", label: "Full schedule" }}
      />

      {events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white/3 border border-white/5 rounded-2xl">
          <Calendar className="w-8 h-8 text-stone-700 mx-auto mb-3" />
          <p className="text-stone-500 font-black text-sm uppercase tracking-tight">
            No Events Scheduled Yet
          </p>
          <p className="text-stone-600 text-xs mt-1">Check back soon</p>
        </div>
      )}
    </section>
  );
}
