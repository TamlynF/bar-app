"use client";

import { useMemo, useState, useTransition } from "react";
import { createEventBooking } from "@/app/(public)/_actions/create-event-booking";
import {
  CheckCircle,
  ChevronRight,
  CalendarDays,
  User,
  Mail,
  Phone,
  Users,
  Tag,
  Loader2,
  MessageSquareQuote,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CountryCodeSelect } from "@/components/country-code-select";
import { formatTime } from "@/lib/events-display";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";

export interface GroupedEvent {
  id: number;
  date: string;
  start_time: string | null;
  title: string | null;
  payment_amount: number | null;
  is_fully_booked: boolean;
  seating_required: boolean;
}

interface Props {
  events: GroupedEvent[];
  /** The shared booking form/page config for the whole group — defined on the
      owning event_type (per_type) or event_subtype (per_subtype). */
  config: BookingConfig;
  /** When true, the date dropdown also shows each event's title (events of a
      whole category can share a date but differ by title). */
  showTitleInSelector?: boolean;
  /** Event id (from the `?id=` query) to pre-select; ignored if not in `events`. */
  defaultEventId?: string;
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const emptyForm = {
  fullName: "",
  email: "",
  countryCode: "+44",
  phoneNo: "",
  groupName: "",
  groupSize: "1",
  specialRequests: "",
};

export default function GroupedBookingForm({ events, config, showTitleInSelector = false, defaultEventId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const [eventId, setEventId] = useState(
    events.some((e) => String(e.id) === defaultEventId)
      ? defaultEventId!
      : String(events[0]?.id ?? "")
  );
  const [formData, setFormData] = useState(emptyForm);

  function eventOptionLabel(ev: GroupedEvent) {
    const time = formatTime(ev.start_time);
    const base = time ? `${formatEventDate(ev.date)} · ${time}` : formatEventDate(ev.date);
    return showTitleInSelector && ev.title ? `${base} — ${ev.title}` : base;
  }

  // Resolve the chosen event by id (unique) — events can share a date.
  const selectedEvent = events.find((e) => String(e.id) === eventId) ?? events[0];

  const cfg = useMemo(() => normalizeBookingConfig(config), [config]);
  const f = cfg.fields;
  const groupSizeOptions = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, f.group_size.max - f.group_size.min + 1) },
        (_, i) => f.group_size.min + i
      ),
    [f.group_size.min, f.group_size.max]
  );

  const fullyBooked = selectedEvent?.is_fully_booked ?? false;
  const hasPricing = !!selectedEvent?.payment_amount && selectedEvent.payment_amount > 0;
  const pricePerPerson = hasPricing ? selectedEvent!.payment_amount! : 0;
  const total = pricePerPerson * parseInt(formData.groupSize || "1");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);    
    startTransition(async () => {
      const result = await createEventBooking(fd);
      if (result.error) {
        setError(result.error);
      } else if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else if (result.success) {
        setBooked(true);
      }
    });
  };

  const inputBaseClasses =
    "w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder:text-(--ev-fg-dim,#44403c) focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all duration-300 text-sm font-bold";
  const labelClasses = "block text-[10px] font-black text-(--ev-fg,#78716c) mb-2 uppercase tracking-[0.15em] ml-1";
  const iconContainerClasses = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
  const iconClasses = "w-4 h-4 text-(--ev-fg,#57534e) transition-colors duration-200 group-focus-within:text-[#fdcc4b]";

  if (booked) {
    return (
      <div className="animate-in py-4 text-center duration-300 fade-in zoom-in">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-emerald-500/20 p-4">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
        </div>
        <h2 className="mb-2 font-black text-2xl tracking-tight text-white uppercase">
          You&apos;re Booked!
        </h2>
        <p className="mx-auto mb-8 max-w-xs text-xs leading-relaxed text-stone-400 sm:text-sm">
          Your spot has been reserved for{" "}
          <span className="font-black text-white">{formatEventDate(selectedEvent?.date ?? "")}</span>.
          A confirmation email is on its way.
        </p>
        <Button
          onClick={() => {
            setBooked(false);
            setFormData(emptyForm);
          }}
          className="h-14 w-full rounded-2xl bg-white font-black tracking-widest text-[#26300D] uppercase shadow-lg transition-all hover:bg-stone-200"
        >
          Book Another Spot
        </Button>
      </div>
    );
  }

  if (fullyBooked) {
    return (
      <div className="animate-in py-4 text-center duration-300 fade-in zoom-in">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-500/20 p-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>
        <h2 className="mb-2 font-black text-2xl tracking-tight text-white uppercase">Fully Booked</h2>
        <p className="mx-auto mb-8 max-w-xs text-xs leading-relaxed text-stone-400 sm:text-sm">
          Sorry, we are fully booked for {formatEventDate(selectedEvent?.date ?? "")}. Please keep an eye on our Instagram page{" "}
          <a
            href="https://www.instagram.com/donfenticas"
            target="_blank"
            rel="noopener noreferrer"
            className="font-black text-[#fdcc4b] hover:underline"
          >
            @donfenticas
          </a>{" "}
          for updates.
        </p>
        {events.filter((e) => !e.is_fully_booked).length > 0 && (
          <Button
            onClick={() => {
              const available = events.find((e) => !e.is_fully_booked);
              if (available) setEventId(String(available.id));
            }}
            className="h-14 w-full rounded-2xl bg-white font-black tracking-widest text-[#26300D] uppercase shadow-lg transition-all hover:bg-stone-200"
          >
            Try Another Date
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      {/* Hidden fields consumed by createEventBooking */}
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="full_name" value={formData.fullName} />
      <input
        type="hidden"
        name="group_name"
        value={f.group_name.visible ? formData.groupName.trim() || formData.fullName : formData.fullName}
      />
      <input type="hidden" name="group_size" value={formData.groupSize} />
      <input type="hidden" name="country_code" value={formData.countryCode} />
      <input type="hidden" name="phone_no" value={formData.phoneNo} />
      <input type="hidden" name="special_requests" value={formData.specialRequests} />

      {/* Date selector + group size */}
      <div className="grid grid-cols-1 gap-4 gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses}>
            Select Date <span className="text-red-500">*</span>
          </label>
          <div className="group relative">
            <div className={iconContainerClasses}>
              <CalendarDays className={iconClasses} />
            </div>
            <select
              title="Event Date"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              required
              className={cn(inputBaseClasses, "cursor-pointer appearance-none pr-10")}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {eventOptionLabel(ev)}
                </option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-stone-600" />
          </div>
        </div>

        {f.group_size.visible && (
          <div className="space-y-1">
            <label className={labelClasses}>
              {f.group_size.label} {f.group_size.required && <span className="text-red-500">*</span>}
            </label>
            <div className="group relative">
              <div className={iconContainerClasses}>
                <Users className={iconClasses} />
              </div>
              <select
                title={f.group_size.label}
                name="groupSize"
                required={f.group_size.required}
                value={formData.groupSize}
                onChange={handleInputChange}
                className={cn(inputBaseClasses, "cursor-pointer appearance-none pr-10")}
              >
                {groupSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "person" : "people"}
                  </option>
                ))}
              </select>
              <ChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-stone-600" />
            </div>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className={labelClasses}>
          {f.name.label} <span className="text-red-500">*</span>
        </label>
        <div className="group relative">
          <div className={iconContainerClasses}>
            <User className={iconClasses} />
          </div>
          <input
            type="text"
            name="fullName"
            required
            value={formData.fullName}
            onChange={handleInputChange}
            className={inputBaseClasses}
            placeholder="e.g. Jane Smith"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label className={labelClasses}>
          {f.email.label} <span className="text-red-500">*</span>
        </label>
        <div className="group relative">
          <div className={iconContainerClasses}>
            <Mail className={iconClasses} />
          </div>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            className={inputBaseClasses}
            placeholder="e.g. jane@email.com"
          />
        </div>
      </div>

      {/* Phone (optional per config) */}
      {f.phone.visible && (
        <div className="space-y-1">
          <label className={labelClasses}>
            {f.phone.label} {f.phone.required && <span className="text-red-500">*</span>}
          </label>
          <div className="flex gap-2">
            <CountryCodeSelect
              value={formData.countryCode}
              onChange={(code) => setFormData((prev) => ({ ...prev, countryCode: code }))}
            />
            <div className="group relative flex-1">
              <div className={iconContainerClasses}>
                <Phone className={iconClasses} />
              </div>
              <input
                type="tel"
                name="phoneNo"
                required={f.phone.required}
                value={formData.phoneNo}
                onChange={handleInputChange}
                className={inputBaseClasses}
                placeholder="7123 456789"
              />
            </div>
          </div>
        </div>
      )}

      {/* Group Name (optional per config) */}
      {f.group_name.visible && (
        <div className="space-y-1">
          <label className={labelClasses}>
            {f.group_name.label} {f.group_name.required && <span className="text-red-500">*</span>}
          </label>
          <div className="group relative">
            <div className={iconContainerClasses}>
              <Tag className={iconClasses} />
            </div>
            <input
              type="text"
              name="groupName"
              required={f.group_name.required}
              value={formData.groupName}
              onChange={handleInputChange}
              className={inputBaseClasses}
              placeholder={formData.fullName || "Defaults to your name"}
            />
          </div>
        </div>
      )}

      {/* Price Preview */}
      {hasPricing && (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-5 py-4">
          <div>
            <p className="font-black text-[10px] tracking-widest text-[#fdcc4b]/70 uppercase">Total to Pay</p>
            <p className="font-black text-2xl text-white tabular-nums">£{total.toFixed(2)}</p>
          </div>
          <p className="text-right text-[11px] leading-snug font-bold text-stone-500">
            £{pricePerPerson.toFixed(2)} per person
            <br />× {formData.groupSize} {parseInt(formData.groupSize) === 1 ? "person" : "people"}
          </p>
        </div>
      )}

      {/* Special Requests */}
      {f.special_requests.visible && (
        <div className="space-y-1">
          <label className={labelClasses}>
            {f.special_requests.label} {f.special_requests.required ? <span className="text-red-500">*</span> : "(Optional)"}
          </label>
          <div className="group relative">
            <div className={iconContainerClasses}>
              <MessageSquareQuote className={iconClasses} />
            </div>
            <textarea
              name="specialRequests"
              required={f.special_requests.required}
              value={formData.specialRequests}
              onChange={handleInputChange}
              className={`${inputBaseClasses} min-h-25 resize-none py-3 text-sm`}
              placeholder="Dietary requirements, accessibility needs..."
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm leading-snug font-bold text-red-400">{error}</p>
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#fdcc4b] font-black text-lg tracking-widest text-[#26300D] uppercase shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] transition-all hover:bg-[#e5b843] active:scale-95 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : hasPricing ? (
            <span className="flex items-center">
              Pay &amp; Book — £{total.toFixed(2)} <ChevronRight className="ml-2 h-6 w-6" />
            </span>
          ) : (
            <span className="flex items-center">
              Confirm Booking <ChevronRight className="ml-2 h-6 w-6" />
            </span>
          )}
        </button>
        {hasPricing ? (
          <p className="mt-6 px-4 text-center text-[9px] font-bold tracking-[0.2em] text-stone-600 uppercase opacity-60">
            You&apos;ll be taken to a secure Square checkout to complete payment.
          </p>
        ) : (
          <p className="mt-6 px-4 text-center text-[9px] font-bold tracking-[0.2em] text-stone-600 uppercase opacity-60">
            By booking, you agree to show up or cancel at least 24 hours in advance.
          </p>
        )}
      </div>
    </form>
  );
}
