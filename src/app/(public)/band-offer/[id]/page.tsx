import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Mail, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicNav } from "@/components/public-nav";
import { PageHeader } from "@/components/editorial/page-header";
import { getContactEmail } from "@/lib/company-info";
import { EMAIL_REPLY_DOMAIN } from "@/lib/email";
import { correspondenceReplyAddress } from "@/lib/email/correspondence";
import { formatHireDate, formatHireTime } from "@/lib/private-hire-details";
import {
  BAND_REQUEST_ROW_SELECT,
  actCanRespond,
  actCanWithdraw,
  actName,
  type ActResponse,
  type BandRequestRow,
} from "@/lib/band-flow";
import { cn } from "@/lib/utils";
import OfferActions from "./_components/offer-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your Offer",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#26300D",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type View = "waiting" | "offered" | "accepted" | "booked" | "withdrawn" | "declined";

function viewFor(row: BandRequestRow): View {
  if (row.status === "booked") return "booked";
  if (row.status === "declined") return row.act_withdrawn_at ? "withdrawn" : "declined";
  if (row.status === "offered") return row.act_accepted_at ? "accepted" : "offered";
  return "waiting";
}

const VIEW_ICON: Record<View, React.ElementType<{ className?: string }>> = {
  waiting: Clock,
  offered: Mail,
  accepted: CheckCircle2,
  booked: CheckCircle2,
  withdrawn: XCircle,
  declined: XCircle,
};

const VIEW_TITLE: Record<View, string> = {
  waiting: "We're reviewing your application",
  offered: "We'd love to book you",
  accepted: "Thanks - you've accepted",
  booked: "You're booked in",
  withdrawn: "Application withdrawn",
  declined: "Not this time",
};

function viewMessage(view: View, name: string): string {
  switch (view) {
    case "waiting":
      return "Our team is looking at your application and will be in touch with an offer soon.";
    case "offered":
      return `Here's the slot we're offering ${name}. Accept it, tell us what you'd like to change, or let us know if you can't make it.`;
    case "accepted":
      return "We've got your yes. The team is finalising the slot and will confirm it shortly.";
    case "booked":
      return "The slot is confirmed and on our events calendar. We'll be in touch closer to the date with the details.";
    case "withdrawn":
      return "You've withdrawn this application. If that was a mistake, just reply to any of our emails.";
    case "declined":
      return "We couldn't go ahead with this one. Reply to any of our emails if you'd like to try another date.";
  }
}

const RESPONSES: ActResponse[] = ["accept", "discuss", "withdraw"];

export default async function BandOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ respond?: string }>;
}) {
  const [{ id }, { respond }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const { data } = await createAdminClient()
    .from("band_booking_requests")
    .select(BAND_REQUEST_ROW_SELECT)
    .eq("id", id)
    .maybeSingle();
  const row = data as BandRequestRow | null;
  if (!row) notFound();

  const view = viewFor(row);
  const name = actName(row);
  const Icon = VIEW_ICON[view];
  const isClosed = view === "withdrawn" || view === "declined";
  const hasSlot = !!row.selected_date;
  const rows = [
    { label: "Act", value: name },
    { label: "Date", value: hasSlot ? formatHireDate(row.selected_date) : "To be arranged" },
    ...(hasSlot ? [{ label: "Time", value: formatHireTime(row.selected_start_time, row.selected_end_time) }] : []),
    ...(row.payment_amount != null ? [{ label: "Fee", value: `£${row.payment_amount}` }] : []),
  ];
  const preselected = RESPONSES.includes(respond as ActResponse) ? (respond as ActResponse) : null;
  const writeTo =
    correspondenceReplyAddress({ kind: "band", id: row.id }, EMAIL_REPLY_DOMAIN) ?? (await getContactEmail());

  return (
    <main className="min-h-dvh w-full bg-canvas px-4 pb-12 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <PublicNav currentPath="/book" />

      <div className="mx-auto max-w-xl py-8 sm:py-12">
        <PageHeader
          eyebrow="Play at Don Fenticas"
          title="Your Offer"
          subtitle={`Hi ${row.booker_name.split(" ")[0]} - here's where things are.`}
        />

        <section
          aria-labelledby="offer-status"
          className={cn("overflow-hidden rounded-2xl border bg-white/8", isClosed ? "border-white/15" : "border-gold")}
        >
          <div className="flex items-start gap-3 border-b border-hairline p-4 sm:p-5">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                view === "booked" ? "bg-gold text-on-gold" : isClosed ? "bg-white/10 text-ink-2" : "bg-gold/15 text-gold"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="offer-status" className="font-black text-h3 tracking-tight text-ink uppercase">
                {VIEW_TITLE[view]}
              </h2>
              <p className="mt-1.5 text-body text-ink-2">{viewMessage(view, name)}</p>
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
        </section>

        <OfferActions
          id={row.id}
          canRespond={actCanRespond(row)}
          canWithdraw={actCanWithdraw(row)}
          slotLabel={hasSlot ? `${formatHireDate(row.selected_date)}, ${formatHireTime(row.selected_start_time, row.selected_end_time)}` : "the slot"}
          preselected={preselected}
        />

        <p className="mt-8 text-center text-meta text-ink-2">
          Questions? Write to{" "}
          <a
            href={`mailto:${writeTo}`}
            className="mt-1 block font-semibold break-words text-gold underline-offset-2 hover:underline sm:mt-0 sm:inline"
          >
            {writeTo}
          </a>
        </p>
      </div>
    </main>
  );
}
