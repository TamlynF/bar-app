"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PrivateHireStatus } from "@/lib/private-hire-status";
import { respondToHireAction, startDepositPaymentAction } from "../actions";
import { cn } from "@/lib/utils";

type Panel = null | "reject" | "cancel";

/* After Square sends the customer back, the webhook usually confirms the
   payment within seconds - the page re-reads itself until it has, then stops
   once it's been waiting long enough that something else is wrong. */
const PAYMENT_CHECK_MS = 4000;
const PAYMENT_CHECK_LIMIT = 45;

const textareaClass =
  "w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-body text-ink placeholder:text-ink-2/60 focus:border-gold focus:outline-none";

export default function RequestActions({
  id,
  status,
  depositLabel,
  canCancel,
  awaitingPayment,
}: {
  id: string;
  status: PrivateHireStatus;
  depositLabel: string;
  canCancel: boolean;
  awaitingPayment: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const working = isPending || busy !== null;

  const [paymentCheckStopped, setPaymentCheckStopped] = useState(false);
  useEffect(() => {
    if (!awaitingPayment) return;
    let checks = 0;
    const timer = window.setInterval(() => {
      checks += 1;
      if (checks > PAYMENT_CHECK_LIMIT) {
        window.clearInterval(timer);
        setPaymentCheckStopped(true);
        return;
      }
      router.refresh();
    }, PAYMENT_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [awaitingPayment, router]);

  function respond(response: "accept" | "reject" | "cancel") {
    setError(null);
    setBusy(response);
    startTransition(async () => {
      const result = await respondToHireAction(id, response, message);
      if (!result.ok) {
        setError(result.error);
        setBusy(null);
        return;
      }
      setPanel(null);
      setMessage("");
      setBusy(null);
      router.refresh();
    });
  }

  function pay() {
    setError(null);
    setBusy("pay");
    startTransition(async () => {
      const result = await startDepositPaymentAction(id);
      if ("url" in result) {
        window.location.assign(result.url);
        return;
      }
      setError(result.error);
      setBusy(null);
    });
  }

  const spinner = (key: string) => (busy === key ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null);

  if (!canCancel && status !== "awaiting_customer" && status !== "awaiting_deposit") return null;

  return (
    <div className="mt-5 flex flex-col gap-3">
      {status === "awaiting_customer" && panel !== "reject" && (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            type="button"
            variant="gold"
            size="cta"
            disabled={working}
            onClick={() => respond("accept")}
            className="ad-cta group sm:flex-1"
          >
            {spinner("accept")}
            <span>Accept this time</span>
            {busy !== "accept" && <ArrowRight className="ad-cta-arrow" aria-hidden="true" />}
          </Button>
          <Button
            type="button"
            variant="goldOutline"
            size="cta"
            disabled={working}
            onClick={() => setPanel("reject")}
            className="sm:flex-1"
          >
            This doesn&apos;t work for me
          </Button>
        </div>
      )}

      {status === "awaiting_customer" && panel === "reject" && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <label htmlFor="hire-reject-message" className="text-btn font-semibold text-ink">
            What would work better?
          </label>
          <p className="mt-1 text-meta text-ink-2">Tell us another date or time and we&apos;ll take another look.</p>
          <textarea
            id="hire-reject-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Any Saturday in November, from 7pm"
            className={cn(textareaClass, "mt-3")}
          />
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <Button type="button" variant="gold" size="cta" disabled={working} onClick={() => respond("reject")} className="sm:flex-1">
              {spinner("reject")}
              Send to the team
            </Button>
            <Button type="button" variant="goldOutline" size="cta" disabled={working} onClick={() => setPanel(null)} className="sm:flex-1">
              Back
            </Button>
          </div>
        </div>
      )}

      {awaitingPayment && (
        <p role="status" className="flex items-center justify-center gap-2 text-meta text-ink-2">
          {paymentCheckStopped ? (
            "This is taking longer than usual. Refresh the page in a few minutes, or reply to your email if it doesn't update."
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Checking for your payment…
            </>
          )}
        </p>
      )}

      {status === "awaiting_deposit" && !awaitingPayment && (
        <Button type="button" variant="gold" size="cta" disabled={working} onClick={pay} className="ad-cta group w-full">
          {spinner("pay")}
          <span>Pay {depositLabel} deposit</span>
          {busy !== "pay" && <ArrowRight className="ad-cta-arrow" aria-hidden="true" />}
        </Button>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-meta font-semibold text-red-300">
          {error}
        </p>
      )}

      {canCancel && panel !== "cancel" && panel !== "reject" && (
        <Button
          type="button"
          size="cta"
          disabled={working}
          onClick={() => setPanel("cancel")}
          className="w-full border border-red-400/40 bg-red-500/5 text-btn font-semibold text-red-300 hover:border-red-400/70 hover:bg-red-500/15 hover:text-red-200"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Cancel my request
        </Button>
      )}

      {panel === "cancel" && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-btn font-semibold text-ink">Cancel this request?</p>
          <p className="mt-1 text-meta text-ink-2">We&apos;ll release the date and let the team know.</p>
          <label htmlFor="hire-cancel-message" className="sr-only">
            Message to the team (optional)
          </label>
          <textarea
            id="hire-cancel-message"
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
              onClick={() => respond("cancel")}
              className="bg-red-600 sm:flex-1 text-btn font-semibold text-white hover:bg-red-700"
            >
              {spinner("cancel")}
              Yes, cancel it
            </Button>
            <Button type="button" variant="goldOutline" size="cta" disabled={working} onClick={() => setPanel(null)} className="sm:flex-1">
              Keep my request
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
