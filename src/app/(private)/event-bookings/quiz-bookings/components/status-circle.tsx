import { cn } from "@/lib/utils"
import { statusTheme } from "./booking-list-client"

export default function StatusCircle({ 
  guestCount, 
  teamCount, 
  status, 
  label, 
  isActive, 
  onClick 
}: { 
  guestCount: number, 
  teamCount: number,
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
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white dark:bg-slate-800 ${theme.border}`,
        )}
      >
        <div className="flex flex-col items-center leading-none gap-0.5">
          <span className={cn("text-sm font-black leading-none", isActive ? "text-white" : theme.text)}>
            {teamCount}
          </span>
          <span className={cn(
            "hidden sm:block text-[8px] font-bold uppercase tracking-tight opacity-70",
            isActive ? "text-white" : theme.text
          )}>
            teams
          </span>
        </div>
      </button>
      <div className="flex flex-col items-center leading-none">
        <span className={cn("text-[9px] sm:text-[11px] font-black uppercase tracking-tight", isActive ? theme.text : "text-slate-500")}>
          {label}
        </span>
        <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase mt-0.5">
          {guestCount} Guests
        </span>
      </div>
    </div>
  )
}