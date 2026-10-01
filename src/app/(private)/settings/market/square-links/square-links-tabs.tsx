import Link from "next/link";
import { cn } from "@/lib/utils";

export type SquareLinksView = "items" | "menu";

const TABS: { view: SquareLinksView; label: string }[] = [
  { view: "items", label: "Square items" },
  { view: "menu", label: "Menu serves" },
];

export default function SquareLinksTabs({ view }: { view: SquareLinksView }) {
  return (
    <nav aria-label="Square links views" className="flex gap-1">
      {TABS.map((tab) => (
        <Link
          key={tab.view}
          href={`/settings/market/square-links?view=${tab.view}`}
          aria-current={view === tab.view ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-semibold transition-colors sm:min-h-9",
            view === tab.view
              ? "bg-admin-primary-soft text-admin-primary"
              : "text-admin-muted hover:bg-admin-surface hover:text-admin-primary",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
