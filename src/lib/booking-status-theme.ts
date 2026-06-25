// Single source of truth for the booking-status colour/icon theme used across
// the event-bookings admin surfaces (quiz, bingo) and the shared StatusCircle.
// Icons are stored as Lucide *components* (not rendered JSX) so this stays a
// plain .ts module — consumers render <theme.icon className="w-5 h-5" />.
// Mirrors the convention in booking-card-icons.ts.

import {
  Table as TableIcon,
  CheckCircle2,
  Clock3,
  HelpCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react"

export const statusTheme: Record<
  string,
  {
    bg: string
    text: string
    border: string
    dot: string
    ring: string
    cardBorder: string
    icon: LucideIcon
  }
> = {
  all: {
    bg: "bg-[#F7F4EA]",
    text: "text-[#1F1F1A]",
    border: "border-[#E6DFC8]",
    dot: "bg-[#5F624F]",
    ring: "ring-slate-500/40",
    cardBorder: "border-[#E6DFC8]",
    icon: TableIcon,
  },
  confirmed: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    ring: "ring-green-500/40",
    cardBorder: "border-green-500/50",
    icon: CheckCircle2,
  },
  waitlisted: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
    ring: "ring-orange-500/40",
    cardBorder: "border-orange-500/50",
    icon: Clock3,
  },
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-yellow-200",
    dot: "bg-amber-500",
    ring: "ring-yellow-500/40",
    cardBorder: "border-yellow-500/50",
    icon: HelpCircle,
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    ring: "ring-red-500/40",
    cardBorder: "border-red-500/50",
    icon: XCircle,
  },
}
