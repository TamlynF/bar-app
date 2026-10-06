"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { payForBooking } from "@/app/(public)/_actions/pay-booking";
import {
  PAYMENT_FALLBACK_MESSAGE,
  buildVerificationDetails,
  formatSquareAmount,
  squareSdkUrl,
  type InPagePayment,
} from "@/lib/square-web-payments";

interface TokenResult {
  status: string;
  token?: string;
  errors?: { message?: string }[];
}

interface PaymentMethod {
  attach(target: HTMLElement | string, options?: Record<string, unknown>): Promise<void>;
  tokenize(details?: unknown): Promise<TokenResult>;
  destroy(): Promise<unknown>;
}

interface SquarePayments {
  paymentRequest(options: unknown): unknown;
  card(options?: unknown): Promise<PaymentMethod>;
  googlePay(request: unknown): Promise<PaymentMethod>;
  applePay(request: unknown): Promise<PaymentMethod>;
}

declare global {
  interface Window {
    Square?: { payments(applicationId: string, locationId: string): SquarePayments };
  }
}

const sdkLoads = new Map<string, Promise<void>>();

function loadSquareSdk(src: string): Promise<void> {
  const existing = sdkLoads.get(src);
  if (existing) return existing;
  const load = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoads.delete(src);
      reject(new Error("Square SDK failed to load"));
    };
    document.head.appendChild(script);
  });
  sdkLoads.set(src, load);
  return load;
}

const CARD_STYLE = {
  input: { backgroundColor: "#141a06", color: "#fff4cc", fontSize: "16px", fontWeight: "600" },
  "input::placeholder": { color: "#8a8870" },
  ".input-container": { borderColor: "#3a4320", borderRadius: "16px" },
  ".input-container.is-focus": { borderColor: "#fdcc4b" },
  ".input-container.is-error": { borderColor: "#f87171" },
  ".message-text": { color: "#b4b294" },
  ".message-icon": { color: "#b4b294" },
  ".message-text.is-error": { color: "#f87171" },
  ".message-icon.is-error": { color: "#f87171" },
};

type Status = "loading" | "ready" | "paying" | "unavailable";

interface Props {
  payment: InPagePayment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SquarePaymentSheet({ payment, open, onOpenChange }: Props) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const googlePayRef = useRef<HTMLDivElement>(null);
  const methods = useRef<{ card?: PaymentMethod; googlePay?: PaymentMethod; applePay?: PaymentMethod }>({});
  const [status, setStatus] = useState<Status>("loading");
  const [hasGooglePay, setHasGooglePay] = useState(false);
  const [hasApplePay, setHasApplePay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = `£${formatSquareAmount(payment.amountPence)}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const mounted: PaymentMethod[] = [];

    async function init() {
      setStatus("loading");
      setError(null);
      try {
        await loadSquareSdk(squareSdkUrl(payment.sandbox));
        if (cancelled || !window.Square) return;
        const payments = window.Square.payments(payment.applicationId, payment.locationId);
        const request = payments.paymentRequest({
          countryCode: "GB",
          currencyCode: "GBP",
          total: { amount: formatSquareAmount(payment.amountPence), label: "Total" },
        });

        try {
          const applePay = await payments.applePay(request);
          if (cancelled) return;
          mounted.push(applePay);
          methods.current.applePay = applePay;
          setHasApplePay(true);
        } catch {
          setHasApplePay(false);
        }

        try {
          const googlePay = await payments.googlePay(request);
          if (cancelled || !googlePayRef.current) return;
          await googlePay.attach(googlePayRef.current, {
            buttonColor: "white",
            buttonSizeMode: "fill",
            buttonType: "long",
          });
          mounted.push(googlePay);
          methods.current.googlePay = googlePay;
          setHasGooglePay(true);
        } catch {
          setHasGooglePay(false);
        }

        const card = await payments.card({ style: CARD_STYLE });
        if (cancelled || !cardRef.current) return;
        await card.attach(cardRef.current);
        mounted.push(card);
        methods.current.card = card;
        setStatus("ready");
      } catch (err) {
        console.error("Square payment form failed to load:", err);
        if (!cancelled) setStatus("unavailable");
      }
    }

    init();
    return () => {
      cancelled = true;
      methods.current = {};
      mounted.forEach((method) => method.destroy().catch(() => {}));
    };
  }, [open, payment]);

  async function pay(method: "card" | "googlePay" | "applePay") {
    const source = methods.current[method];
    if (!source || status === "paying") return;
    setError(null);
    setStatus("paying");
    try {
      const result =
        method === "card"
          ? await source.tokenize(buildVerificationDetails(payment))
          : await source.tokenize();
      if (result.status !== "OK" || !result.token) {
        if (result.status !== "Cancel") {
          setError(result.errors?.[0]?.message ?? "Please check your card details and try again.");
        }
        setStatus("ready");
        return;
      }
      const charged = await payForBooking({ bookingId: payment.bookingId, sourceId: result.token });
      if ("error" in charged) {
        setError(charged.error);
        setStatus("ready");
        return;
      }
      router.push(payment.successPath);
    } catch (err) {
      console.error("Square payment failed:", err);
      setError(PAYMENT_FALLBACK_MESSAGE);
      setStatus("ready");
    }
  }

  const paying = status === "paying";
  const walletVisible = hasApplePay || hasGooglePay;

  return (
    <Sheet open={open} onOpenChange={(next) => !paying && onOpenChange(next)}>
      <SheetContent
        side="bottom"
        showCloseButton={!paying}
        className="max-h-[92dvh] overflow-y-auto rounded-t-3xl border-white/10 bg-canvas-2 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink sm:inset-x-0 sm:bottom-6 sm:mx-auto sm:max-w-md sm:rounded-3xl sm:border [&>button]:text-ink-2"
      >
        <div className="space-y-1 pr-8">
          <p className="text-eyebrow font-semibold text-gold">Secure payment</p>
          <SheetTitle className="text-h3 font-black text-ink uppercase">{amount}</SheetTitle>
          <SheetDescription className="text-meta text-ink-2">{payment.label}</SheetDescription>
        </div>

        {status === "unavailable" ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <p className="text-body font-semibold text-red-400">
              Payments couldn&apos;t load. Please check your connection and try again.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cn("space-y-3", !walletVisible && "hidden")}>
              {hasApplePay && (
                <button
                  type="button"
                  onClick={() => pay("applePay")}
                  disabled={paying}
                  aria-label="Pay with Apple Pay"
                  className="block h-12 w-full rounded-xl [-apple-pay-button-style:white] [-apple-pay-button-type:plain] [-webkit-appearance:-apple-pay-button] disabled:opacity-50"
                />
              )}
              <div
                ref={googlePayRef}
                onClick={() => pay("googlePay")}
                className={cn("h-12 w-full overflow-hidden rounded-xl", !hasGooglePay && "hidden", paying && "pointer-events-none opacity-50")}
              />
              <div className="flex items-center gap-3 text-meta text-ink-2">
                <span className="h-px flex-1 bg-white/10" />
                or pay by card
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </div>

            <div className="relative min-h-22">
              {status === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                  <Loader2 className="h-5 w-5 animate-spin text-ink-2" />
                  <span className="sr-only">Loading payment form</span>
                </div>
              )}
              <div ref={cardRef} />
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <p className="text-body font-semibold text-red-400">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => pay("card")}
              disabled={status !== "ready"}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold text-btn font-semibold text-on-gold shadow-[0_3px_0_#a8801c] transition-[translate,box-shadow,background-color,opacity] duration-150 hover:-translate-y-0.5 hover:bg-[#ffd76a] active:translate-y-0.75 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-14"
            >
              {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${amount}`}
            </button>
          </div>
        )}

        <p className="flex items-center justify-center gap-1.5 text-meta text-ink-2">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Secured by Square. Your card details never touch our servers.
        </p>
      </SheetContent>
    </Sheet>
  );
}
