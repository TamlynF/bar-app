import { inflateSync } from "node:zlib";

/* Reads the filled-in fields of our fillable invoice template (the PDF the
   weekly invoice request attaches). A form field is a dictionary carrying its
   name in /T and its value in /V; viewers that save with compressed object
   streams hide those dictionaries inside Flate streams, so every stream is
   inflated and searched as well. A flattened or retyped invoice has no fields
   and reads as null - staff then copy the details across by hand. */

export type InvoiceFields = {
  fromName: string;
  invoiceNo: string;
  total: string;
  accountName: string;
  sortCode: string;
  accountNo: string;
};

const FIELD_KEYS: Record<string, keyof InvoiceFields> = {
  from_name: "fromName",
  invoice_no: "invoiceNo",
  total: "total",
  pay_name: "accountName",
  pay_sort: "sortCode",
  pay_acc: "accountNo",
};

const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };

function readLiteral(s: string, start: number): { value: string; end: number } | null {
  let depth = 0;
  let out = "";
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      const next = s[i + 1];
      if (/[0-7]/.test(next)) {
        const oct = /^[0-7]{1,3}/.exec(s.slice(i + 1, i + 4))![0];
        out += String.fromCharCode(parseInt(oct, 8));
        i += oct.length;
      } else if (next === "\r" || next === "\n") {
        i += next === "\r" && s[i + 2] === "\n" ? 2 : 1;
      } else {
        out += ESCAPES[next] ?? next;
        i += 1;
      }
      continue;
    }
    if (c === "(") {
      if (depth > 0) out += c;
      depth += 1;
      continue;
    }
    if (c === ")") {
      depth -= 1;
      if (depth === 0) return { value: out, end: i + 1 };
      out += c;
      continue;
    }
    out += c;
  }
  return null;
}

function decodeText(raw: string): string {
  if (raw.charCodeAt(0) === 0xfe && raw.charCodeAt(1) === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < raw.length; i += 2) out += String.fromCharCode((raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1));
    return out;
  }
  return raw;
}

function readString(s: string, at: number): { value: string; end: number } | null {
  let i = at;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] === "(") {
    const lit = readLiteral(s, i);
    return lit ? { value: decodeText(lit.value), end: lit.end } : null;
  }
  if (s[i] === "<" && s[i + 1] !== "<") {
    const close = s.indexOf(">", i);
    if (close < 0) return null;
    const hex = s.slice(i + 1, close).replace(/\s/g, "");
    const padded = hex.length % 2 ? hex + "0" : hex;
    let raw = "";
    for (let j = 0; j < padded.length; j += 2) raw += String.fromCharCode(parseInt(padded.slice(j, j + 2), 16));
    return { value: decodeText(raw), end: close + 1 };
  }
  return null;
}

function dictAround(s: string, at: number): string | null {
  let depth = 0;
  let start = -1;
  for (let j = at - 1; j > 0; j--) {
    if (s[j] === ">" && s[j - 1] === ">") {
      depth++;
      j--;
    } else if (s[j] === "<" && s[j - 1] === "<") {
      if (depth === 0) {
        start = j - 1;
        break;
      }
      depth--;
      j--;
    }
  }
  if (start < 0) return null;
  depth = 0;
  for (let j = start; j < s.length - 1; j++) {
    if (s[j] === "<" && s[j + 1] === "<") {
      depth++;
      j++;
    } else if (s[j] === ">" && s[j + 1] === ">") {
      depth--;
      j++;
      if (depth === 0) return s.slice(start, j + 1);
    }
  }
  return null;
}

function tryInflate(data: Buffer): string | null {
  try {
    return inflateSync(data).toString("latin1");
  } catch {
    return null;
  }
}

function searchableText(bytes: Uint8Array): string[] {
  const buf = Buffer.from(bytes);
  const raw = buf.toString("latin1");
  const out = [raw];
  const streamRe = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw))) {
    const begin = m.index + m[0].length;
    const finish = raw.indexOf("endstream", begin);
    if (finish < 0) break;
    const inflated = tryInflate(buf.subarray(begin, finish));
    if (inflated?.includes("/T")) out.push(inflated);
    streamRe.lastIndex = finish;
  }
  return out;
}

export function readInvoiceForm(bytes: Uint8Array): InvoiceFields | null {
  const found: Partial<InvoiceFields> = {};
  for (const s of searchableText(bytes)) {
    const nameRe = /\/T\s*(?=[(<])/g;
    let m: RegExpExecArray | null;
    while ((m = nameRe.exec(s))) {
      const name = readString(s, m.index + m[0].length);
      const key = name ? FIELD_KEYS[name.value] : undefined;
      if (!key || found[key]) continue;
      const dict = dictAround(s, m.index);
      const v = dict ? /\/V\s*(?=[(<])/.exec(dict) : null;
      const value = v && dict ? readString(dict, v.index + v[0].length) : null;
      if (value?.value.trim()) found[key] = value.value.trim();
    }
  }
  if (!found.accountNo && !found.sortCode && !found.accountName) return null;
  return {
    fromName: found.fromName ?? "",
    invoiceNo: found.invoiceNo ?? "",
    total: found.total ?? "",
    accountName: found.accountName ?? "",
    sortCode: found.sortCode ?? "",
    accountNo: found.accountNo ?? "",
  };
}
