"use client";

import { useState, useTransition } from "react";
import { createBingoBooking } from "@/app/(public)/_actions/create-bingo-booking";
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

export interface BingoEvent {
  id: number;
  date: string;
  start_time: string | null;
  payment_amount: number | null;
  is_fully_booked: boolean;
}

interface Props {
  events: BingoEvent[];
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function eventOptionLabel(ev: BingoEvent) {
  const time = formatTime(ev.start_time);
  return time ? `${formatEventDate(ev.date)} · ${time}` : formatEventDate(ev.date);
}

export default function BingoBookingForm({ events }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const [formData, setFormData] = useState({
    eventId: String(events[0]?.id ?? ""),
    fullName: "",
    email: "",
    countryCode: "+44",
    phoneNo: "",
    groupName: "",
    groupSize: "1",
    specialRequests: "",
  });

  const selectedEvent =
    events.find((e) => String(e.id) === formData.eventId) ?? events[0];
  const selectedDate = selectedEvent?.date ?? "";
  const fullyBooked = selectedEvent?.is_fully_booked ?? false;
  const hasPricing = !!selectedEvent?.payment_amount && selectedEvent.payment_amount > 0;
  const pricePerPerson = hasPricing ? selectedEvent!.payment_amount! : 0;
  const total = pricePerPerson * parseInt(formData.groupSize || "1");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createBingoBooking(fd);
      if (result.error) {
        setError(result.error);
      } else if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else if (result.success) {
        setBooked(true);
      }
    });
  };

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
          <span className="font-black text-white">{formatEventDate(selectedDate)}</span>.
          A confirmation email is on its way.
        </p>
        <Button
          onClick={() => {
            setBooked(false);
            setFormData({
              eventId: String(events[0]?.id ?? ""),
              fullName: "",
              email: "",
              countryCode: "+44",
              phoneNo: "",
              groupName: "",
              groupSize: "1",
              specialRequests: "",
            });
          }}
          className="h-14 w-full rounded-2xl bg-white font-black tracking-widest text-[#26300D] uppercase shadow-lg transition-all hover:bg-stone-200"
        >
          Book Another Spot
        </Button>
      </div>
    );
  }

  const inputBaseClasses = "w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-stone-700 focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all duration-300 text-sm font-bold";
  const labelClasses = "block text-[10px] font-black text-stone-500 mb-2 uppercase tracking-[0.15em] ml-1";
  const iconContainerClasses = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
  const iconClasses = "w-4 h-4 text-stone-600 transition-colors duration-200 group-focus-within:text-[#fdcc4b]";

  if (fullyBooked) {
    return (
      <div className="animate-in py-4 text-center duration-300 fade-in zoom-in">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-500/20 p-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>
        <h2 className="mb-2 font-black text-2xl tracking-tight text-white uppercase">
          Fully Booked
        </h2>
        <p className="mx-auto mb-8 max-w-xs text-xs leading-relaxed text-stone-400 sm:text-sm">
          Sorry, we are fully booked for {formatEventDate(selectedDate)}. Please keep an eye on our Instagram page{' '}
          <a
            href="https://www.instagram.com/donfenticas"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); window.open('https://www.instagram.com/donfenticas', '_blank') }}
            className="font-black text-[#fdcc4b] hover:underline"
          >
            @donfenticas
          </a>
          {' '}for updates.
        </p>
        {events.filter(e => !e.is_fully_booked).length > 0 && (
          <Button
            onClick={() => {
              const available = events.find(e => !e.is_fully_booked);
              if (available) setFormData(prev => ({ ...prev, eventId: String(available.id) }));
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
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
              name="eventId"
              value={formData.eventId}
              onChange={handleInputChange}
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

        <div className="space-y-1">
          <label className={labelClasses}>
            Number of People <span className="text-red-500">*</span>
          </label>
          <div className="group relative">
            <div className={iconContainerClasses}>
              <Users className={iconClasses} />
            </div>
            <select
              title="Number of People"
              name="groupSize"
              required
              value={formData.groupSize}
              onChange={handleInputChange}
              className={cn(inputBaseClasses, "cursor-pointer appearance-none pr-10")}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-stone-600" />
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] leading-relaxed font-medium text-stone-400">
        For larger bookings please contact us on Instagram at{' '}
        <a
          href="https://www.instagram.com/donfenticas"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { e.preventDefault(); window.open('https://www.instagram.com/donfenticas', '_blank') }}
          className="font-black text-[#fdcc4b] hover:underline"
        >
          @donfenticas
        </a>
      </p>

      <div className="space-y-1">
        <label className={labelClasses}>
          Your Name <span className="text-red-500">*</span>
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

      <div className="space-y-1">
        <label className={labelClasses}>
          Table Name
        </label>
        <div className="group relative">
          <div className={iconContainerClasses}>
            <Tag className={iconClasses} />
          </div>
          <input
            type="text"
            name="groupName"
            value={formData.groupName}
            onChange={handleInputChange}
            className={inputBaseClasses}
            placeholder={formData.fullName || "Defaults to your name"}
          />
        </div>
      </div>
      <input type="hidden" name="event_id" value={formData.eventId} />
      <input type="hidden" name="full_name" value={formData.fullName} />
      <input type="hidden" name="group_name" value={formData.groupName.trim() || formData.fullName} />
      <input type="hidden" name="group_size" value={formData.groupSize} />
      <input type="hidden" name="country_code" value={formData.countryCode} />
      <input type="hidden" name="phone_no" value={formData.phoneNo} />
      <input type="hidden" name="special_requests" value={formData.specialRequests} />

      <div className="space-y-1">
        <label className={labelClasses}>
          Email Address <span className="text-red-500">*</span>
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

      <div className="space-y-1">
        <label className={labelClasses}>Phone Number</label>
        <div className="flex gap-2">
          <div className="group relative w-24 shrink-0">
            <div className={iconContainerClasses}>
              <Flag className={iconClasses} />
            </div>
            <select
              title="Country Code"
              name="countryCode"
              value={formData.countryCode}
              onChange={handleInputChange}
              className={cn(inputBaseClasses, "cursor-pointer appearance-none pr-2 pl-11")}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.iso + c.code} value={c.code}>
                  {c.iso} {c.code}
                </option>
              ))}
            </select>
          </div>
          <div className="group relative flex-1">
            <div className={iconContainerClasses}>
              <Phone className={iconClasses} />
            </div>
            <input
              type="tel"
              name="phoneNo"
              value={formData.phoneNo}
              onChange={handleInputChange}
              className={inputBaseClasses}
              placeholder="7123 456789"
            />
          </div>
        </div>
      </div>

      {hasPricing && (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-5 py-4">
          <div>
            <p className="font-black text-[10px] tracking-widest text-[#fdcc4b]/70 uppercase">
              Total to Pay
            </p>
            <p className="font-black text-2xl text-white tabular-nums">
              £{total.toFixed(2)}
            </p>
          </div>
          <p className="text-right text-[11px] leading-snug font-bold text-stone-500">
            £{pricePerPerson.toFixed(2)} per person
            <br />× {formData.groupSize} {parseInt(formData.groupSize) === 1 ? "person" : "people"}
          </p>
        </div>
      )}

      <div className="space-y-1">
        <label className={labelClasses}>
          Additional Requests (Optional)
        </label>
        <div className="group relative">
          <div className={iconContainerClasses}>
            <MessageSquareQuote className={iconClasses} />
          </div>
          <textarea
            name="specialRequests"
            value={formData.specialRequests}
            onChange={handleInputChange}
            className={`${inputBaseClasses} min-h-25 resize-none py-3 text-sm`}
            placeholder="Dietary requirements, accessibility needs..."
          />
        </div>
      </div>

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
            <span className="flex items-center">Pay & Book - £{total.toFixed(2)} <ChevronRight className="ml-2 h-6 w-6" /></span>
          ) : (
            <span className="flex items-center">Confirm Booking <ChevronRight className="ml-2 h-6 w-6" /></span>
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
