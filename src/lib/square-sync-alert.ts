import { Resend } from "resend";
import { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
import { escapeHtml } from "@/lib/email/escape";
import { siteUrl } from "@/lib/site-url";

export type SyncFailureAlert = {
  phase: "backfill" | "incremental";
  trigger: string;
  error: string;
  consecutiveFailures: number;
  attempts: number;
  windowsDone: number;
  windowsTotal: number;
  runId: number | null;
  failedAt: Date;
};

export function syncFailureSubject(alert: SyncFailureAlert): string {
  const streak = alert.consecutiveFailures > 1 ? ` (${alert.consecutiveFailures} in a row)` : "";
  return `Square sales sync failed${streak}`;
}

export function syncFailureText(alert: SyncFailureAlert): string {
  const progress =
    alert.windowsTotal > 0 ? `${alert.windowsDone} of ${alert.windowsTotal} batches finished before it stopped.` : "";
  return [
    `The ${alert.phase === "backfill" ? "first full pull of Square sales history" : "nightly Square sales top-up"} failed at ${alert.failedAt.toISOString()} (${alert.trigger} run${alert.runId ? ` #${alert.runId}` : ""}).`,
    `Error after ${alert.attempts} attempt${alert.attempts === 1 ? "" : "s"}: ${alert.error}`,
    progress,
    "Progress is saved after every batch, so the next run carries on from where this one stopped. Nothing in Square was changed.",
    `Check the sync on ${siteUrl()}/settings/market/square-links and use "Sync now" to retry straight away.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/* A plain text-and-paragraphs email rather than a staff-editable template:
   it is an operational alert, and the wording should not drift. */
export async function sendSquareSyncFailureAlert(alert: SyncFailureAlert): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[square-sync] RESEND_API_KEY not set - failure alert not sent");
    return false;
  }
  const text = syncFailureText(alert);
  const html = text
    .split("\n\n")
    .map((paragraph) => `<p style="margin:0 0 12px;font:14px/1.5 Arial,sans-serif">${escapeHtml(paragraph)}</p>`)
    .join("");
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: syncFailureSubject(alert),
      text,
      html,
    });
    if (error) {
      console.error("[square-sync] failure alert not sent:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[square-sync] failure alert not sent:", err);
    return false;
  }
}
