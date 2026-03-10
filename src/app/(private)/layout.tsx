"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  CalendarRange, 
  Settings, 
  PlusCircle,
  Trophy,
  Mic2,
  Lock
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Events", href: "/events", icon: CalendarRange },
    { label: "Settings", href: "/settings", icon: Settings },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F4EA] pb-20 sm:pb-0">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-[#E6DFC8] px-4 py-3 sm:px-8">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#26300D] flex items-center justify-center">
              <span className="text-[#FDCC4B] font-black text-xs">DF</span>
            </div>
            <h1 className="text-sm font-black uppercase tracking-widest text-[#1F1F1A]">
              Venue Manager
            </h1>
          </div>
          <button type="button" title="Add New Item" className="sm:hidden p-2 rounded-full bg-[#FFF4CC] text-[#26300D]">
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {children}
      </main>

      {/* Persistent Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E6DFC8] px-6 py-3 sm:hidden flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                isActive ? "text-[#26300D] scale-110" : "text-[#5F624F] opacity-60"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "fill-[#FDCC4B]/20")} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-[#26300D] animate-in fade-in" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}