"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Users, User, Beer, CheckCircle, XCircle, Loader2, Save, ArrowLeft } from "lucide-react";
// Using relative paths to resolve resolution issues in the build environment
import { cancelBooking } from "../../../_actions/cancel-booking";
import { updateBooking } from "../../../_actions/update-booking";

/**
 * Interface representing the booking data required for management
 */
export interface ManageBooking {
  id: string | number;
  group_name: string | null;
  group_size: number | null;
  status: string | null;
  events: {
    event_date: string | null;
    event_title: string | null;
  } | null;
  contacts: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function CancelButton({ 
  booking,
  isCancelled
}: { 
  booking: ManageBooking;
  isCancelled: boolean;
}) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [teamName, setTeamName] = useState(booking.group_name || "");
  const [teamSize, setTeamSize] = useState(booking.group_size || 4);

  const eventDate = booking.events?.event_date ? new Date(booking.events.event_date) : null;

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this booking? This action cannot be undone.")) {
      return;
    }

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
    setIsUpdating(true);
    setError("");
    setSuccessMsg("");

    const response = await updateBooking(booking.id, {
      group_name: teamName,
      group_size: teamSize,
    });

    if (response.success) {
      setSuccessMsg("Booking updated successfully!");
      setIsEditing(false);
    } else {
      setError(response.error || "Failed to update booking.");
    }
    
    setIsUpdating(false);
  };

  return (
    <div className="w-full">
      {/* HEADER: Hidden when editing to focus on the form as requested */}
      {!isEditing && (
        <div className="text-center mb-8 animate-in fade-in duration-500">
          {isCancelled ? (
            <XCircle className="mx-auto h-20 w-20 text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
          ) : (
            <CheckCircle className="mx-auto h-20 w-20 text-[#fdcc4b] mb-4 drop-shadow-[0_0_15px_rgba(253,204,75,0.3)]" />
          )}
          
          <h1 className="text-3xl font-black text-white tracking-wide uppercase leading-tight">
            {isCancelled ? "Booking Cancelled" : "You're Locked In!"}
          </h1>
          <p className="text-[#fdcc4b]/70 mt-2 font-medium">Booking Reference: #{booking.id}</p>
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center mb-4 font-bold">{error}</p>}
      {successMsg && <p className="text-green-400 text-sm font-bold text-center mb-4">{successMsg}</p>}
      
      {isEditing ? (
        /* EDIT MODE: Only the fields to be edited are shown */
        <div className="bg-black/40 p-6 rounded-2xl border border-[#fdcc4b]/30 space-y-6 text-left animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between border-b border-[#fdcc4b]/10 pb-4 mb-2">
            <h3 className="text-[#fdcc4b] font-black uppercase tracking-wider text-base">Modify Your Team</h3>
            <button title="View" onClick={() => setIsEditing(false)} className="text-[#fdcc4b]/40 hover:text-[#fdcc4b] transition-colors">
               <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="teamName" className="block text-[10px] font-black text-[#fdcc4b]/70 uppercase tracking-widest ml-1">Team Name</label>
            <div className="relative">
              <Beer className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fdcc4b]/40" />
              <input
                id="teamName"
                type="text" 
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-black/60 border border-[#fdcc4b]/20 rounded-xl pl-11 pr-4 py-4 text-white focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="teamSize" className="block text-[10px] font-black text-[#fdcc4b]/70 uppercase tracking-widest ml-1">Team Size</label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fdcc4b]/40" />
              <select 
                id="teamSize"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-full bg-black/60 border border-[#fdcc4b]/20 rounded-xl pl-11 pr-4 py-4 text-white focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all appearance-none font-bold"
              >
                {[4, 5, 6].map(num => (
                  <option key={num} value={num}>{num} People</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex-1 bg-[#fdcc4b] text-[#26300D] font-black py-4 rounded-xl uppercase tracking-widest hover:bg-[#e5b843] transition-all disabled:opacity-50 active:scale-95 shadow-lg flex items-center justify-center gap-2"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={isUpdating}
              className="flex-1 border-2 border-[#fdcc4b]/30 text-[#fdcc4b] font-black py-4 rounded-xl uppercase tracking-widest hover:bg-[#fdcc4b]/5 transition-all disabled:opacity-50 active:scale-95"
            >
              Discard
            </button>
          </div>
        </div>
      ) : (
        /* VIEW MODE: Details Card + Side-by-side buttons */
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Booking Details Card - Visible only in View Mode */}
          <div className="bg-black/40 rounded-2xl p-6 border border-[#fdcc4b]/20 space-y-5">
            <DetailRow icon={<CalendarDays />} label="Date" value={eventDate ? format(eventDate, "do MMMM yyyy") : "Unknown Date"} />
            <DetailRow icon={<Beer />} label="Team Name" value={booking.group_name || "N/A"} />
            <DetailRow icon={<Users />} label="Team Size" value={`${booking.group_size} People`} />
            <DetailRow icon={<User />} label="Booked By" value={booking.contacts?.full_name || "N/A"} />
          </div>

          {!isCancelled && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsEditing(true)}
                disabled={isCancelling}
                className="w-full py-4 px-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 border-2 bg-[#fdcc4b] border-[#fdcc4b] text-[#26300D] hover:bg-[#e5b843] hover:-translate-y-0.5 shadow-lg active:scale-95 disabled:opacity-50"
              >
                Edit Booking
              </button>

              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full py-4 px-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 border-2 bg-transparent border-red-500 text-red-500 hover:bg-red-500 hover:text-white hover:-translate-y-0.5 active:scale-95"
              >
                {isCancelling ? "Wait..." : "Cancel Booking"}
              </button>
            </div>
          )}
          
          <p className="text-center text-[#fdcc4b]/30 text-[9px] uppercase tracking-[0.25em] font-black pt-2">
            Account Management
          </p>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center">
      <div className="bg-black/40 p-3 rounded-xl mr-4 border border-[#fdcc4b]/10 text-[#fdcc4b]/80">
        {React.cloneElement(icon as React.ReactElement)}
      </div>
      <div className="text-left">
        <p className="text-xs font-bold text-[#fdcc4b]/60 uppercase tracking-wider">{label}</p>
        <p className="text-white font-medium text-lg leading-tight">{value}</p>
      </div>
    </div>
  );
}