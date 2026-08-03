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
  const theme = statusTheme[status] || statusTheme.new

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:min-w-14 sm:flex-none sm:shrink-0 sm:gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border-2 transition-all hover:scale-105 active:scale-95 sm:h-12 sm:w-12",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white ${theme.border}`,
        )}
      >
        <span className={cn("font-black text-[13px] leading-none sm:text-sm", isActive ? "text-white" : theme.text)}>
          {count}
        </span>
      </button>
      <span className={cn("w-full truncate text-center font-black text-[9px] tracking-tight uppercase sm:text-[11px]", isActive ? theme.text : "text-[#5E6654]")}>
        {label}
      </span>
    </div>
  )
}
