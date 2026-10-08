"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActResponse } from "@/lib/band-flow";
import { respondToOfferAction } from "../actions";
import { cn } from "@/lib/utils";

type Panel = null | "accept" | "discuss" | "withdraw";

const textareaClass =
  "w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-body text-ink placeholder:text-ink-2/60 focus:border-gold focus:outline-none";

export default function OfferActions({
  id,
  canRespond,
  canWithdraw,
  slotLabel,
  preselected,
}: {
  id: string;
  canRespond: boolean;
  canWithdraw: boolean;
  slotLabel: string;
  preselected: ActResponse | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<ActResponse | null>(null);
  const [panel, setPanel] = useState<Panel>(() => {
    if (preselected === "withdraw") return canWithdraw ? "withdraw" : null;
    return canRespond ? preselected : null;
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const working = isPending || busy !== null;

  function respond(response: ActResponse) {
    setError(null);
    setBusy(response);
    startTransition(async () => {
      const result = await respondToOfferAction(id, response, message);
      if (!result.ok) {
        setError(result.error);
        setBusy(null);
        return;
      }
      setPanel(null);
      setMessage("");
      setBusy(null);
      router.replace(window.location.pathname);
      router.refresh();
    });
  }

  const spinner = (key: ActResponse) =>
    busy === key ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null;

  if (!canRespond && !canWithdraw) return null;

  return (
    <div className="mt-5 flex flex-col gap-3">
      {canRespond && panel === null && (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            type="button"
            variant="gold"
            size="cta"
            disabled={working}
            onClick={() => setPanel("accept")}
            className="ad-cta group sm:flex-1"
          >
            <span>Yes, I accept this slot</span>
            <ArrowRight className="ad-cta-arrow" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="goldOutline"
            size="cta"
            disabled={working}
            onClick={() => setPanel("discuss")}
            className="sm:flex-1"
          >
            I&apos;d like to discuss it
          </Button>
        </div>
      )}

      {canRespond && panel === "accept" && (
        <div className="rounded-2xl border border-gold/60 bg-gold/10 p-4">
          <p className="text-btn font-semibold text-ink">Accept {slotLabel}?</p>
          <p className="mt-1 text-meta text-ink-2">
            We&apos;ll lock it in, put it on our events calendar and email you the confirmation.
          </p>
          <label htmlFor="offer-accept-message" className="sr-only">
            Message to the team (optional)
          </label>
          <textarea
            id="offer-accept-message"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Anything we should know (optional)"
            className={cn(textareaClass, "mt-3")}
          />
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <Button type="button" variant="gold" size="cta" disabled={working} onClick={() => respond("accept")} className="sm:flex-1">
              {spinner("accept")}
              Confirm - I&apos;ll be there
            </Button>
            <Button type="button" variant="goldOutline" size="cta" disabled={working} onClick={() => setPanel(null)} className="sm:flex-1">
              Back
            </Button>
          </div>
        </div>
      )}

      {canRespond && panel === "discuss" && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <label htmlFor="offer-discuss-message" className="text-btn font-semibold text-ink">
            What would you like to change?
          </label>
          <p className="mt-1 text-meta text-ink-2">Another date, the times, the fee - tell us and the team will come back to you.</p>
          <textarea
            id="offer-discuss-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Could we start at 9pm instead?"
            className={cn(textareaClass, "mt-3")}
          />
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="button"
              variant="gold"
              size="cta"
              disabled={working || !message.trim()}
              onClick={() => respond("discuss")}
              className="sm:flex-1"
            >
              {spinner("discuss")}
              Send to the team
            </Button>
            <Button type="button" variant="goldOutline" size="cta" disabled={working} onClick={() => setPanel(null)} className="sm:flex-1">
              Back
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-meta font-semibold text-red-300">
          {error}
        </p>
      )}

      {canWithdraw && panel === null && (
        <Button
          type="button"
          size="cta"
          disabled={working}
          onClick={() => setPanel("withdraw")}
          className="w-full border border-red-400/40 bg-red-500/5 text-btn font-semibold text-red-300 hover:border-red-400/70 hover:bg-red-500/15 hover:text-red-200"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Withdraw my application
        </Button>
      )}

      {canWithdraw && panel === "withdraw" && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-btn font-semibold text-ink">Withdraw this application?</p>
          <p className="mt-1 text-meta text-ink-2">We&apos;ll release the slot and let the team know.</p>
          <label htmlFor="offer-withdraw-message" className="sr-only">
            Message to the team (optional)
          </label>
          <textarea
            id="offer-withdraw-message"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Anything you'd like to tell us (optional)"
            className={cn(textareaClass, "mt-3")}
          />
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="button"
              size="cta"
              disabled={working}
              onClick={() => respond("withdraw")}
              className="bg-red-600 text-btn font-semibold text-white hover:bg-red-700 sm:flex-1"
            >
              {spinner("withdraw")}
              Yes, withdraw it
            </Button>
            <Button type="button" variant="goldOutline" size="cta" disabled={working} onClick={() => setPanel(null)} className="sm:flex-1">
              Keep my application
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
