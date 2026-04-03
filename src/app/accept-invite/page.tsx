"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { markInviteAcceptedAction } from "@/app/(private)/settings/users/actions";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Explicitly exchange the hash token into a cookie-based session.
  // onAuthStateChange alone isn't enough — @supabase/ssr stores sessions in
  // cookies, so we must call setSession() to persist it before updateUser().
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("No valid invite link found. Please request a new one from your admin.");
      return;
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        if (error || !data.session?.user) {
          setError("This link has expired or already been used. Please request a new one from your admin.");
        } else {
          setReady(true);
          window.history.replaceState(null, "", window.location.pathname);
        }
      });
  }, [supabase]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password")?.toString() ?? "";
    const confirm = formData.get("confirm")?.toString() ?? "";

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 7) {
      setError("Password must be at least 7 characters.");
      return;
    }

    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        await markInviteAcceptedAction();
        router.replace("/dashboard");
      }
    });
  }

  return (
    <main className="min-h-dvh w-full bg-[#26300D] flex items-center justify-center px-4">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; }`
      }} />

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FDCC4B] mb-4 shadow-lg">
            <span className="text-[#26300D] font-black text-xl">DF</span>
          </div>
          <h1 className="text-white font-black text-2xl uppercase tracking-widest">Don Fenticas</h1>
          <p className="text-stone-500 text-xs mt-1 uppercase tracking-widest font-medium">Set Your Password</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          {!ready && !error ? (
            <p className="text-stone-400 text-sm text-center py-4">Verifying your invite…</p>
          ) : error ? (
            <p className="text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
              {error}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-widest text-stone-400">
                  New Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FDCC4B]/50 focus:ring-1 focus:ring-[#FDCC4B]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-widest text-stone-400">
                  Confirm Password
                </label>
                <input
                  name="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FDCC4B]/50 focus:ring-1 focus:ring-[#FDCC4B]/30 transition-all"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-[#FDCC4B] text-[#26300D] font-black text-sm uppercase tracking-wider rounded-xl py-3.5 transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FDCC4B]/20"
              >
                {isPending ? "Setting password…" : "Set Password & Continue"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-stone-700 text-[10px] uppercase tracking-widest mt-6 font-bold">
          Authorised Staff Only
        </p>
      </div>
    </main>
  );
}
