"use client";

import { BellRing, Mail, MessageSquare, type LucideIcon } from "lucide-react";

type Method = {
  key: "push" | "sms" | "email";
  label: string;
  detail: string;
  icon: LucideIcon;
  soon?: boolean;
};

const METHODS: Method[] = [
  { key: "push", label: "Push notifications", detail: "On your lock screen", icon: BellRing },
  { key: "sms", label: "SMS", detail: "Coming soon", icon: MessageSquare, soon: true },
  { key: "email", label: "Email", detail: "Coming soon", icon: Mail, soon: true },
];

/* Shown once the guest has tapped "Notify me": how do they want to hear about
   drops? Push is the one that works today; SMS and email are on the way and
   sit here greyed out so the choice reads as a set. */
export function NotifyMethod({ onPush }: { onPush: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="font-black text-xs tracking-widest text-ink uppercase">Notification method</p>
      <p className="mt-1 text-[12px] leading-relaxed text-stone-400">How do you want to hear about price drops?</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {METHODS.map(({ key, label, detail, icon: Icon, soon }) => (
          <button
            key={key}
            type="button"
            disabled={soon}
            aria-disabled={soon}
            onClick={key === "push" ? onPush : undefined}
            className="flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-[#FDCC4B]/40 bg-[#FDCC4B]/10 px-2 py-3 text-center text-[#FDCC4B] transition-colors hover:bg-[#FDCC4B]/20 disabled:border-white/10 disabled:bg-transparent disabled:text-stone-500 disabled:hover:bg-transparent"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="font-black text-[10px] leading-tight tracking-widest uppercase">{label}</span>
            <span className="text-[10px] leading-tight text-stone-400">{detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
