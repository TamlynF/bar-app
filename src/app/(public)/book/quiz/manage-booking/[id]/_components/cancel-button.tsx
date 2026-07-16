"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  Users,
  User,
  Beer,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  AlertCircle,
  ChevronDown,
  Info,
  MessageSquareQuote
} from "lucide-react";
import { cancelBooking } from "../../../../../_actions/cancel-booking";
import { updateBooking } from "../../../../../_actions/update-booking";
import { checkTeamName } from "../../../../../_actions/create-booking";
import { getAvailableTablesForEvent } from "../actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface ManageBooking {
  id: string | number;
  event_id: string | number;
  group_name: string | null;
  group_size: number | null;
  status: string | null;
  special_requests: string | null; // Added field to interface
  events: {
    id: string | number;
    event_date: string | null;
    event_title: string | null;
  } | null;
  contacts: {
    full_name: string | null;
    email: string | null;
  } | null;
  booking_table_mappings: {
    tables: {
      id: number;
      name: string;
      max_capacity: number;
    } | null;
  }[] | null;
}

const inputBaseClasses = "w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-stone-700 focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all duration-300 text-sm font-bold appearance-none";
const labelClasses = "block text-[10px] font-black text-[#fdcc4b]/70 mb-2 uppercase tracking-[0.15em] ml-1";
const iconContainerClasses = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
const iconClasses = "w-4 h-4 text-[#fdcc4b]/40 transition-colors duration-200";

export default function CancelButton({
  booking,
  isCancelled
}: {
  booking: ManageBooking;
  isCancelled: boolean;
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [blockedMsg, setBlockedMsg] = useState("");

  const [teamName, setTeamName] = useState(booking.group_name || "");
  const [teamSize, setTeamSize] = useState(booking.group_size || 4);
  const [specialRequests, setSpecialRequests] = useState(booking.special_requests || ""); // State for special requests

  // Seating validation state
  const [seatingWarning, setSeatingWarning] = useState<string | null>(null);
  const [isCheckingSeating, setIsCheckingSeating] = useState(false);

  // Real-time validation state
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameError, setNameError] = useState("");

  const eventDateStr = booking.events?.event_date;
  const eventDate = eventDateStr ? new Date(eventDateStr) : null;

  // Logic to handle group size change validation
  useEffect(() => {
    if (!isEditing) return;

    const validateSeating = async () => {
      // Rule: Only check for confirmed bookings when size changes
      if (booking.status?.toLowerCase() !== 'confirmed' || teamSize === booking.group_size) {
        setSeatingWarning(null);
        return;
      }

      const currentTable = booking.booking_table_mappings?.[0]?.tables;

      // Check if new size exceeds current table capacity
      if (currentTable && teamSize > (currentTable.max_capacity || 0)) {
        setIsCheckingSeating(true);
        try {
          // Check if there are other tables that can fit the new size
          const available = await getAvailableTablesForEvent(
            String(booking.event_id),
            teamSize,
            String(currentTable.id)
          );

          if (!available || available.length === 0) {
            setSeatingWarning("This change requires a bigger table, but none are currently available. Your status may be moved to 'Pending' for manual review by the bar.");
          } else {
            setSeatingWarning(null);
          }
        } catch (err) {
          console.error("Seating validation error:", err);
        } finally {
          setIsCheckingSeating(false);
        }
      } else {
        setSeatingWarning(null);
      }
    };

    const timer = setTimeout(validateSeating, 400);
    return () => clearTimeout(timer);
  }, [teamSize, isEditing, booking]);

  // Real-time duplicate check while editing
  useEffect(() => {
    if (!isEditing || teamName.trim().toLowerCase() === (booking.group_name || "").toLowerCase()) {
      setNameError("");
      return;
    }

    const validateName = async () => {
      if (teamName.trim().length < 2) return;
      if (!eventDateStr) return;

      setIsCheckingName(true);
      try {
        const { isAvailable } = await checkTeamName(teamName, eventDateStr, booking.id);
        if (!isAvailable) {
          setNameError("This team name is already taken for this night.");
        } else {
          setNameError("");
        }
      } catch (err) {
        console.error("Validation error:", err);
      } finally {
        setIsCheckingName(false);
      }
    };

    const timer = setTimeout(validateName, 500);
    return () => clearTimeout(timer);
  }, [teamName, isEditing, eventDateStr, booking.id, booking.group_name]);

  const handleCancel = async () => {
    const ok = await confirm({
      title: "Cancel booking",
      description: "Are you sure you want to cancel this booking? This action cannot be undone.",
      confirmLabel: "Cancel booking",
      variant: "destructive",
    });
    if (!ok) return;

    setIsCancelling(true);
    setError("");
    setSuccessMsg("");

    const response = await cancelBooking(booking.id);

    if (!response.success) {
      setError(response.error || "Failed to cancel booking.");
      setIsCancelling(false);
    }
  };

  const handleUpdate = async () => {
    if (nameError) return;

    setIsUpdating(true);
    setError("");
    setSuccessMsg("");
    setBlockedMsg("");

    const response = await updateBooking(booking.id, {
      group_name: teamName,
      group_size: teamSize,
      special_requests: specialRequests // Save special requests
    });

    const blocked = !response.success && (response as { blocked?: boolean }).blocked;

    if (response.success) {
      setSuccessMsg("Changes saved successfully.");
      setIsEditing(false);
      // Success message will be cleared if they open edit mode again
    } else if (blocked) {
      // No seating available for the larger group — nothing was changed.
      setBlockedMsg(
        response.error || "There's no available space for that group size. Please contact the bar."
      );
    } else {
      setError(response.error || "Failed to update booking.");
    }

    setIsUpdating(false);
  };

  return (
    <div className="w-full">
      {/* 1. STATUS HEADER */}
      <div className="mb-8 animate-in text-center duration-500 fade-in">
        {isEditing ? (
           <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#fdcc4b]/20 bg-[#fdcc4b]/10 px-3 py-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fdcc4b]" />
              <span className="font-black text-[10px] tracking-widest text-[#fdcc4b] uppercase">Editing Mode</span>
           </div>
        ) : (
          <>
            {isCancelled ? (
              <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
            ) : (
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-[#fdcc4b] drop-shadow-[0_0_15px_rgba(253,204,75,0.3)]" />
            )}
          </>
        )}

        <h1 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">
          {isEditing ? "Modify Team" : isCancelled ? "Booking Cancelled" : "Your Booking"}
        </h1>

        {!isEditing && (
          <p className="mt-2 text-xs font-bold tracking-widest text-stone-500 uppercase sm:text-sm">Ref: #{booking.id}</p>
        )}
      </div>

      {/* 2. ERROR & FEEDBACK MESSAGES */}
      {(error || nameError) && (
        <div className="mb-6 flex animate-in items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 slide-in-from-top-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-xs leading-snug font-bold tracking-tight text-red-400 uppercase">{error || nameError}</p>
        </div>
      )}

      {seatingWarning && isEditing && (
        <div className="mb-6 flex animate-in items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 slide-in-from-top-2">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-xs leading-snug font-bold tracking-tight text-amber-400 uppercase">{seatingWarning}</p>
        </div>
      )}

      {blockedMsg && (
        <div className="mb-6 animate-in rounded-2xl border border-[#FF6B35]/30 bg-[#7A1F1F]/20 p-4 slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6B35]" />
            <p className="text-xs leading-snug font-bold tracking-tight text-[#FFF4CC] uppercase">{blockedMsg}</p>
          </div>
          <a
            href="/contact"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-[#fdcc4b] px-5 font-black text-xs tracking-widest text-[#26300D] uppercase transition-colors hover:bg-[#e5b843]"
          >
            Contact the bar
          </a>
        </div>
      )}

      {successMsg && !isEditing && (
        <div className="mb-6 flex animate-in items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 fade-in">
           <CheckCircle className="h-4 w-4 text-emerald-400" />
           <p className="font-black text-xs tracking-widest text-emerald-400 uppercase">{successMsg}</p>
        </div>
      )}

      {/* 3. MAIN CONTENT: VIEW OR EDIT */}
      {isEditing ? (
        /* EDIT MODE FORM */
        <div className="animate-in space-y-6 duration-300 fade-in slide-in-from-bottom-4">
          <div className="space-y-1.5">
            <label htmlFor="teamName" className={labelClasses}>Team Name</label>
            <div className="group relative">
              <div className={iconContainerClasses}>
                <Beer className={iconClasses} />
              </div>
              <input
                id="teamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className={cn(inputBaseClasses, nameError && "border-red-500/50")}
                placeholder="e.g. Quizzy McQuizface"
                autoFocus
              />
              {isCheckingName && (
                <div className="absolute top-1/2 right-4 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#fdcc4b]" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="teamSize" className={labelClasses}>Team Size</label>
            <div className="group relative">
              <div className={iconContainerClasses}>
                <Users className={iconClasses} />
              </div>
              <select
                id="teamSize"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className={inputBaseClasses}
              >
                {[4, 5, 6].map(num => (
                  <option key={num} value={num}>{num} People</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[#fdcc4b]/40">
                {isCheckingSeating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>
          </div>

          {/* Added Special Requests Input in Edit Mode */}
          <div className="space-y-1.5">
            <label htmlFor="specialRequests" className={labelClasses}>Additional Requests</label>
            <div className="group relative">
              <div className={iconContainerClasses}>
                <MessageSquareQuote className={iconClasses} />
              </div>
              <textarea
                id="specialRequests"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className={`${inputBaseClasses} min-h-25 resize-none py-3 text-sm`}
                placeholder="Dietary requirements, table preference..."
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isUpdating || !!nameError || isCheckingName || isCheckingSeating}
              className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#fdcc4b] font-black text-lg tracking-widest text-[#26300D] uppercase shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] transition-all hover:bg-[#e5b843] active:scale-95 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Save className="mr-2 h-6 w-6" /> Update Record</>}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setTeamName(booking.group_name || "");
                setTeamSize(booking.group_size || 4);
                setSpecialRequests(booking.special_requests || "");
                setNameError("");
                setSeatingWarning(null);
                setBlockedMsg("");
              }}
              disabled={isUpdating}
              className="h-14 w-full rounded-2xl border-2 border-white/10 font-black text-xs tracking-widest text-stone-400 uppercase transition-all hover:bg-white/5"
            >
              Discard Changes
            </button>
          </div>
        </div>
      ) : (
        /* VIEW MODE DETAILS CARD */
        <div className="animate-in space-y-8 duration-500 fade-in">
          <div className="group relative space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner sm:p-8">
            <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 bg-[#fdcc4b]/5 blur-3xl transition-colors group-hover:bg-[#fdcc4b]/10" />

            <DetailRow icon={<CalendarDays />} label="Quiz Night" value={eventDate ? format(eventDate, "do MMMM yyyy") : "TBD"} />
            <DetailRow icon={<Beer />} label="Team Name" value={booking.group_name || "Guest Team"} />
            <DetailRow icon={<Users />} label="Team Size" value={`${booking.group_size} People`} />
            <DetailRow icon={<User />} label="Lead Booker" value={booking.contacts?.full_name || "N/A"} />

            {/* Displaying Special Requests in View Mode */}
            {booking.special_requests && (
              <DetailRow
                icon={<MessageSquareQuote />}
                label="Special Requests"
                value={booking.special_requests}
              />
            )}
          </div>

          {!isCancelled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                disabled={isCancelling}
                className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#fdcc4b] font-black text-sm tracking-widest text-[#26300D] uppercase shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#e5b843] active:scale-95 disabled:opacity-50"
              >
                Modify Team
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex h-16 w-full items-center justify-center rounded-2xl border-2 border-red-500/30 font-black text-xs tracking-widest text-red-500 uppercase transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:text-white active:scale-95 disabled:opacity-50"
              >
                {isCancelling ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cancel Booking"}
              </button>
            </div>
          )}

          <div className="text-center">
            <p className="font-black text-[9px] tracking-[0.4em] text-stone-600 uppercase opacity-40">
              Booking Management Portal
            </p>
          </div>
        </div>
      )}
      {ConfirmDialogUI}
    </div>
  );
}

/**
 * Enhanced row for displaying booking data with high contrast and icons
 */
function DetailRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start">
      <div className="mr-4 shrink-0 rounded-2xl border border-[#fdcc4b]/20 bg-[#26300D] p-3 text-[#fdcc4b] shadow-lg">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
              className: "w-5 h-5"
            })
          : icon}
      </div>
      <div className="min-w-0 pt-1 text-left">
        <p className="mb-0.5 font-black text-[10px] leading-none tracking-[0.15em] text-[#fdcc4b]/50 uppercase">{label}</p>
        <p className="font-black text-lg leading-tight tracking-tight wrap-break-word whitespace-pre-wrap text-white sm:text-xl">{value}</p>
      </div>
    </div>
  );
}
