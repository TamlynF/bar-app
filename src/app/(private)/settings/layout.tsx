"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Tags, 
  Users, 
  UserCircle, 
  Shield,
  Settings,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarNavItems = [
  { title: "Table Setups", href: "/settings/tables", icon: <LayoutDashboard className="w-4 h-4" /> },
  { title: "Events", href: "/settings/events", icon: <CalendarDays className="w-4 h-4" /> },
  { title: "Event Types", href: "/settings/event-types", icon: <Tags className="w-4 h-4" /> },
  { title: "Customers", href: "/settings/customers", icon: <UserCircle className="w-4 h-4" /> },
  { title: "Teams", href: "/settings/teams", icon: <Users className="w-4 h-4" /> },
  { title: "System Users", href: "/settings/users", icon: <Shield className="w-4 h-4" /> },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSettingsRoot = pathname === "/settings";

    // Helper to determine the dynamic header title based on route
  const getHeaderTitle = () => {
    // Handling specific path logic as requested
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname.startsWith("/events")) return "Events";
    
    // Breadcrumb for Table Setups
    if (pathname === "/settings/tables") {
      return "setups > Table Setups";
    }

    if (isSettingsRoot) return "Settings";

    // Fallback: Check for other settings items to maintain context
    const activeItem = sidebarNavItems.find((item) => item.href === pathname);
    return activeItem?.title || "Settings";
  };

  const displayTitle = getHeaderTitle();

  return (
    <div className="flex flex-col min-h-screen bg-background lg:flex-row lg:space-x-12 p-4 md:p-8 max-w-7xl mx-auto w-full transition-all duration-500">  
      {/* Sidebar Section */}
      <aside className={cn(
        "lg:w-1/4 shrink-0",
        // On mobile, hide the sidebar list if we are inside a sub-setting to save space
        !isSettingsRoot && "hidden lg:block"
      )}>
        {/* Desktop & Mobile Root Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary rounded-xl">
              <Settings className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-foreground uppercase leading-tight">
              {displayTitle}
            </h2>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Configure venue operations and manage databases.</p>
        </div>

        {/* Sidebar Navigation - Hidden on mobile when inside a sub-page */}
        <nav className="hidden lg:flex flex-col space-y-1.5">
          {sidebarNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <span className={cn(
                  "transition-colors shrink-0",
                  isActive ? "text-primary-foreground" : "text-primary"
                )}>
                  {item.icon}
                </span>
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Back Button - Only shows when NOT on the settings root */}
        {!isSettingsRoot && (
          <div className="lg:hidden mb-6 flex items-center justify-between">
            <Link 
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-full text-xs font-black uppercase tracking-widest text-primary shadow-sm active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            {/* Breadcrumb indicator for mobile */}
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground pr-2 text-right max-w-37.5 truncate">
              {displayTitle}
            </span>
          </div>
        )}

        <main className={cn(
          "flex-1 bg-card rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl min-h-125 overflow-hidden relative",
          // On the settings hub (mobile), we remove the heavy card styling so tiles look native
          isSettingsRoot && "bg-transparent border-none shadow-none lg:bg-card lg:border lg:shadow-2xl"
        )}>
          {/* Decorative background blurs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10"></div>
          
          <div className="h-full relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}