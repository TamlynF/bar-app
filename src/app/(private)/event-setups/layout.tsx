"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isWidePath } from "@/lib/admin-nav";

export default function EventSetupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSettingsRoot = pathname === "/event-setups";
  // The private shell has already released the width; capping again here would
  // put the frame straight back on.
  const wide = isWidePath(pathname);

  return (
    <div className={cn(
      "mx-auto flex min-h-full w-full flex-col bg-background px-2 pt-2 pb-2 transition-all duration-500 sm:pt-0 md:pb-8 lg:flex-row lg:space-x-12",
      wide ? "max-w-none md:px-4" : "max-w-7xl md:px-8",
    )}>
      <div className="flex flex-1 flex-col">
        <main className={cn(
          "relative flex-1 overflow-clip",
          isSettingsRoot && "border-none bg-transparent shadow-none lg:border lg:bg-card lg:shadow-2xl"
        )}>
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