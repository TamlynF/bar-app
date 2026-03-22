import React from "react";
import { signIn } from "./actions";
import LoginForm from "./_components/login-form";

export const metadata = {
  title: "Staff Login | Don Fenticas",
};

export default function LoginPage() {
  return (
    <main className="min-h-dvh w-full bg-[#26300D] flex items-center justify-center px-4">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; }`
      }} />

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FDCC4B] mb-4 shadow-lg">
            <span className="text-[#26300D] font-black text-xl">DF</span>
          </div>
          <h1 className="text-white font-black text-2xl uppercase tracking-widest">Don Fenticas</h1>
          <p className="text-stone-500 text-xs mt-1 uppercase tracking-widest font-medium">Staff Portal</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <LoginForm signIn={signIn} />
        </div>

        <p className="text-center text-stone-700 text-[10px] uppercase tracking-widest mt-6 font-bold">
          Authorised Staff Only
        </p>
      </div>
    </main>
  );
}
