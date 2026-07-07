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
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { COUNTRY_CODES } from "@/lib/country-codes";
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
      <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-emerald-500/20">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
          You&apos;re Booked!
        </h2>
        <p className="text-stone-400 mb-8 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
          Your spot has been reserved for{" "}
          <span className="font-black text-white">{formatEventDate(selectedEvent?.date ?? "")}</span>.
          A confirmation email is on its way.
        </p>
        <Button
          onClick={() => {
            setBooked(false);
            setFormData(emptyForm);
          }}
          className="w-full bg-white text-[#26300D] font-black h-14 rounded-2xl uppercase tracking-widest hover:bg-stone-200 transition-all shadow-lg"
        >
          Book Another Spot
        </Button>
      </div>
    );
  }

  if (fullyBooked) {
    return (
      <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Fully Booked</h2>
        <p className="text-stone-400 mb-8 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
          Sorry, we are fully booked for {formatEventDate(selectedEvent?.date ?? "")}. Please keep an eye on our Instagram page{" "}
          <a
            href="https://www.instagram.com/donfenticas"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#fdcc4b] font-black hover:underline"
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
            className="w-full bg-white text-[#26300D] font-black h-14 rounded-2xl uppercase tracking-widest hover:bg-stone-200 transition-all shadow-lg"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-1">
          <label className={labelClasses}>
            Select Date <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
            <div className={iconContainerClasses}>
              <CalendarDays className={iconClasses} />
            </div>
            <select
              title="Event Date"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              required
              className={cn(inputBaseClasses, "appearance-none pr-10 cursor-pointer")}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {eventOptionLabel(ev)}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 rotate-90 pointer-events-none" />
          </div>
        </div>

        {f.group_size.visible && (
          <div className="space-y-1">
            <label className={labelClasses}>
              {f.group_size.label} {f.group_size.required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative group">
              <div className={iconContainerClasses}>
                <Users className={iconClasses} />
              </div>
              <select
                title={f.group_size.label}
                name="groupSize"
                required={f.group_size.required}
                value={formData.groupSize}
                onChange={handleInputChange}
                className={cn(inputBaseClasses, "appearance-none pr-10 cursor-pointer")}
              >
                {groupSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "person" : "people"}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 rotate-90 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className={labelClasses}>
          {f.name.label} <span className="text-red-500">*</span>
        </label>
        <div className="relative group">
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
        <div className="relative group">
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
            <div className="relative group shrink-0 w-24">
              <div className={iconContainerClasses}>
                <Flag className={iconClasses} />
              </div>
              <select
                title="Country Code"
                name="countryCode"
                value={formData.countryCode}
                onChange={handleInputChange}
                className={cn(inputBaseClasses, "pl-11 pr-2 appearance-none cursor-pointer")}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.iso + c.code} value={c.code}>
                    {c.iso} {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative group flex-1">
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
          <div className="relative group">
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
        <div className="bg-black/40 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#fdcc4b]/70">Total to Pay</p>
            <p className="text-2xl font-black text-white tabular-nums">£{total.toFixed(2)}</p>
          </div>
          <p className="text-[11px] font-bold text-stone-500 text-right leading-snug">
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
          <div className="relative group">
            <div className={iconContainerClasses}>
              <MessageSquareQuote className={iconClasses} />
            </div>
            <textarea
              name="specialRequests"
              required={f.special_requests.required}
              value={formData.specialRequests}
              onChange={handleInputChange}
              className={`${inputBaseClasses} min-h-25 py-3 text-sm resize-none`}
              placeholder="Dietary requirements, accessibility needs..."
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 font-bold leading-snug">{error}</p>
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center h-16 rounded-2xl bg-[#fdcc4b] hover:bg-[#e5b843] text-[#26300D] font-black text-lg uppercase tracking-widest transition-all shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] active:scale-95 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : hasPricing ? (
            <span className="flex items-center">
              Pay &amp; Book — £{total.toFixed(2)} <ChevronRight className="ml-2 w-6 h-6" />
            </span>
          ) : (
            <span className="flex items-center">
              Confirm Booking <ChevronRight className="ml-2 w-6 h-6" />
            </span>
          )}
        </button>
        {hasPricing ? (
          <p className="text-center text-stone-600 text-[9px] mt-6 uppercase tracking-[0.2em] font-bold opacity-60 px-4">
            You&apos;ll be taken to a secure Square checkout to complete payment.
          </p>
        ) : (
          <p className="text-center text-stone-600 text-[9px] mt-6 uppercase tracking-[0.2em] font-bold opacity-60 px-4">
            By booking, you agree to show up or cancel at least 24 hours in advance.
          </p>
        )}
      </div>
    </form>
  );
}
