"use client";

import React, { useState, useEffect } from "react";
// Standard Lucide icons for navigation
import { 
  LayoutDashboard, 
  CalendarDays, 
  Tags, 
  Users, 
  UserCircle, 
  Shield,
  ChevronDown,
  Settings,
  X,
  Check
} from "lucide-react";

// Typed utility for merging tailwind classes (replacing 'any')
function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}

const sidebarNavItems = [
  {
    title: "Table Setups",
    href: "/dashboard/settings/tables",
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    title: "Events",
    href: "/dashboard/settings/events",
    icon: <CalendarDays className="w-4 h-4" />,
  },
  {
    title: "Event Types",
    href: "/dashboard/settings/event-types",
    icon: <Tags className="w-4 h-4" />,
  },
  {
    title: "Customers",
    href: "/dashboard/settings/customers",
    icon: <UserCircle className="w-4 h-4" />,
  },
  {
    title: "Teams",
    href: "/dashboard/settings/teams",
    icon: <Users className="w-4 h-4" />,
  },
  {
    title: "System Users",
    href: "/dashboard/settings/users",
    icon: <Shield className="w-4 h-4" />,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentPath, setCurrentPath] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Fix: Using requestAnimationFrame defers the state update until after the
    // browser has handled the current render cycle, preventing "cascading renders".
    const animationFrame = requestAnimationFrame(() => {
      setIsMounted(true);
      setCurrentPath(window.location.pathname);
    });

    const handlePathChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    window.addEventListener('popstate', handlePathChange);
    
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('popstate', handlePathChange);
    };
  }, []);

  // On server and during first client render, default to the first item for consistency.
  const activeItem = sidebarNavItems.find((item) => item.href === currentPath) || sidebarNavItems[0];

  return (
    <div className="flex flex-col min-h-screen bg-background lg:flex-row lg:space-x-12 p-4 md:p-8 max-w-7xl mx-auto w-full transition-all duration-500">
      
      {/* Sidebar Section */}
      <aside className="lg:w-1/4 shrink-0">
        {/* Desktop Header */}
        <div className="mb-8 hidden lg:block">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">Settings</h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed font-medium pl-1">
            Configure venue operations, manage team databases, and adjust staff roles.
          </p>
        </div>

        {/* Mobile Navigation Header & Trigger */}
        <div className="lg:hidden w-full mb-6">
          <div className="flex items-center justify-between mb-5 px-1">
            <div className="flex items-center gap-2">
               <div className="p-2 bg-primary/10 rounded-lg">
                <Settings className="w-5 h-5 text-primary" />
               </div>
               <h2 className="text-xl font-bold tracking-tight text-foreground">Settings</h2>
            </div>
            <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] uppercase font-black tracking-widest text-primary">
              Admin Mode
            </div>
          </div>
          
          <button 
            type="button"
            className={cn(
              "w-full flex items-center justify-between h-16 px-5 bg-card border border-slate-200 dark:border-white/10 shadow-lg rounded-2xl transition-all active:scale-[0.98] outline-none focus:ring-2 focus:ring-primary/20",
              isMobileMenuOpen && "border-primary/50 ring-4 ring-primary/5"
            )}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary scale-110">
                {activeItem.icon}
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] uppercase text-muted-foreground font-black tracking-widest opacity-70">Active Section</span>
                <span className="font-bold text-lg text-foreground">
                  {/* Hydration Guard: Only show specific title once client state is ready */}
                  {isMounted ? activeItem.title : "Settings"}
                </span>
              </div>
            </div>
            <div className={cn(
              "p-2 rounded-full transition-colors",
              isMobileMenuOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 animate-in fade-in zoom-in duration-300" />
              ) : (
                <ChevronDown className="w-5 h-5 transition-transform duration-300" />
              )}
            </div>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className={cn(
          "flex flex-col space-y-2 transition-all duration-500 ease-in-out overflow-hidden",
          "lg:opacity-100 lg:max-h-full lg:block", 
          isMobileMenuOpen 
            ? "max-h-150 opacity-100 mb-8 translate-y-0" 
            : "max-h-0 opacity-0 lg:max-h-none lg:opacity-100 -translate-y-4 lg:translate-y-0"
        )}>
          <div className="p-2 lg:p-0 space-y-1.5 bg-muted/10 lg:bg-transparent rounded-3xl border border-slate-200 lg:border-none dark:border-white/5">
            {sidebarNavItems.map((item) => {
              // Hydration Guard: Check isActive only if mounted to prevent server/client mismatch
              const isActive = isMounted && currentPath === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setCurrentPath(item.href);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-4 lg:py-3 text-sm font-bold rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-[1.02] lg:scale-100"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:translate-x-1 lg:hover:translate-x-0"
                  )}
                >
                  <span className={cn(
                    "transition-colors shrink-0",
                    isActive ? "text-primary-foreground" : "text-primary group-hover:text-primary"
                  )}>
                    {item.icon}
                  </span>
                  <span className="relative z-10">{item.title}</span>
                  
                  {isActive && (
                    <div className="ml-auto flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/40 animate-pulse hidden lg:block" />
                      <Check className="w-4 h-4 lg:hidden text-primary-foreground" />
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 lg:max-w-4xl bg-card rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl min-h-125 lg:min-h-187.5 overflow-hidden relative",
        "animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out"
      )}>
        {/* Background elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10"></div>
        
        <div className="h-full relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}