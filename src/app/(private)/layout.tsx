"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    CalendarRange,
    Settings,
    CalendarDays,
    Tags,
    UserCircle,
    Users,
    Shield,
    ArrowLeft,
    Sparkles,
    Trophy,
    Music,
    Lock,
    BrainCircuit,
    LogOut,
    PartyPopper,
    Brain,
    ChevronDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/login/actions"

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [isPending, startTransition] = useTransition()
    const [eventsOpen, setEventsOpen] = useState(() => !!pathname?.startsWith("/events"))
    const [settingsOpen, setSettingsOpen] = useState(() => !!pathname?.startsWith("/settings"))

    function handleSignOut() {
        startTransition(async () => {
            await signOut()
        })
    }

    const navItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Bookings", href: "/events", icon: CalendarRange },
        { label: "Quiz", href: "/quiz-generator", icon: Brain },
        { label: "Settings", href: "/settings", icon: Settings },
    ]

    const eventSubItems = [
        { label: "Thursday Night Quiz", href: "/events/quiz-bookings", icon: Trophy },
        { label: "Live Music", href: "/events/music-bookings", icon: Music },
        { label: "Private Events", href: "/events/private-bookings", icon: PartyPopper },
    ]

    const settingsSubItems = [
        { label: "Table Setups", href: "/settings/tables", icon: LayoutDashboard },
        { label: "Event Types", href: "/settings/event-types", icon: Tags },
        { label: "Events", href: "/settings/events", icon: CalendarDays },
        { label: "Quiz Rules", href: "/settings/quiz-categories", icon: BrainCircuit },
        { label: "Customers", href: "/settings/customers", icon: UserCircle },
        { label: "Teams", href: "/settings/teams", icon: Users },
        { label: "System Users", href: "/settings/users", icon: Shield },
    ]

    const getPageInfo = () => {
        console.log("Current Pathname:", pathname) // Debugging line
        if (!pathname) return { title: "Venue Manager", subtitle: null, backHref: null }
        
        const normalizedPath = pathname.replace(/\/$/, "")
        if (normalizedPath === "/dashboard") return { title: "Dashboard", subtitle: null, backHref: null }
        if (normalizedPath.startsWith("/quiz-generator")) {
            if (normalizedPath === "/quiz-generator") return { title: "Quiz", subtitle: "AI Generator", backHref: null }
            const quizMap: Record<string, string> = {
                "history": "Question Archive",
            }
            const segment = normalizedPath.split("/")[2]
            const subtitle = quizMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Quiz", subtitle, backHref: "/quiz-generator" }
        }        
        
        if (normalizedPath.startsWith("/events")) {
            if (normalizedPath === "/events") return { title: "Bookings", subtitle: null, backHref: null }
            const eventsMap: Record<string, string> = {
                "music-bookings": "Music",
                "private-bookings": "Private Events",
                "quiz-bookings": "Quiz",
            }
            const segment = normalizedPath.split("/")[2]
            const subtitle = eventsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Bookings", subtitle, backHref: "/events" }
        }
        
        if (normalizedPath.startsWith("/settings")) {
            if (normalizedPath === "/settings") return { title: "Settings", subtitle: null, backHref: null }
            const settingsMap: Record<string, string> = {
                "tables": "Table Setups",
                "events": "Events",
                "event-types": "Event Types",
                "quiz-categories": "Quiz Rules",
                "customers": "Customers",
                "teams": "Teams",
                "users": "System Users",
            }
            const segment = normalizedPath.split("/")[2]
            const subtitle = settingsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Settings", subtitle, backHref: "/settings" }
        }
        
        return { title: "Venue Manager", subtitle: null, backHref: null }
    }

    const { title, subtitle, backHref } = getPageInfo()

    return (
        <div className="flex min-h-screen bg-[#F7F4EA]">
            {/* 1. Sidebar for Tablets/Desktops */}
            <aside className="hidden sm:flex flex-col w-64 bg-white border-r border-[#E6DFC8] sticky top-0 h-screen shrink-0 z-50">
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
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
                    {navItems.map((item) => {
                        const normalizedPathname = pathname?.replace(/\/$/, "") || ""
                        const normalizedHref = item.href.replace(/\/$/, "")
                        const isActive = normalizedPathname === normalizedHref || (item.href !== "/dashboard" && normalizedPathname.startsWith(`${normalizedHref}/`))
                        
                        const isSettings = item.label === "Settings"
                        const isEvents = item.label === "Bookings"

                        const hasSubItems = isEvents || isSettings
                        const isOpen = isEvents ? eventsOpen : isSettings ? settingsOpen : false
                        const toggle = isEvents
                            ? () => setEventsOpen((p) => !p)
                            : isSettings
                            ? () => setSettingsOpen((p) => !p)
                            : undefined

                        return (
                            <React.Fragment key={item.href}>
                                {/* Parent row — button for collapsible items, Link for plain items */}
                                {hasSubItems && toggle ? (
                                    <button
                                        type="button"
                                        onClick={toggle}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-xs uppercase tracking-wider",
                                            isActive
                                                ? "bg-[#26300D] text-white shadow-lg shadow-[#26300D]/10"
                                                : "text-[#5F624F] hover:bg-[#26300D]/5"
                                        )}
                                    >
                                        <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-[#FDCC4B]" : "text-[#5F624F]")} />
                                        <span className="flex-1 text-left">{item.label}</span>
                                        <ChevronDown className={cn(
                                            "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
                                            isOpen ? "rotate-0" : "-rotate-90"
                                        )} />
                                    </button>
                                ) : (
                                    <Link
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
                                )}

                                {/* Sub-items for Events */}
                                {isEvents && eventsOpen && (
                                    <div className="mt-1 space-y-1 ml-4 border-l border-[#E6DFC8] pl-2 pb-2">
                                        {eventSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 font-bold text-[11px] uppercase tracking-wider",
                                                        isSubActive
                                                            ? "text-[#26300D] bg-[#FDCC4B]/20"
                                                            : "text-[#5F624F] hover:text-[#26300D] hover:bg-[#26300D]/5"
                                                    )}
                                                >
                                                    <sub.icon className={cn("w-3.5 h-3.5", isSubActive ? "text-[#26300D]" : "text-[#5F624F]/50")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Sub-items for Settings */}
                                {isSettings && settingsOpen && (
                                    <div className="mt-1 space-y-1 ml-4 border-l border-[#E6DFC8] pl-2 pb-2">
                                        {settingsSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 font-bold text-[11px] uppercase tracking-wider",
                                                        isSubActive
                                                            ? "text-[#26300D] bg-[#FDCC4B]/20"
                                                            : "text-[#5F624F] hover:text-[#26300D] hover:bg-[#26300D]/5"
                                                    )}
                                                >
                                                    <sub.icon className={cn("w-3.5 h-3.5", isSubActive ? "text-[#26300D]" : "text-[#5F624F]/50")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </React.Fragment>
                        )
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-[#E6DFC8] space-y-2">
                    <button
                        onClick={handleSignOut}
                        disabled={isPending}
                        className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-[#5F624F] hover:bg-red-50 hover:text-red-600 transition-all duration-200 font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                        <LogOut className="w-4 h-4" />
                        {isPending ? "Signing out…" : "Sign Out"}
                    </button>
                    <p className="text-[8px] text-[#5F624F] font-bold uppercase tracking-widest opacity-40 px-4">
                        v0.1.0 Alpha
                    </p>
                </div>
            </aside>

            {/* 2. Main Content Wrapper */}
            <div className="flex flex-col flex-1 min-w-0">
                <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-[#E6DFC8] px-4 py-3 sm:px-8">
                    <div className="flex items-center max-w-7xl mx-auto min-h-10 relative">
                        
                        {/* Mobile Back Button */}
                        {backHref && (
                            <Link
                                href={backHref}
                                className="sm:hidden absolute left-0 p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95"
                            >
                                <ArrowLeft className="w-5 h-5 text-[#1F1F1A]" />
                            </Link>
                        )}
                        
                        {/* Title */}
                        <div className="flex flex-col items-center justify-center w-full">
                            <h1 className="text-sm sm:text-base font-black uppercase tracking-widest text-[#1F1F1A] text-center px-8 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                                <span>{title}</span>
                                {subtitle && (
                                    <>
                                        <span className="hidden sm:inline opacity-30">/</span>
                                        <span className="text-[#5F624F] opacity-70 sm:opacity-100">{subtitle}</span>
                                    </>
                                )}
                            </h1>
                        </div>
                    </div>
                </header>

                <main className="flex-1 w-full max-w-7xl mx-auto p-1 sm:p-6 pb-20 sm:pb-8">
                    {children}
                </main>

                {/* 3. Persistent Mobile Bottom Navigation */}
                <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E6DFC8] py-2 sm:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-around items-center w-full max-w-md mx-auto px-6">
                        {navItems.map((item) => {
                            const normalizedPathname = pathname?.replace(/\/$/, "") || ""
                            const normalizedHref = item.href.replace(/\/$/, "")
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
