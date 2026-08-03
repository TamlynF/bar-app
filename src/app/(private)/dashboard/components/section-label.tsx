import { cn } from "@/lib/utils";

export default function SectionLabel({
  icon: Icon,
  label,
  highlight,
  badge,
  action,
}: {
  icon: React.ElementType;
  label: string;
  highlight?: boolean;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon
        className={cn("h-4.5 w-4.5", highlight ? "text-admin-error" : "text-admin-muted")}
      />
      <h2 className="text-[15px] leading-tight font-bold tracking-tight text-admin-ink">
        {label}
      </h2>
      {badge && (
        <span className="ml-1 rounded-full bg-admin-error px-2 py-0.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}