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
    <div className={cn(
      "mx-auto flex w-full max-w-7xl flex-col bg-background px-4 pb-4 transition-all duration-500 sm:pt-0 md:px-8 md:pb-8 lg:flex-row lg:space-x-12",
      isSettingsRoot ? "min-h-screen pt-4" : "h-full min-h-0 pt-0",
    )}>
      <div className="flex min-h-0 flex-1 flex-col">
        <main className={cn(
          "relative min-h-0 flex-1",
          isSettingsRoot && "min-h-125",
          isSettingsRoot &&
            "overflow-hidden lg:rounded-[2.5rem] lg:border lg:border-[#D8D5C8] lg:bg-card lg:shadow-2xl"
        )}>
          {isSettingsRoot && (
            <>
              <div className="pointer-events-none absolute top-0 right-0 -z-10 h-80 w-80 rounded-full bg-primary/5 blur-[120px]"></div>
              <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-64 w-64 rounded-full bg-primary/5 blur-[100px]"></div>
            </>
          )}

          <div className="relative z-10 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}