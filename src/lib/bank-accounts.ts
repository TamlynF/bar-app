/* Bank details as an act gives them to us. The main account lives in the
   bank_* columns of music_acts and band_booking_requests; any further account
   an act uses sits in music_acts.extra_bank_accounts. */

export type BankAccount = {
  account_name: string;
  account_no: string;
  sort_code: string;
  payment_ref: string;
  source?: string;
  added_at?: string;
};

export type MainBankColumns = {
  bank_account_name: string | null;
  bank_account_no: string | null;
  bank_sort_code: string | null;
  bank_payment_ref: string | null;
};

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatSortCode(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  return digits.length === 6 ? `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}` : (value ?? "").trim();
}

export function isUsableAccount(a: Pick<BankAccount, "account_no" | "sort_code">): boolean {
  return digitsOnly(a.sort_code).length === 6 && digitsOnly(a.account_no).length >= 6;
}

export function sameAccount(
  a: Pick<BankAccount, "account_no" | "sort_code">,
  b: Pick<BankAccount, "account_no" | "sort_code">
): boolean {
  return digitsOnly(a.account_no) === digitsOnly(b.account_no) && digitsOnly(a.sort_code) === digitsOnly(b.sort_code);
}

export function mainAccount(row: MainBankColumns): BankAccount {
  return {
    account_name: row.bank_account_name ?? "",
    account_no: row.bank_account_no ?? "",
    sort_code: row.bank_sort_code ?? "",
    payment_ref: row.bank_payment_ref ?? "",
  };
}

export function hasMainAccount(row: MainBankColumns): boolean {
  return Boolean(digitsOnly(row.bank_account_no) || digitsOnly(row.bank_sort_code));
}

export function toMainColumns(a: BankAccount): MainBankColumns {
  return {
    bank_account_name: a.account_name.trim() || null,
    bank_account_no: digitsOnly(a.account_no) || null,
    bank_sort_code: formatSortCode(a.sort_code) || null,
    bank_payment_ref: a.payment_ref.trim() || null,
  };
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function sanitizeBankAccounts(raw: unknown): BankAccount[] {
  if (!Array.isArray(raw)) return [];
  const out: BankAccount[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const account: BankAccount = {
      account_name: text(r.account_name),
      account_no: text(r.account_no),
      sort_code: text(r.sort_code),
      payment_ref: text(r.payment_ref),
      ...(text(r.source) ? { source: text(r.source) } : {}),
      ...(text(r.added_at) ? { added_at: text(r.added_at) } : {}),
    };
    if (!account.account_name && !account.account_no && !account.sort_code && !account.payment_ref) continue;
    out.push(account);
  }
  return out;
}

export type ActBankUpdate =
  | { action: "set_main"; columns: MainBankColumns }
  | { action: "add_extra"; extra: BankAccount[] }
  | { action: "none" };

/* Where an account read from an invoice goes on the act: into the main
   columns when the act has none, onto the extra list when it is new, and
   nowhere when the act already has it. */
export function planActBankUpdate(
  act: MainBankColumns & { extra_bank_accounts: unknown },
  incoming: BankAccount
): ActBankUpdate {
  if (!hasMainAccount(act)) return { action: "set_main", columns: toMainColumns(incoming) };
  const extra = sanitizeBankAccounts(act.extra_bank_accounts);
  if (sameAccount(mainAccount(act), incoming) || extra.some((a) => sameAccount(a, incoming))) {
    return { action: "none" };
  }
  const stored: BankAccount = {
    ...incoming,
    account_no: digitsOnly(incoming.account_no),
    sort_code: formatSortCode(incoming.sort_code),
  };
  return { action: "add_extra", extra: [...extra, stored] };
}
