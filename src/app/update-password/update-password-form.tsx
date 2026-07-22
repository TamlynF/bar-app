"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { updatePassword } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#26300D] font-black text-[11px] tracking-widest text-white uppercase transition-colors hover:bg-[#1a2109] disabled:bg-[#26300D]/70"
    >
      {pending ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
    
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <form action={handleAction} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}
      
      <div className="space-y-1.5">
        <label className="font-black text-xs tracking-widest text-[#26300D] uppercase">
          New Password
        </label>
        <input
          type="password"
          name="password"
                  required
                  placeholder="••••••••"
          minLength={6}
          className="w-full rounded-xl border border-[#E6DFC8] bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-[#26300D] focus:outline-none"
        />
      </div>
      
      <div className="space-y-1.5">
        <label className="font-black text-xs tracking-widest text-[#26300D] uppercase">
          Confirm Password
        </label>
        <input
          type="password"
          name="confirmPassword"
                  required
                  placeholder="••••••••"
          minLength={6}
          className="w-full rounded-xl border border-[#E6DFC8] bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-[#26300D] focus:outline-none"
        />
      </div>

      <SubmitButton />
    </form>
  );
}