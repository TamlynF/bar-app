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
      className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-[#F4F1E8] active:bg-[#D8D5C8]"
    >
      <div
        className={cn(
          "flex h-6 w-8 shrink-0 items-center justify-center rounded-lg",
          hasItems ? activeBg : "bg-[#F4F1E8]"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", hasItems ? activeColor : "text-[#5E6654]")} />
      </div>
      <span className="flex-1 text-[13px] font-bold tracking-wide text-[#5E6654] uppercase sm:text-[13px]">
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums",
            hasItems
              ? `${activeBg} ${activeColor}`
              : "bg-[#F4F1E8] text-[#5E6654]"
          )}
        >
          {count}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-[#5E6654] opacity-40" />
      </div>
    </Link>
  );
}