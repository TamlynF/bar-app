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

export interface BingoEvent {
  id: number;
  date: string;
  payment_amount: number | null;
  is_fully_booked: boolean;
}

interface Props {
  events: BingoEvent[];
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BingoBookingForm({ events }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const [formData, setFormData] = useState({
    eventDate: events[0]?.date ?? "",
    fullName: "",
    email: "",
    countryCode: "+44",
    phoneNo: "",
    groupName: "",
    groupSize: "1",
    specialRequests: "",
  });

  const selectedEvent = events.find((e) => e.date === formData.eventDate) ?? events[0];
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
          <span className="font-black text-white">{formatEventDate(formData.eventDate)}</span>.
          A confirmation email is on its way.
        </p>
        <Button
          onClick={() => {
            setBooked(false);
            setFormData({
              eventDate: events[0]?.date ?? "",
              fullName: "",
              email: "",
              countryCode: "+44",
              phoneNo: "",
              groupName: "",
              groupSize: "1",
              specialRequests: "",
            });
          }}
          className="w-full bg-white text-[#26300D] font-black h-14 rounded-2xl uppercase tracking-widest hover:bg-stone-200 transition-all shadow-lg"
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
      <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
          Fully Booked
        </h2>
        <p className="text-stone-400 mb-8 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
          Sorry, we are fully booked for {formatEventDate(formData.eventDate)}. Please keep an eye on our Instagram page{' '}
          <a
            href="https://www.instagram.com/donfenticas"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); window.open('https://www.instagram.com/donfenticas', '_blank') }}
            className="text-[#fdcc4b] font-black hover:underline"
          >
            @donfenticas
          </a>
          {' '}for updates.
        </p>
        {events.filter(e => !e.is_fully_booked).length > 0 && (
          <Button
            onClick={() => {
              const available = events.find(e => !e.is_fully_booked);
              if (available) setFormData(prev => ({ ...prev, eventDate: available.date }));
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
      {/* Date and Group Size Row */}
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
              name="event_date"
              value={formData.eventDate}
              onChange={handleInputChange}
              required
              className={cn(inputBaseClasses, "appearance-none pr-10 cursor-pointer")}
            >
              {events.map((ev) => (
                <option key={ev.date} value={ev.date}>
                  {formatEventDate(ev.date)}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 rotate-90 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1">
          <label className={labelClasses}>
            Number of People <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
            <div className={iconContainerClasses}>
              <Users className={iconClasses} />
            </div>
            <select
              title="Number of People"
              name="group_size"
              required
              value={formData.groupSize}
              onChange={handleInputChange}
              className={cn(inputBaseClasses, "appearance-none pr-10 cursor-pointer")}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Larger bookings notice */}
      <p className="text-[10px] text-stone-400 font-medium leading-relaxed text-center">
        For larger bookings please contact us on Instagram at{' '}
        <a
          href="https://www.instagram.com/donfenticas"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { e.preventDefault(); window.open('https://www.instagram.com/donfenticas', '_blank') }}
          className="text-[#fdcc4b] font-black hover:underline"
        >
          @donfenticas
        </a>
      </p>

      {/* Name */}
      <div className="space-y-1">
        <label className={labelClasses}>
          Your Name <span className="text-red-500">*</span>
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

      {/* Table Name */}
      <div className="space-y-1">
        <label className={labelClasses}>
          Table Name
        </label>
        <div className="relative group">
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
      <input type="hidden" name="full_name" value={formData.fullName} />
      <input type="hidden" name="group_name" value={formData.groupName.trim() || formData.fullName} />

      {/* Email */}
      <div className="space-y-1">
        <label className={labelClasses}>
          Email Address <span className="text-red-500">*</span>
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

      {/* Phone */}
      <div className="space-y-1">
        <label className={labelClasses}>Phone Number</label>
        <div className="flex gap-2">
          <div className="relative group shrink-0 w-24">
            <div className={iconContainerClasses}>
              <Flag className={iconClasses} />
            </div>
            <select
              title="Country Code"
              name="country_code"
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
              name="phone_no"
              value={formData.phoneNo}
              onChange={handleInputChange}
              className={inputBaseClasses}
              placeholder="7123 456789"
            />
          </div>
        </div>
      </div>

      {/* Price Preview */}
      {hasPricing && (
        <div className="bg-black/40 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#fdcc4b]/70">
              Total to Pay
            </p>
            <p className="text-2xl font-black text-white tabular-nums">
              £{total.toFixed(2)}
            </p>
          </div>
          <p className="text-[11px] font-bold text-stone-500 text-right leading-snug">
            £{pricePerPerson.toFixed(2)} per person
            <br />× {formData.groupSize} {parseInt(formData.groupSize) === 1 ? "person" : "people"}
          </p>
        </div>
      )}

      {/* Special Requests */}
      <div className="space-y-1">
        <label className={labelClasses}>
          Additional Requests (Optional)
        </label>
        <div className="relative group">
          <div className={iconContainerClasses}>
            <MessageSquareQuote className={iconClasses} />
          </div>
          <textarea
            name="special_requests"
            value={formData.specialRequests}
            onChange={handleInputChange}
            className={`${inputBaseClasses} min-h-[100px] py-3 text-sm resize-none`}
            placeholder="Dietary requirements, accessibility needs..."
          />
        </div>
      </div>

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
            <span className="flex items-center">Pay & Book — £{total.toFixed(2)} <ChevronRight className="ml-2 w-6 h-6" /></span>
          ) : (
            <span className="flex items-center">Confirm Booking <ChevronRight className="ml-2 w-6 h-6" /></span>
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
