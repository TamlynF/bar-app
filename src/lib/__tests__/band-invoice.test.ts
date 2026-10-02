import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readInvoiceForm } from "@/lib/invoice-pdf";
import { invoiceAccount, isDueForInvoice, mentionsInvoice, venueHourAndDay, venueStamp } from "@/lib/band-invoice";
import { invoiceAiMimeType, parseInvoiceAiText } from "@/lib/invoice-ai";
import { formatSortCode, planActBankUpdate, sanitizeBankAccounts } from "@/lib/bank-accounts";

const template = readFileSync(join(__dirname, "fixtures", "invoice-template.pdf"));

function filled(values: Record<string, string>): Buffer {
  let s = template.toString("latin1");
  for (const [field, value] of Object.entries(values)) {
    const name = `/T (${field.replace(/_/g, "\\137")})`;
    const at = s.indexOf(name);
    if (at < 0) throw new Error(`no field ${field}`);
    const v = s.indexOf("/V ()", at);
    const token = value.startsWith("<") ? value : `(${value})`;
    s = s.slice(0, v) + `/V ${token}` + s.slice(v + 5);
  }
  return Buffer.from(s, "latin1");
}

describe("readInvoiceForm", () => {
  it("reads nothing from the blank template", () => {
    expect(readInvoiceForm(template)).toBeNull();
  });

  it("reads the bank fields of a completed template", () => {
    const fields = readInvoiceForm(
      filled({ pay_name: "The Wandering Hearts", pay_sort: "12-34-56", pay_acc: "12345678", invoice_no: "INV-7", total: "150.00" })
    );
    expect(fields).toMatchObject({
      accountName: "The Wandering Hearts",
      sortCode: "12-34-56",
      accountNo: "12345678",
      invoiceNo: "INV-7",
      total: "150.00",
    });
  });

  it("decodes escaped and UTF-16 values", () => {
    const fields = readInvoiceForm(filled({ pay_name: "Sam \\(Bass\\) Rivers", pay_acc: "<FEFF00310032003300340035003600370038>" }));
    expect(fields?.accountName).toBe("Sam (Bass) Rivers");
    expect(fields?.accountNo).toBe("12345678");
  });

  it("finds fields hidden in a compressed object stream", () => {
    const dict = "<< /T (pay\\137sort) /V (112233) >> << /T (pay\\137acc) /V (87654321) >>";
    const body = deflateSync(Buffer.from(dict, "latin1"));
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.5\n1 0 obj\n<< /Type /ObjStm /Filter /FlateDecode >>\nstream\n", "latin1"),
      body,
      Buffer.from("\nendstream\nendobj\n", "latin1"),
    ]);
    expect(readInvoiceForm(pdf)).toMatchObject({ sortCode: "112233", accountNo: "87654321" });
  });
});

describe("invoiceAccount", () => {
  const base = { fromName: "", invoiceNo: "INV-7", total: "", accountName: "Sam", sortCode: "112233", accountNo: "1234 5678" };

  it("normalises a usable account", () => {
    expect(invoiceAccount(base, "2026-10-05T09:00:00Z")).toMatchObject({
      account_no: "12345678",
      sort_code: "11-22-33",
      payment_ref: "INV-7",
      source: "Invoice INV-7",
    });
  });

  it("rejects an incomplete one", () => {
    expect(invoiceAccount({ ...base, sortCode: "11-22" }, "")).toBeNull();
  });
});

describe("invoice window", () => {
  const now = new Date("2026-10-05T08:00:00Z");

  it("uses the London wall clock", () => {
    expect(venueStamp(now)).toBe("2026-10-05T09:00");
    expect(venueHourAndDay(now)).toEqual({ hour: 9, weekday: "Mon" });
    expect(venueHourAndDay(new Date("2026-11-02T09:00:00Z"))).toEqual({ hour: 9, weekday: "Mon" });
  });

  it("covers events that started in the last seven days", () => {
    const ev = (date: string, start_time: string | null, is_active = true) => ({ date, start_time, is_active });
    expect(isDueForInvoice(ev("2026-10-03", "20:00"), now)).toBe(true);
    expect(isDueForInvoice(ev("2026-09-28", "09:00"), now)).toBe(true);
    expect(isDueForInvoice(ev("2026-09-28", "08:59"), now)).toBe(false);
    expect(isDueForInvoice(ev("2026-10-05", "20:00"), now)).toBe(false);
    expect(isDueForInvoice(ev("2026-10-03", "20:00", false), now)).toBe(false);
    expect(isDueForInvoice(null, now)).toBe(false);
  });
});

describe("planActBankUpdate", () => {
  const incoming = { account_name: "Sam", account_no: "12345678", sort_code: "11-22-33", payment_ref: "INV-7" };
  const empty = { bank_account_name: null, bank_account_no: null, bank_sort_code: null, bank_payment_ref: null };

  it("fills the main account when the act has none", () => {
    expect(planActBankUpdate({ ...empty, extra_bank_accounts: [] }, incoming)).toEqual({
      action: "set_main",
      columns: { bank_account_name: "Sam", bank_account_no: "12345678", bank_sort_code: "11-22-33", bank_payment_ref: "INV-7" },
    });
  });

  it("does nothing when the act already has the account", () => {
    const act = { ...empty, bank_account_no: "12345678", bank_sort_code: "112233", extra_bank_accounts: [] };
    expect(planActBankUpdate(act, incoming)).toEqual({ action: "none" });
    const extra = { ...empty, bank_account_no: "99999999", bank_sort_code: "000000", extra_bank_accounts: [incoming] };
    expect(planActBankUpdate(extra, incoming)).toEqual({ action: "none" });
  });

  it("adds a new account to the extra list", () => {
    const act = { ...empty, bank_account_no: "99999999", bank_sort_code: "00-00-00", extra_bank_accounts: [] };
    const plan = planActBankUpdate(act, incoming);
    expect(plan.action).toBe("add_extra");
    expect(plan.action === "add_extra" && plan.extra).toHaveLength(1);
  });

  it("sanitises stored lists and formats sort codes", () => {
    expect(sanitizeBankAccounts([null, {}, { account_no: " 1 " }, "x"])).toEqual([
      { account_name: "", account_no: "1", sort_code: "", payment_ref: "" },
    ]);
    expect(formatSortCode("112233")).toBe("11-22-33");
  });
});

describe("AI invoice reading", () => {
  const json = (o: Record<string, unknown>) => "```json\n" + JSON.stringify(o) + "\n```";

  it("accepts an invoice with bank details", () => {
    expect(
      parseInvoiceAiText(
        json({ is_invoice: true, invoice_no: "42", account_name: "Sam", sort_code: "11 22 33", account_no: "12345678" })
      )
    ).toMatchObject({ invoiceNo: "42", sortCode: "11 22 33", accountNo: "12345678" });
  });

  it("rejects non-invoices, missing bank details and junk", () => {
    expect(parseInvoiceAiText(json({ is_invoice: false, sort_code: "112233", account_no: "12345678" }))).toBeNull();
    expect(parseInvoiceAiText(json({ is_invoice: true, account_name: "Sam" }))).toBeNull();
    expect(parseInvoiceAiText("not json")).toBeNull();
  });

  it("only sends readable files under the size cap", () => {
    const small = new Uint8Array(10);
    expect(invoiceAiMimeType({ name: "a.pdf", contentType: "application/pdf", bytes: small })).toBe("application/pdf");
    expect(invoiceAiMimeType({ name: "a.JPG", contentType: "application/octet-stream", bytes: small })).toBe("image/jpeg");
    expect(invoiceAiMimeType({ name: "a.jpg", contentType: "image/jpg", bytes: small })).toBe("image/jpeg");
    expect(invoiceAiMimeType({ name: "a.docx", contentType: null, bytes: small })).toBeNull();
    expect(invoiceAiMimeType({ name: "a.pdf", contentType: "application/pdf", bytes: new Uint8Array(11 * 1024 * 1024) })).toBeNull();
  });

  it("spots a reply that mentions an invoice", () => {
    expect(mentionsInvoice("Re: Thanks for playing", ["INV-0012.pdf"])).toBe(true);
    expect(mentionsInvoice("Invoice attached", [])).toBe(true);
    expect(mentionsInvoice("Our rider", ["poster.jpg", "inventory.pdf"])).toBe(false);
  });
});
