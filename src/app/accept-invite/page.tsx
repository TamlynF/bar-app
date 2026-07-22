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

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <main className="flex min-h-dvh w-full items-center justify-center bg-[#26300D] px-4">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; }`
      }} />

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FDCC4B] shadow-lg">
            <span className="font-black text-xl text-[#26300D]">DF</span>
          </div>
          <h1 className="font-black text-2xl tracking-widest text-white uppercase">Don Fenticas</h1>
          <p className="mt-1 text-xs font-medium tracking-widest text-stone-500 uppercase">Set Your Password</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          {!ready && !error ? (
            <p className="py-4 text-center text-sm text-stone-400">Verifying your invite…</p>
          ) : error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-xs font-medium text-red-400">
              {error}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block font-black text-[11px] tracking-widest text-stone-400 uppercase">
                  New Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-all placeholder:text-stone-600 focus:border-[#FDCC4B]/50 focus:ring-1 focus:ring-[#FDCC4B]/30 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-black text-[11px] tracking-widest text-stone-400 uppercase">
                  Confirm Password
                </label>
                <input
                  name="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-all placeholder:text-stone-600 focus:border-[#FDCC4B]/50 focus:ring-1 focus:ring-[#FDCC4B]/30 focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-[#FDCC4B] py-3.5 font-black text-sm tracking-wider text-[#26300D] uppercase shadow-lg shadow-[#FDCC4B]/20 transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Setting password…" : "Set Password & Continue"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] font-bold tracking-widest text-stone-700 uppercase">
          Authorised Staff Only
        </p>
      </div>
    </main>
  );
}
