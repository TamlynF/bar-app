import { cn } from "@/lib/utils"
import { statusTheme } from "./band-booking-card"

export default function StatusCircle({
  count,
  status,
  label,
  isActive,
  onClick
}: {
  count: number,
  status: string,
  label: string,
  isActive: boolean,
  onClick: () => void
}) {
  const theme = statusTheme[status] || statusTheme.pending

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-14 shrink-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all touch-manipulation hover:scale-105 active:scale-95",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white ${theme.border}`,
        )}
      >
        <span className={cn("text-sm font-black leading-none", isActive ? "text-white" : theme.text)}>
          {count}
        </span>
      </button>
      <span className={cn("text-[10px] sm:text-[11px] font-black uppercase tracking-tight", isActive ? theme.text : "text-[#5F624F]")}>
        {label}
      </span>
    </div>
  )
}
