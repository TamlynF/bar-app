import { cn } from "@/lib/utils";

export default function SectionLabel({
  icon: Icon,
  label,
  highlight,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon
        className={cn("h-4 w-4", highlight ? "text-red-600" : "text-[#5F624F]")}
      />
      <h2 className="font-black text-[11px] tracking-wide text-[#5F624F] uppercase">
        {label}
      </h2>
      {badge && (
        <span className="ml-1 animate-pulse rounded-full bg-red-500 px-2 py-0.5 font-black text-[9px] text-white">
          {badge}
        </span>
      )}
    </div>
  );
}