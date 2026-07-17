"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function EventsHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isEventsRoot = pathname === "/event-bookings";
  // The band-applications board owns the full content area and its own gutters —
  // see WIDE_PATHS in private-layout-client.
  const isWide = pathname === "/event-bookings/music-bookings";

  return (
    <div className={cn(
      "mx-auto flex min-h-screen w-full flex-col bg-background px-2 pt-2 pb-2 transition-all duration-500 sm:pt-0 md:pb-8 lg:flex-row lg:space-x-12",
      isWide ? "max-w-none md:px-0" : "max-w-7xl md:px-8"
    )}>
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        <main className={cn(
          "relative flex-1 overflow-hidden",
          isEventsRoot && "border-none bg-transparent shadow-none lg:border lg:bg-card lg:shadow-2xl"
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