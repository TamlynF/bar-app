"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { updatePassword } from "./actions";

// The submit button must be a child of the form to use useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 bg-[#26300D] hover:bg-[#1a2109] disabled:bg-[#26300D]/70 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors mt-2 flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Saving Password...
        </>
      ) : (
        "Save Password"
      )}
    </button>
  );
}

export function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    setError(null);
    const result = await updatePassword(formData);
    
    // If the server action returned an error, display it
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <form action={handleAction} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
          {error}
        </div>
      )}
      
      <div className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-widest text-[#26300D]">
          New Password
        </label>
        <input
          type="password"
          name="password"
                  required
                  placeholder="••••••••"
          minLength={6}
          className="w-full px-4 py-3 bg-white border border-[#E6DFC8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#26300D]"
        />
      </div>
      
      <div className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-widest text-[#26300D]">
          Confirm Password
        </label>
        <input
          type="password"
          name="confirmPassword"
                  required
                  placeholder="••••••••"
          minLength={6}
          className="w-full px-4 py-3 bg-white border border-[#E6DFC8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#26300D]"
        />
      </div>

      <SubmitButton />
    </form>
  );
}