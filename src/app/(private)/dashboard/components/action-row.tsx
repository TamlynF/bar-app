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
  activeDot,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  href: string;
  activeColor: string;
  activeBg: string;
  activeDot: string;
}) {
  const hasItems = count > 0;
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#F7F4EA] transition-colors active:bg-[#E6DFC8]"
    >
      <div
        className={cn(
          "w-8 h-6 rounded-lg flex items-center justify-center shrink-0",
          hasItems ? activeBg : "bg-[#F7F4EA]"
        )}
      >
        <Icon className={cn("w-3.5 h-3.5", hasItems ? activeColor : "text-gray-500")} />
      </div>
      <span className="flex-1 text-[11px] sm:text-[11px] font-black uppercase tracking-widest text-gray-700">
        {label}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            "text-sm font-black tabular-nums px-2.5 py-0.5 rounded-full",
            hasItems
              ? `${activeBg} ${activeColor}`
              : "bg-[#F7F4EA] text-gray-500"
          )}
        >
          {count}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-[#5F624F] opacity-40" />
      </div>
    </Link>
  );
}