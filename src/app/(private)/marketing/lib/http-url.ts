export function isSafeHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") return false;
  if (host === "::1" || host.startsWith("[")) return false;
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
  return true;
}

export function stripTrackingParams(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || lower === "fbclid" || lower === "gclid" || lower === "mc_cid") {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return raw;
  }
}
