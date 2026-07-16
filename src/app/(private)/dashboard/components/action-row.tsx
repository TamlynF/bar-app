import { ChevronRight} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ActionRow({
  label,
  count,
  icon: Icon,
  href,
  activeColor,
  activeBg,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  href: string;
  activeColor: string;
  activeBg: string;
}) {
  const hasItems = count > 0;
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-[#F7F4EA] active:bg-[#E6DFC8]"
    >
      <div
        className={cn(
          "flex h-6 w-8 shrink-0 items-center justify-center rounded-lg",
          hasItems ? activeBg : "bg-[#F7F4EA]"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", hasItems ? activeColor : "text-[#5F624F]")} />
      </div>
      <span className="flex-1 text-[11px] font-bold tracking-wide text-[#5F624F] uppercase sm:text-[11px]">
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums",
            hasItems
              ? `${activeBg} ${activeColor}`
              : "bg-[#F7F4EA] text-[#5F624F]"
          )}
        >
          {count}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-[#5F624F] opacity-40" />
      </div>
    </Link>
  );
}