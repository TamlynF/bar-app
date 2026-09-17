export const CARD = "rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5";
export const PRIMARY_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:h-9";
export const OUTLINE_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft disabled:opacity-50 sm:h-9";
export const NEUTRAL_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-line px-4 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface disabled:opacity-50 sm:h-9";
/* Row actions are icon-only on phones, so they sit as round 44px targets
   rather than wide pills with their label hidden. */
export const ROW_ICON_BUTTON = "max-sm:w-11 max-sm:rounded-full max-sm:px-0";
export const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";

export function formatRunDate(iso: string | null): string {
  if (!iso) return "Never run";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatStamp(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatShortStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
