import { cn } from "@/lib/utils"
import { statusTheme } from "@/lib/booking-status-theme"

export default function StatusCircle({
  guestCount,
  teamCount,
  status,
  label,
  isActive,
  onClick,
  unit = "teams",
}: {
  guestCount: number,
  teamCount: number,
  status: string,
  label: string,
  isActive: boolean,
  onClick: () => void,
  unit?: string,
}) {
  const theme = statusTheme[status] || statusTheme.pending

  return (
    <div className="flex min-w-14 shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border-2 transition-all hover:scale-105 active:scale-95",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white ${theme.border}`,
        )}
      >
        <div className="flex flex-col items-center gap-0.5 leading-none">
          <span className={cn("font-black text-sm leading-none", isActive ? "text-white" : theme.text)}>
            {teamCount}
          </span>
          <span className={cn(
            "hidden text-[9px] font-bold tracking-tight uppercase opacity-70 sm:block",
            isActive ? "text-white" : theme.text
          )}>
            {unit}
          </span>
        </div>
      </button>
      <div className="flex flex-col items-center leading-none">
        <span className={cn("font-black text-[10px] tracking-tight uppercase sm:text-[11px]", isActive ? theme.text : "text-[#5E6654]")}>
          {label}
        </span>
        <span className="mt-0.5 text-[9px] font-bold text-[#5E6654] uppercase sm:text-[10px]">
          {guestCount} Guests
        </span>
      </div>
    </div>
  )
}