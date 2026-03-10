"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSettingsRoot = pathname === "/settings";

  return (
    <div className="flex flex-col min-h-screen bg-background lg:flex-row lg:space-x-12 p-4 md:p-8 max-w-7xl mx-auto w-full transition-all duration-500">  
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