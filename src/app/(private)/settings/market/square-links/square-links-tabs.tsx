import Link from "next/link";
import { cn } from "@/lib/utils";

export type SquareLinksView = "items" | "menu";

const TABS: { view: SquareLinksView; label: string }[] = [
  { view: "items", label: "Square items" },
  { view: "menu", label: "Menu serves" },
];

export default function SquareLinksTabs({ view }: { view: SquareLinksView }) {
  return (
    <nav
      aria-label="Square links views"
      className="inline-flex rounded-xl border border-admin-line bg-admin-surface p-1"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.view}
          href={`/settings/market/square-links?view=${tab.view}`}
          aria-current={view === tab.view ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 items-center rounded-lg px-4 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none sm:min-h-8",
            view === tab.view
              ? "bg-admin-card text-admin-primary shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-admin-primary/25"
              : "text-admin-muted hover:text-admin-primary",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
