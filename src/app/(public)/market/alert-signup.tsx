"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Mail, MessageSquare, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { formatUkMobile } from "@/lib/sms/phone";
import { confirmEmailAlerts, confirmSmsAlerts, startEmailAlerts, startSmsAlerts } from "./actions";

export type AlertChannel = "sms" | "email";
export type AlertHandle = { address: string; token: string };

type Step = { kind: "address" } | { kind: "code"; address: string };

type ChannelCopy = {
  icon: LucideIcon;
  title: string;
  prompt: string;
  input: InputHTMLAttributes<HTMLInputElement>;
  sendLabel: string;
  sentTo: (address: string) => string;
  wrongAddress: string;
  smallPrint: string;
  onLabel: string;
  success: string;
  start: (address: string, watched: number[]) => Promise<{ ok: true; address: string } | { ok: false; error: string }>;
  confirm: (address: string, code: string, watched: number[]) => Promise<{ ok: true; handle: AlertHandle } | { ok: false; error: string }>;
};

const CHANNELS: Record<AlertChannel, ChannelCopy> = {
  sms: {
    icon: MessageSquare,
    title: "Text alerts",
    prompt: "UK mobile number. We'll text a code to check it's yours.",
    input: { id: "alert-phone", type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "07700 900123" },
    sendLabel: "Text me a code",
    sentTo: (address) => `Enter the code we sent to ${formatUkMobile(address)}.`,
    wrongAddress: "Wrong number?",
    smallPrint: "A few texts a night at most, only on market nights. Every text has a link to turn them off, and so does this page.",
    onLabel: "Turn on texts",
    success: "Texts on - we'll message you when prices drop.",
    start: async (address, watched) => {
      const result = await startSmsAlerts({ phone: address, watchedInstrumentIds: watched });
      return result.ok ? { ok: true, address: result.phone } : result;
    },
    confirm: async (address, code, watched) => {
      const result = await confirmSmsAlerts({ phone: address, code, watchedInstrumentIds: watched });
      return result.ok ? { ok: true, handle: { address: result.handle.phone, token: result.handle.token } } : result;
    },
  },
  email: {
    icon: Mail,
    title: "Email alerts",
    prompt: "Your email address. We'll send a code to check it's yours.",
    input: { id: "alert-email", type: "email", inputMode: "email", autoComplete: "email", placeholder: "you@example.com" },
    sendLabel: "Email me a code",
    sentTo: (address) => `Enter the code we sent to ${address}. Check your spam folder if it's slow.`,
    wrongAddress: "Wrong address?",
    smallPrint: "A few emails a night at most, only on market nights. Every one has an unsubscribe link.",
    onLabel: "Turn on emails",
    success: "Emails on - we'll email you when prices drop.",
    start: async (address, watched) => {
      const result = await startEmailAlerts({ email: address, watchedInstrumentIds: watched });
      return result.ok ? { ok: true, address: result.email } : result;
    },
    confirm: async (address, code, watched) => {
      const result = await confirmEmailAlerts({ email: address, code, watchedInstrumentIds: watched });
      return result.ok ? { ok: true, handle: { address: result.handle.email, token: result.handle.token } } : result;
    },
  },
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-white/15 bg-[#14180a] px-3 text-body text-ink placeholder:text-stone-500 focus:border-[#FDCC4B] focus:outline-none";
const primaryClass =
  "flex min-h-11 w-full items-center justify-center rounded-xl bg-[#FDCC4B] px-4 text-btn font-semibold text-[#1a2008] transition-colors hover:bg-[#f8c828] disabled:opacity-60";
const quietClass =
  "flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-btn font-semibold text-stone-400 transition-colors hover:bg-white/5 hover:text-white";

/* Two short steps - the address, then the code we send to it - so a stranger
   can't sign someone else's phone or inbox up for a night of alerts. */
export function AlertSignup({
  channel,
  watched,
  onDone,
  onCancel,
}: {
  channel: AlertChannel;
  watched: number[];
  onDone: (handle: AlertHandle) => void;
  onCancel: () => void;
}) {
  const copy = CHANNELS[channel];
  const Icon = copy.icon;
  const [step, setStep] = useState<Step>({ kind: "address" });
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitAddress(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await copy.start(address, watched);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep({ kind: "code", address: result.address });
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== "code") return;
    setBusy(true);
    setError(null);
    const result = await copy.confirm(step.address, code, watched);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(copy.success);
    onDone(result.handle);
  }

  const errorLine = error && (
    <p role="alert" className="text-meta text-[#FF6B35]">
      {error}
    </p>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="flex items-center gap-2 font-black text-xs tracking-widest text-ink uppercase">
        <Icon className="h-4 w-4 text-[#FDCC4B]" aria-hidden="true" />
        {copy.title}
      </p>
      {step.kind === "address" ? (
        <form onSubmit={submitAddress} className="mt-3 space-y-3">
          <label htmlFor={copy.input.id} className="block text-meta text-stone-400">
            {copy.prompt}
          </label>
          <input
            {...copy.input}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            required
            className={inputClass}
          />
          {errorLine}
          <button type="submit" disabled={busy} className={primaryClass}>
            {busy ? "Sending code…" : copy.sendLabel}
          </button>
          <button type="button" onClick={onCancel} className={quietClass}>
            Back
          </button>
          <p className="text-xs leading-relaxed text-stone-500">{copy.smallPrint}</p>
        </form>
      ) : (
        <form onSubmit={submitCode} className="mt-3 space-y-3">
          <label htmlFor="alert-code" className="block text-meta text-stone-400">
            {copy.sentTo(step.address)}
          </label>
          <input
            id="alert-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            required
            className={`${inputClass} tabular-nums tracking-wide`}
          />
          {errorLine}
          <button type="submit" disabled={busy} className={primaryClass}>
            {busy ? "Checking…" : copy.onLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep({ kind: "address" });
              setCode("");
              setError(null);
            }}
            className={quietClass}
          >
            {copy.wrongAddress}
          </button>
        </form>
      )}
    </div>
  );
}
