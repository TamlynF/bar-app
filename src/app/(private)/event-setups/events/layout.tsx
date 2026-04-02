"use client";

import React from "react";
import { cn } from "@/lib/utils";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto w-full transition-all duration-500">
      <div className="flex-1 flex flex-col">
        <main className={cn(
          "flex-1 bg-card rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl min-h-125 overflow-hidden relative"
        )}>
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />
          <div className="h-full relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
