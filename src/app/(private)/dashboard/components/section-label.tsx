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
        className={cn("w-4 h-4", highlight ? "text-red-600" : "text-[#5F624F]")}
      />
      <h2 className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
        {label}
      </h2>
      {badge && (
        <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse">
          {badge}
        </span>
      )}
    </div>
  );
}