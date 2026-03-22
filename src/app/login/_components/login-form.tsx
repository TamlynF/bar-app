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
        <label className="block text-[11px] font-black uppercase tracking-widest text-stone-400">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="staff@donfenticas.co.uk"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FDCC4B]/50 focus:ring-1 focus:ring-[#FDCC4B]/30 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-black uppercase tracking-widest text-stone-400">
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
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
        {isPending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
