import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AdminNavItem } from "@/lib/admin-nav";

export function AdminHubTile({ item }: { item: AdminNavItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-admin-line bg-admin-card p-3 shadow-sm transition-all hover:border-admin-primary hover:bg-admin-surface active:scale-[0.98]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-admin-primary-soft text-admin-primary">
          <item.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-admin-ink">{item.label}</p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-admin-muted">{item.description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-admin-muted transition-colors group-hover:text-admin-primary" />
    </Link>
  );
}

export function AdminHubGrid({ items }: { items: AdminNavItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <AdminHubTile key={item.href} item={item} />
      ))}
    </div>
  );
}

export function AdminHubSection({ label, items }: { label: string; items: AdminNavItem[] }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-[13px] font-semibold text-admin-muted">{label}</h2>
      <AdminHubGrid items={items} />
    </section>
  );
}
