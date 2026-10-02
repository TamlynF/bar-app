import type { SupabaseClient } from "@supabase/supabase-js";
import { readInvoiceForm } from "@/lib/invoice-pdf";
import { INVOICE_EMAIL_KIND, invoiceAccount, isPdfAttachment, mentionsInvoice } from "@/lib/band-invoice";
import { planActBankUpdate, toMainColumns, type BankAccount } from "@/lib/bank-accounts";
import { aiReadFile } from "@/lib/ai/client";
import { INVOICE_AI_PROMPT, INVOICE_AI_SCHEMA, invoiceAiMimeType, parseInvoiceAiText } from "@/lib/invoice-ai";

export type ReceivedFile = { name: string; contentType: string | null; bytes: Uint8Array };

type FoundAccount = { account: BankAccount; byAi: boolean };

/* Our own template's form fields first - exact and free. Only when no file has
   them is each readable file handed to the model, which covers an act's own
   invoice, a scan or a photo. */
async function firstInvoiceAccount(
  files: ReceivedFile[],
  receivedAt: string,
  allowAi: () => Promise<boolean>
): Promise<FoundAccount | null> {
  for (const file of files) {
    if (!isPdfAttachment(file)) continue;
    const fields = readInvoiceForm(file.bytes);
    const account = fields ? invoiceAccount(fields, receivedAt) : null;
    if (account) return { account, byAi: false };
  }
  if (!files.some((f) => invoiceAiMimeType(f)) || !(await allowAi())) return null;
  for (const file of files) {
    const mimeType = invoiceAiMimeType(file);
    if (!mimeType) continue;
    const result = await aiReadFile("invoice_reading", {
      file: { base64: Buffer.from(file.bytes).toString("base64"), mimeType },
      prompt: INVOICE_AI_PROMPT,
      responseSchema: INVOICE_AI_SCHEMA,
      temperature: 0,
    });
    if ("error" in result) {
      console.error(`[invoice reply] AI could not read ${file.name}:`, result.error);
      continue;
    }
    const fields = parseInvoiceAiText(result.text);
    const account = fields ? invoiceAccount(fields, receivedAt) : null;
    if (account) return { account, byAi: true };
  }
  return null;
}

function describe(a: BankAccount): string {
  const ending = a.account_no.slice(-4);
  return [a.account_name, `sort code ${a.sort_code}`, `account ending ${ending}`].filter(Boolean).join(", ");
}

/* A reply carrying an invoice - our template filled in, or the act's own - puts its bank details on
   the booking and on the act: the act's main account when it has none,
   otherwise an extra account unless it already has that one. A note on the
   booking says what was copied, so staff can check it before paying. */
export async function applyInvoiceReply(
  admin: SupabaseClient,
  links: { bandRequestId: string | null; musicActId: string | null },
  files: ReceivedFile[],
  receivedAt: string,
  subject: string
): Promise<void> {
  if (!links.bandRequestId && !links.musicActId) return;
  /* The model only looks at replies that are plausibly an invoice - after our
     request went out, or saying so - not at every poster or rider an act sends. */
  const allowAi = async () => {
    if (mentionsInvoice(subject, files.map((f) => f.name))) return true;
    if (!links.bandRequestId) return false;
    const { count } = await admin
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("band_booking_request_id", links.bandRequestId)
      .eq("direction", "outbound")
      .eq("kind", INVOICE_EMAIL_KIND);
    return (count ?? 0) > 0;
  };
  const found = await firstInvoiceAccount(files, receivedAt, allowAi);
  if (!found) return;
  const { account, byAi } = found;

  const outcome: string[] = [];
  let actId = links.musicActId;

  if (links.bandRequestId) {
    const columns = toMainColumns(account);
    const { bank_payment_ref, ...rest } = columns;
    const { data: request, error } = await admin
      .from("band_booking_requests")
      .update({ ...rest, ...(bank_payment_ref ? { bank_payment_ref } : {}), updated_at: new Date().toISOString() })
      .eq("id", links.bandRequestId)
      .select("music_acts_id")
      .maybeSingle();
    if (error) console.error("[invoice reply] booking bank update failed:", error.code, error.message);
    else outcome.push("saved to this booking");
    actId = actId ?? ((request?.music_acts_id as string | null) ?? null);
  }

  if (actId) {
    const { data: act, error: readError } = await admin
      .from("music_acts")
      .select("bank_account_name, bank_account_no, bank_sort_code, bank_payment_ref, extra_bank_accounts")
      .eq("id", actId)
      .maybeSingle();
    if (readError) console.error("[invoice reply] act read failed:", readError.code, readError.message);
    if (act) {
      const plan = planActBankUpdate(act, account);
      const patch =
        plan.action === "set_main"
          ? plan.columns
          : plan.action === "add_extra"
            ? { extra_bank_accounts: plan.extra }
            : null;
      if (patch) {
        const { error } = await admin
          .from("music_acts")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", actId);
        if (error) console.error("[invoice reply] act bank update failed:", error.code, error.message);
        else outcome.push(plan.action === "set_main" ? "set as the act's bank account" : "added to the act as another account");
      } else {
        outcome.push("the act already has this account");
      }
    }
  }

  if (links.bandRequestId) {
    const { error } = await admin.from("band_booking_notes").insert({
      request_id: links.bandRequestId,
      body: `Bank details read${byAi ? " by AI" : ""} from ${account.source ?? "invoice"} (${describe(account)}) - ${outcome.join("; ")}. Check them against the invoice before paying.`,
    });
    if (error) console.error("[invoice reply] note failed:", error.code, error.message);
  }
}
