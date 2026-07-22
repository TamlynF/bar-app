import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "./actions";
import LoginForm from "./_components/login-form";

export const metadata = {
  title: "Staff Login | Don Fenticas",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

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
          <p className="mt-1 text-xs font-medium tracking-widest text-stone-500 uppercase">Staff Portal</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <LoginForm signIn={signIn} />
        </div>

        <p className="mt-6 text-center text-[10px] font-bold tracking-widest text-stone-700 uppercase">
          Authorised Staff Only
        </p>
      </div>
    </main>
  );
}
