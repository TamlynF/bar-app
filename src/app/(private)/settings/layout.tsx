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
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col bg-background px-4 pt-4 pb-4 transition-all duration-500 sm:pt-0 md:px-8 md:pb-8 lg:flex-row lg:space-x-12">  
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        <main className={cn(
          "relative min-h-125 flex-1 overflow-hidden rounded-[2.5rem] border border-[#E6DFC8] bg-card shadow-2xl",
          isSettingsRoot && "border-none bg-transparent shadow-none lg:border lg:bg-card lg:shadow-2xl"
        )}>
          {/* Decorative background blurs */}
          <div className="pointer-events-none absolute top-0 right-0 -z-10 h-80 w-80 rounded-full bg-primary/5 blur-[120px]"></div>
          <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-64 w-64 rounded-full bg-primary/5 blur-[100px]"></div>
          
          <div className="relative z-10 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}