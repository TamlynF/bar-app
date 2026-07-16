"use client";

import React, { useState, useTransition } from "react";

type SignInAction = (formData: FormData) => Promise<{ error: string } | void>;

export default function LoginForm({ signIn }: { signIn: SignInAction }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await signIn(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="block font-black text-[11px] tracking-widest text-stone-400 uppercase">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="staff@donfenticas.co.uk"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-all placeholder:text-stone-600 focus:border-[#FDCC4B]/50 focus:ring-1 focus:ring-[#FDCC4B]/30 focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block font-black text-[11px] tracking-widest text-stone-400 uppercase">
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
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
        {isPending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
