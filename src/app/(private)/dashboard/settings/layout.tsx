"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Tags, 
  Users, 
  UserCircle, 
  Shield 
} from "lucide-react";

const sidebarNavItems = [
  {
    title: "Table Setups",
    href: "/dashboard/settings/tables",
    icon: <LayoutDashboard className="w-4 h-4 mr-2" />,
  },
  {
    title: "Events",
    href: "/dashboard/settings/events",
    icon: <CalendarDays className="w-4 h-4 mr-2" />,
  },
  {
    title: "Event Types",
    href: "/dashboard/settings/event-types",
    icon: <Tags className="w-4 h-4 mr-2" />,
  },
  {
    title: "Customers",
    href: "/dashboard/settings/customers",
    icon: <UserCircle className="w-4 h-4 mr-2" />,
  },
  {
    title: "Teams",
    href: "/dashboard/settings/teams",
    icon: <Users className="w-4 h-4 mr-2" />,
  },
  {
    title: "System Users",
    href: "/dashboard/settings/users",
    icon: <Shield className="w-4 h-4 mr-2" />,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 p-8 max-w-7xl mx-auto w-full">
      <aside className="lg:w-1/4">
        <div className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground text-sm">
            Manage your bar operations, events, and system users.
          </p>
        </div>
        <nav className="flex flex-col space-y-1">
          {sidebarNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                {item.title}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 lg:max-w-4xl bg-card rounded-xl border shadow-sm min-h-[600px] overflow-hidden">
        {children}
      </main>
    </div>
  );
}