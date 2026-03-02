"use client";

import React, { useState } from "react";
import { cancelBooking } from "@/app/(public)/_actions/cancel-booking";
import { updateBooking } from "@/app/(public)/_actions/update-booking";

export default function CancelButton({ 
  bookingId, 
  currentTeamName = "", 
  currentTeamSize = 4 
}: { 
  bookingId: string | number;
  currentTeamName?: string;
  currentTeamSize?: number;
}) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [teamName, setTeamName] = useState(currentTeamName);
  const [teamSize, setTeamSize] = useState(currentTeamSize);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this booking? This action cannot be undone.")) {
      return;
    }

    setIsCancelling(true);
    setError("");
    setSuccessMsg("");

    const response = await cancelBooking(bookingId);

    if (!response.success) {
      setError(response.error || "Failed to cancel booking.");
      setIsCancelling(false);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setError("");
    setSuccessMsg("");

    const response = await updateBooking(bookingId, {
      group_name: teamName,
      group_size: teamSize,
    });

    if (response.success) {
      setSuccessMsg("Booking updated successfully!");
      setIsEditing(false); // Close edit mode on success
    } else {
      setError(response.error || "Failed to update booking.");
    }
    
    setIsUpdating(false);
  };

  return (
    <div className="mt-8">
      {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
      {successMsg && <p className="text-green-400 text-sm font-bold text-center mb-4">{successMsg}</p>}
      
      {isEditing ? (
        <div className="bg-black/40 p-5 rounded-2xl border border-[#fdcc4b]/30 space-y-4 text-left animate-in fade-in slide-in-from-bottom-2">
          <h3 className="text-[#fdcc4b] font-bold uppercase tracking-wider text-sm mb-4">Edit Team Details</h3>
          
          <div>
            <label htmlFor="teamName" className="block text-xs font-bold text-[#fdcc4b]/90 mb-2 uppercase tracking-wider ml-1">Team Name</label>
            <input
               id="teamName"
              name="teamName"
              title="Team Name"
              type="text" 
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full bg-black/60 border border-[#fdcc4b]/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all"
            />
          </div>

          <div>
            <label htmlFor="teamSize" className="block text-xs font-bold text-[#fdcc4b]/90 mb-2 uppercase tracking-wider ml-1">Team Size</label>
            <select 
              id="teamSize"
              name="teamSize"
              title="Team Size"
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="w-full bg-[#1e260a] border border-[#fdcc4b]/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all appearance-none"
            >
              {[4, 5, 6].map(num => (
                <option key={num} value={num}>{num} People</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex-1 bg-[#fdcc4b] text-[#26300D] font-black py-3 rounded-xl uppercase tracking-wider hover:bg-[#e5b843] transition-colors disabled:opacity-50"
            >
              {isUpdating ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setTeamName(currentTeamName); // Reset to original if they cancel edit
                setTeamSize(currentTeamSize);
              }}
              disabled={isUpdating}
              className="flex-1 border border-[#fdcc4b]/50 text-[#fdcc4b] font-bold py-3 rounded-xl uppercase tracking-wider hover:bg-[#fdcc4b]/10 transition-colors disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setIsEditing(true)}
            disabled={isCancelling}
            className="w-full py-4 px-6 rounded-xl font-black text-lg uppercase tracking-widest transition-all duration-300 border-2 bg-[#fdcc4b] border-[#fdcc4b] text-[#26300D] hover:bg-[#e5b843] hover:-translate-y-1 shadow-[0_0_15px_rgba(253,204,75,0.2)] hover:shadow-[0_5px_20px_rgba(253,204,75,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit Booking
          </button>

          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className={`w-full py-4 px-6 rounded-xl font-black text-lg uppercase tracking-widest transition-all duration-300 border-2 ${
              isCancelling
                ? "bg-red-500/50 border-red-500/50 text-white cursor-not-allowed"
                : "bg-transparent border-red-500 text-red-500 hover:bg-red-500 hover:text-white hover:-translate-y-1 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_5px_20px_rgba(239,68,68,0.3)]"
            }`}
          >
            {isCancelling ? "Cancelling..." : "Cancel Reservation"}
          </button>
        </div>
      )}
      
      {!isEditing && (
        <p className="text-center text-[#fdcc4b]/50 text-xs mt-4">
          Need to make changes? Update your team details or cancel if you can no longer make it.
        </p>
      )}
    </div>
  );
}