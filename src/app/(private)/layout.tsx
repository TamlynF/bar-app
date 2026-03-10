"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    CalendarRange,
    Settings,
    PlusCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    const navItems = [
        { label: "Home", href: "/dashboard", icon: LayoutDashboard },
        { label: "Events", href: "/events", icon: CalendarRange },
        { label: "Settings", href: "/settings", icon: Settings },
    ]

    const getPageTitle = () => {
        if (!pathname) return "Venue Manager"

        if (pathname === "/dashboard") return "Dashboard"
        if (pathname.startsWith("/events")) return "Events"

        if (pathname.startsWith("/settings")) {
            if (pathname === "/settings") return "Settings"

            const settingsMap: Record<string, string> = {
                "tables": "Table Setups",
                "events": "Events",
                "event-types": "Event Types",
                "customers": "Customers",
                "teams": "Teams",
                "users": "System Users",
            }

            const segment = pathname.split("/")[2]
            const subTitle = settingsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")

            return `Settings > ${subTitle}`
        }
        return "Venue Manager"
    }

    return (
        <div className="flex min-h-screen bg-[#F7F4EA]">
            {/* 1. Sidebar for Tablets/Desktops */}
            <aside className="hidden sm:flex flex-col w-64 bg-white border-r border-[#E6DFC8] sticky top-0 h-screen shrink-0">
                {/* Sidebar Brand */}
                <div className="p-6 border-b border-[#E6DFC8] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#26300D] flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-[#FDCC4B] font-black text-sm">DF</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1F1F1A]">Venue</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1F1F1A]/50">Manager</span>
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const normalizedPathname = pathname?.replace(/\/$/, "") || ""
                        const normalizedHref = item.href.replace(/\/$/, "")
                        const isActive = normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-xs uppercase tracking-wider",
                                    isActive
                                        ? "bg-[#26300D] text-white shadow-lg shadow-[#26300D]/10"
                                        : "text-[#5F624F] hover:bg-[#26300D]/5"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive ? "text-[#FDCC4B]" : "text-[#5F624F]")} />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                {/* Sidebar Footer (Optional Info) */}
                <div className="p-4 border-t border-[#E6DFC8]">
                    <p className="text-[8px] text-[#5F624F] font-bold uppercase tracking-widest opacity-40 px-4">
                        v0.1.0 Alpha
                    </p>
                </div>
            </aside>

            {/* 2. Main Content Wrapper */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* Dynamic Header (Sticky) */}
                <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-[#E6DFC8] px-4 py-3 sm:px-8">
                    <div className="flex items-center justify-center max-w-7xl mx-auto">
                        {/* Centered Dynamic Page Title / Breadcrumb */}
                        <h1 className="text-lg font-black uppercase tracking-widest text-[#1F1F1A]">
                            {getPageTitle()}
                        </h1>
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <main className="flex-1 w-full max-w-7xl mx-auto p-1 sm:p-6 pb-20 sm:pb-8">
                    {children}
                </main>

                {/* 3. Persistent Mobile Bottom Navigation (Visible only on mobile) */}
                <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E6DFC8] py-2 sm:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-around items-center w-full max-w-md mx-auto px-6">
                        {navItems.map((item) => {
                            // Normalize paths by removing trailing slashes for the comparison
                            const normalizedPathname = pathname?.replace(/\/$/, "") || ""
                            const normalizedHref = item.href.replace(/\/$/, "")

                            // Check if it's an exact match or a sub-route
                            const isActive = normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex flex-col items-center gap-1 transition-all duration-300 outline-none relative py-1 flex-1",
                                        isActive ? "opacity-100" : "opacity-60"
                                    )}
                                >
                                    <div className={cn(
                                        "px-4 py-1 rounded-full transition-all duration-300 flex items-center justify-center",
                                        isActive ? "bg-[#FDCC4B]/20 text-[#26300D]" : "text-[#5F624F]"
                                    )}>
                                        <item.icon className="w-5 h-5 mx-auto" />
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-bold uppercase tracking-tight text-center block w-full transition-colors",
                                        isActive ? "text-[#26300D]" : "text-[#5F624F]"
                                    )}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#26300D] animate-in fade-in zoom-in duration-300" />
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                </nav>
            </div>
        </div>
    )
}