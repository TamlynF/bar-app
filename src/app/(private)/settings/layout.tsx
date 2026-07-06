"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSettingsRoot = pathname === "/settings";

  return (
    <div className="flex flex-col min-h-screen bg-background lg:flex-row lg:space-x-12 px-4 md:px-8 pt-4 sm:pt-0 pb-4 md:pb-8 max-w-7xl mx-auto w-full transition-all duration-500">  
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <main className={cn(
          "flex-1 bg-card rounded-[2.5rem] border border-[#E6DFC8] shadow-2xl min-h-125 overflow-hidden relative",
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