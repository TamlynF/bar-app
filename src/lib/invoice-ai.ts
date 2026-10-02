import { parseJsonLoose } from "@/lib/gemini";
import type { InvoiceFields } from "@/lib/invoice-pdf";

/* Reading an invoice that isn't our fillable template - an act's own PDF, a
   scan or a phone photo - with the "invoice_reading" AI area. The model only
   transcribes; the result goes through the same checks as a form-field read,
   and the booking note says it was read by AI so staff check it before paying. */

export const INVOICE_AI_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
export const INVOICE_AI_MAX_BYTES = 10 * 1024 * 1024;

export const INVOICE_AI_PROMPT = `You are reading a file a live music act emailed to a UK pub after playing a gig.
Decide whether it is an invoice (or a bill / payment request) from the act. If it is, transcribe the details exactly as written - do not guess or invent anything.

Return JSON with:
- is_invoice: true only if the file is an invoice or payment request.
- from_name: who the invoice is from (the act or person), or "".
- invoice_no: the invoice number or reference, or "".
- total: the total amount due as written, or "".
- account_name: the bank account holder's name, or "".
- sort_code: the UK bank sort code, or "".
- account_no: the UK bank account number, or "".

Leave a field as "" when it is not on the invoice. Never copy the pub's own details into the bank fields.`;

export const INVOICE_AI_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_invoice: { type: "BOOLEAN" },
    from_name: { type: "STRING" },
    invoice_no: { type: "STRING" },
    total: { type: "STRING" },
    account_name: { type: "STRING" },
    sort_code: { type: "STRING" },
    account_no: { type: "STRING" },
  },
  required: ["is_invoice", "account_name", "sort_code", "account_no"],
};

const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/* The type the model is told the file is, or null when it can't read it. */
export function invoiceAiMimeType(file: { name: string; contentType: string | null; bytes: Uint8Array }): string | null {
  if (file.bytes.byteLength > INVOICE_AI_MAX_BYTES) return null;
  const declared = file.contentType?.toLowerCase().split(";")[0].trim() ?? "";
  if (INVOICE_AI_TYPES.has(declared)) return declared;
  if (declared === "image/jpg") return "image/jpeg";
  return BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function parseInvoiceAiText(raw: string): InvoiceFields | null {
  const parsed = parseJsonLoose<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== "object" || parsed.is_invoice !== true) return null;
  const fields: InvoiceFields = {
    fromName: text(parsed.from_name),
    invoiceNo: text(parsed.invoice_no),
    total: text(parsed.total),
    accountName: text(parsed.account_name),
    sortCode: text(parsed.sort_code),
    accountNo: text(parsed.account_no),
  };
  return fields.accountNo || fields.sortCode ? fields : null;
}
