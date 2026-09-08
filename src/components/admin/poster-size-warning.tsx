import { AlertTriangle } from "lucide-react";

export function PosterSizeWarning({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl border border-admin-warning/40 bg-admin-warning-bg px-3 py-2 text-[12px] leading-snug font-semibold text-admin-warning"
    >
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
