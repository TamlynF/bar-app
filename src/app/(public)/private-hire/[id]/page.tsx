import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Mail, PoundSterling, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicNav } from "@/components/public-nav";
import { PageHeader } from "@/components/editorial/page-header";
import { getContactEmail } from "@/lib/company-info";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";
import { venueToday } from "@/lib/private-hire-flow";
import {
  PRIVATE_HIRE_CUSTOMER_LABEL,
  customerCanCancel,
  effectivePrivateHireStatus,
  normalizePrivateHireStatus,
  type PrivateHireStatus,
} from "@/lib/private-hire-status";
import { formatDeposit, formatHireDate, formatHireTime, hireDetailRows } from "@/lib/private-hire-details";
import { cn } from "@/lib/utils";
import RequestActions from "./_components/request-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your Private Hire",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#26300D",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SubtypeJoin = { name: string; default_event_title: string | null };

const STATUS_ICON: Record<PrivateHireStatus, React.ElementType<{ className?: string }>> = {
  new: Clock,
  awaiting_customer: Mail,
  awaiting_deposit: PoundSterling,
  confirmed: CheckCircle2,
  declined: XCircle,
  cancelled: XCircle,
  expired: Clock,
};

function statusMessage(status: PrivateHireStatus, p: { deposit: string; due: string; paidNow: boolean }): string {
  switch (status) {
    case "new":
      return "Thanks for your request. Our team is checking availability and will be in touch soon.";
    case "awaiting_customer":
      return "We can't do the exact time you asked for, but we can offer the slot below. Let us know if it works for you.";
    case "awaiting_deposit":
      return p.paidNow
        ? "Thanks - we're confirming your payment now. This page will update within a minute or two."
        : `Good news - we can host you. Pay your ${p.deposit} deposit by ${p.due} to secure the date. We're holding it for you until then.`;
    case "confirmed":
      return "You're booked in. We can't wait to host you!";
    case "declined":
      return "Unfortunately we can't host this one. Reply to any of our emails if you'd like to try another date.";
    case "cancelled":
      return "This request has been cancelled.";
    case "expired":
      return "The deposit wasn't paid in time, so the date has been released. Reply to any of our emails and we'll see what we can do.";
  }
}

export default async function PrivateHireRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const [{ id }, { paid }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const { data: row } = await createAdminClient()
    .from("private_hire_requests")
    .select(
      "id, full_name, status, guest_count, preferred_date, preferred_start_time, preferred_end_time, selected_date, selected_start_time, selected_end_time, deposit_amount, paid_amount, deposit_due_date, deposit_paid_via, event_subtypes:event_subtypes_id ( name, default_event_title )"
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const status = effectivePrivateHireStatus(
    normalizePrivateHireStatus(row.status),
    row.deposit_due_date,
    venueToday()
  );
  const reason = privateHireSubtypeLabel(
    unwrapSubtype(row.event_subtypes as SubtypeJoin | SubtypeJoin[] | null),
    "Private hire"
  );
  const hasSlot = !!row.selected_date;
  const showDeposit = status === "awaiting_deposit" || status === "expired";
  const rows = hireDetailRows({
    date: hasSlot ? row.selected_date : row.preferred_date,
    start: hasSlot ? row.selected_start_time : row.preferred_start_time,
    end: hasSlot ? row.selected_end_time : row.preferred_end_time,
    guests: row.guest_count,
    reason,
    deposit: showDeposit ? row.deposit_amount : null,
    depositDue: showDeposit ? row.deposit_due_date : null,
  });
  if (status === "confirmed" && Number(row.paid_amount) > 0) {
    rows.push({ label: "Deposit paid", value: formatDeposit(row.paid_amount) });
  }
  const askedFor =
    status === "awaiting_customer" && row.preferred_date
      ? `${formatHireDate(row.preferred_date)}, ${formatHireTime(row.preferred_start_time, row.preferred_end_time)}`
      : null;

  const deposit = formatDeposit(row.deposit_amount);
  const due = formatHireDate(row.deposit_due_date);
  const Icon = STATUS_ICON[status];
  const isClosed = status === "declined" || status === "cancelled" || status === "expired";
  const contactEmail = await getContactEmail();

  return (
    <main className="min-h-dvh w-full bg-canvas px-4 pb-12 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <PublicNav currentPath="/book" />

      <div className="mx-auto max-w-xl py-8 sm:py-12">
        <PageHeader eyebrow="Private hire" title="Your Request" subtitle={`Hi ${row.full_name.split(" ")[0]} - here's where things are.`} />

        <section
          aria-labelledby="hire-status"
          className={cn(
            "overflow-hidden rounded-2xl border bg-white/8",
            isClosed ? "border-white/15" : "border-gold"
          )}
        >
          <div className="flex items-start gap-3 border-b border-hairline p-4 sm:p-5">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                status === "confirmed" ? "bg-gold text-on-gold" : isClosed ? "bg-white/10 text-ink-2" : "bg-gold/15 text-gold"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="hire-status" className="font-black text-h3 tracking-tight text-ink uppercase">
                {status === "awaiting_deposit" && paid ? "Payment received" : PRIVATE_HIRE_CUSTOMER_LABEL[status]}
              </h2>
              <p className="mt-1.5 text-body text-ink-2">
                {statusMessage(status, { deposit, due, paidNow: !!paid })}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-hairline">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
                <dt className="text-meta text-ink-2">{r.label}</dt>
                <dd className="text-right text-body font-semibold text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>

          {askedFor && (
            <p className="border-t border-hairline px-4 py-3 text-meta text-ink-2 sm:px-5">
              You originally asked for {askedFor}.
            </p>
          )}
        </section>

        <RequestActions
          id={row.id}
          status={status}
          depositLabel={deposit}
          canCancel={customerCanCancel(status)}
          awaitingPayment={status === "awaiting_deposit" && !!paid}
        />

        <p className="mt-8 text-center text-meta text-ink-2">
          Questions? Reply to any of our emails or write to{" "}
          <a href={`mailto:${contactEmail}`} className="font-semibold text-gold underline-offset-2 hover:underline">
            {contactEmail}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
