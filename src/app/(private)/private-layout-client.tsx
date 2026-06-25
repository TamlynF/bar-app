"use client"

import React, { useState, useTransition, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
    Award,
    Music,
    Lock,
    BrainCircuit,
    LogOut,
    PartyPopper,
    Brain,
    ChevronDown,
    ChevronUp,
    Tickets,
    Grid2X2,
    Grid2X2X,
    CalendarCog,
    CalendarCogIcon,
    Component,
    Dices,
    BookUser,
    Medal,
    UserCog,
    UserCog2,
    Speaker,
    Building2,
    UtensilsCrossed,
    Image as ImageIcon,
    Camera,
    Globe,
    MoreHorizontal,
    Shapes,
    X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/login/actions"

type BookingNavItem = { label: string; href: string };
type SubItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = {
    label: string
    href: string | null
    icon: React.ComponentType<{ className?: string }>
    subItems: SubItem[] | null
};

export default function PrivateLayoutClient({
    children,
    employeeName,
    employeeRole,
    bookingNav = [],
}: {
    children: React.ReactNode
    employeeName: string
    employeeRole: string
    bookingNav?: BookingNavItem[]
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const searchParams = useSearchParams()

    const normalizedPathname = pathname?.replace(/\/$/, "") || ""

    const initials = employeeName
        ? employeeName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
        : "DF"
    const displayName = employeeName || "Venue Manager"

    function handleSignOut() {
        startTransition(async () => {
            await signOut()
        })
    }

    // Sub-items grouped by top-level destination.
    const bookingsSubItems: SubItem[] = [
        { label: "Music Bingo", href: "/event-bookings/bingo-bookings", icon: Speaker },
        { label: "Live Music", href: "/event-bookings/music-bookings", icon: Music },
        { label: "Thursday Quiz", href: "/event-bookings/quiz-bookings", icon: Trophy },
        { label: "Private Events", href: "/event-bookings/private-bookings", icon: PartyPopper },
        ...bookingNav.map(nav => ({
            label: nav.label,
            href: nav.href,
            icon: CalendarDays,
        })),
    ]

    // Quiz content: archive + leaderboards (+ generator, which is reached from an event).
    const quizSubItems: SubItem[] = [
        { label: "Quiz History", href: "/event-setups/quiz-history", icon: Grid2X2 },
        { label: "Leaderboards", href: "/event-setups/quiz-leaderboards", icon: Award },
        // { label: "Quiz Generator", href: "/event-setups/quiz-generator", icon: Brain },
    ]

    // Public-facing content — everything that renders on the marketing site.
    const websiteSubItems: SubItem[] = [
        { label: "Menu", href: "/settings/menu", icon: UtensilsCrossed },
        { label: "Specials", href: "/settings/specials", icon: Sparkles },
        { label: "Promo Content", href: "/settings/promo-content", icon: ImageIcon },
        { label: "Gallery", href: "/settings/gallery", icon: Camera },
    ]

    // True configuration + admin. Event Categories + Quiz Rules are setup, so they live here —
    // their routes stay under /event-setups, but they belong to Settings in the nav.
    const settingsSubItems: SubItem[] = [
        { label: "Company Info", href: "/settings/company", icon: Building2 },
        { label: "Guests", href: "/settings/customers", icon: BookUser },
        { label: "Teams", href: "/settings/teams", icon: Medal },
        { label: "Floor Plan", href: "/settings/tables", icon: Grid2X2 },
        { label: "Venue Layout", href: "/settings/venue", icon: Shapes },
        { label: "Event Categories", href: "/event-setups/event-types", icon: Component },
        { label: "Quiz Rules", href: "/event-setups/quiz-categories", icon: Dices },
        { label: "System Users", href: "/settings/users", icon: UserCog2 },
    ]

    const websiteHref = "/settings/website"
    const websiteHrefs = [websiteHref, ...websiteSubItems.map((s) => s.href)]
    const isWebsitePath = (p: string) => websiteHrefs.includes(p)

    // The /event-setups subtree is split across three nav groups, and Website overlaps the
    // /settings prefix — so a path's owning group is resolved here, in one place.
    function groupForPath(p: string): string | null {
        if (p === "/dashboard" || p.startsWith("/dashboard/")) return "Dashboard"
        if (p === "/event-bookings" || p.startsWith("/event-bookings/")) return "Bookings"
        if (isWebsitePath(p)) return "Website"
        if (p.startsWith("/event-setups/quiz-history") || p.startsWith("/event-setups/quiz-generator") || p.startsWith("/event-setups/quiz-leaderboards")) return "Quiz"
        if (p.startsWith("/event-setups/event-types") || p.startsWith("/event-setups/quiz-categories")) return "Settings"
        if (p === "/event-setups" || p.startsWith("/event-setups/")) return "Schedule"
        if (p === "/settings" || p.startsWith("/settings/")) return "Settings"
        return null
    }
    const activeGroup = groupForPath(normalizedPathname)

    const navGroups: NavGroup[] = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, subItems: null },
        { label: "Bookings", href: "/event-bookings", icon: Tickets, subItems: bookingsSubItems },
        { label: "Schedule", href: "/event-setups/events", icon: CalendarCogIcon, subItems: null },
        { label: "Quiz", href: "/event-setups/quiz-history", icon: Brain, subItems: quizSubItems },
        { label: "Website", href: websiteHref, icon: Globe, subItems: websiteSubItems },
        { label: "Settings", href: "/settings", icon: Settings, subItems: settingsSubItems },
    ]

    const isGroupActive = (group: NavGroup) => activeGroup === group.label

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
        Bookings: activeGroup === "Bookings",
        Quiz: activeGroup === "Quiz",
        Website: activeGroup === "Website",
        Settings: activeGroup === "Settings",
    }))
    const toggleGroup = (label: string) =>
        setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))

    const [moreOpen, setMoreOpen] = useState(false)
    const moreActive = activeGroup === "Quiz" || activeGroup === "Website" || activeGroup === "Settings"

    // Primary mobile tabs (Quiz / Website / Settings live behind "More").
    const bottomTabs = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Dashboard" },
        { label: "Bookings", href: "/event-bookings", icon: Tickets, group: "Bookings" },
        { label: "Schedule", href: "/event-setups/events", icon: CalendarCogIcon, group: "Schedule" },
    ]

    const getPageInfo = () => {
        if (!pathname) return { title: "Venue Manager", subtitle: null, backHref: null }

        const normalizedPath = pathname.replace(/\/$/, "")
        if (normalizedPath === "/dashboard") return { title: "Dashboard", subtitle: null, backHref: null }
        if (normalizedPath.startsWith("/event-setups")) {
            const segment = normalizedPath.split("/")[2]

            // Event Categories + Quiz Rules now live under Settings.
            if (segment === "event-types") return { title: "Settings", subtitle: "Event Categories", backHref: "/settings" }
            if (segment === "quiz-categories") return { title: "Settings", subtitle: "Quiz Rules", backHref: "/settings" }

            // Quiz section: archive + leaderboards + generator.
            if (segment === "quiz-history") return { title: "Quiz", subtitle: null, backHref: null }
            if (segment === "quiz-leaderboards") return { title: "Quiz", subtitle: "Leaderboards", backHref: null }
            if (segment === "quiz-generator") {
                // Reached from a specific event — back goes to that event's quiz page.
                const eventId = searchParams.get("event_id")
                const category = searchParams.get("category")
                if (eventId) {
                    const categoryParam = category ? `?category=${encodeURIComponent(category)}` : ''
                    return { title: "Quiz", subtitle: "Quiz Generator", backHref: `/event-setups/events/${eventId}${categoryParam}` }
                }
                return { title: "Quiz", subtitle: "Quiz Generator", backHref: "/event-setups/quiz-history" }
            }

            // Schedule: event list (landing) + event detail.
            if (segment === "events") {
                const eventId = normalizedPath.split("/")[3]
                if (eventId) {
                    return { title: "Schedule", subtitle: "Quiz Questions", backHref: `/event-setups/events?open=${eventId}` }
                }
                return { title: "Schedule", subtitle: null, backHref: null }
            }

            // /event-setups index (no longer linked from the nav) or anything else.
            return { title: "Schedule", subtitle: null, backHref: null }
        }

        if (normalizedPath.startsWith("/event-bookings")) {
            if (normalizedPath === "/event-bookings") return { title: "Bookings", subtitle: null, backHref: null }
            const eventsMap: Record<string, string> = {
                "music-bookings": "Music",
                "private-bookings": "Private Events",
                "quiz-bookings": "Quiz",
                "bingo-bookings": "Bingo",
            }
            const segment = normalizedPath.split("/")[2]
            const subtitle = eventsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            // A `from` param (e.g. set by the Schedule "View All" link) overrides the
            // default hub target so Back returns to the originating page/sheet.
            const from = searchParams.get("from")
            return { title: "Bookings", subtitle, backHref: from || "/event-bookings" }
        }

        if (normalizedPath.startsWith("/settings")) {
            if (normalizedPath === "/settings") return { title: "Settings", subtitle: null, backHref: null }
            const segment = normalizedPath.split("/")[2]

            // Website hub + content pages render under "Website", not "Settings".
            if (segment === "website") return { title: "Website", subtitle: null, backHref: null }
            const websiteMap: Record<string, string> = {
                "menu": "Menu",
                "specials": "Specials",
                "promo-content": "Promo Content",
                "gallery": "Gallery",
            }
            if (websiteMap[segment]) {
                return { title: "Website", subtitle: websiteMap[segment], backHref: "/settings/website" }
            }

            // The per-event floor plan calculator is reached from the Schedule, so its
            // back link returns there rather than to the Settings hub.
            if (segment === "floor-plan") {
                return { title: "Settings", subtitle: "Floor Plan Calculator", backHref: "/event-setups/events" }
            }

            const settingsMap: Record<string, string> = {
                "tables": "Floor Plan",
                "venue": "Venue Layout",
                "customers": "Guests",
                "teams": "Teams",
                "users": "System Users",
                "company": "Company Info",
            }
            const subtitle = settingsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Settings", subtitle, backHref: "/settings" }
        }

        return { title: "Venue Manager", subtitle: null, backHref: null }
    }

    const { title, subtitle, backHref } = getPageInfo()

    // On desktop the shell is a fixed full-height frame and only <main> scrolls,
    // so the sidebar + top nav stay put. Reset that scroll on navigation since
    // the window itself no longer scrolls.
    const mainRef = useRef<HTMLElement>(null)
    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0 })
    }, [pathname])

    return (
        <div className="flex min-h-screen sm:h-screen sm:overflow-hidden bg-[#F7F4EA] pt-safe-top">
            {/* 1. Sidebar for Tablets/Desktops */}
            <aside className="hidden sm:flex flex-col w-64 bg-white border-r border-[#E6DFC8] sticky top-0 h-screen shrink-0 z-50">
                {/* Sidebar Brand */}
                <div className="p-6 border-b border-[#E6DFC8] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#5C4033] flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-white font-black text-sm">{initials}</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1F1F1A] truncate">{displayName}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F]">{employeeRole}</span>
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
                    {navGroups.map((group) => {
                        const isActive = isGroupActive(group)
                        const hasSubItems = !!group.subItems
                        const isOpen = hasSubItems ? !!openGroups[group.label] : false

                        return (
                            <React.Fragment key={group.label}>
                                {/* Parent row — Link (navigate) + chevron (toggle) for collapsible items, plain Link otherwise */}
                                {hasSubItems ? (
                                    <div
                                        className={cn(
                                            "flex items-center rounded-xl transition-all duration-300",
                                            isActive
                                                ? "bg-[#5C4033] text-white shadow-lg shadow-[#5C4033]/10"
                                                : "text-[#5F624F] hover:bg-[#5C4033]/5"
                                        )}
                                    >
                                        <Link
                                            href={group.href!}
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-3 flex-1 min-w-0 font-bold text-xs uppercase tracking-wider",
                                                isActive ? "text-white" : "text-[#5F624F]"
                                            )}
                                        >
                                            <group.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "text-[#5F624F]")} />
                                            <span className="truncate text-left">{group.label}</span>
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.label)}
                                            aria-label={isOpen ? `Collapse ${group.label}` : `Expand ${group.label}`}
                                            className="px-3 py-3 shrink-0 rounded-r-xl hover:bg-black/5 transition-colors"
                                        >
                                            {isOpen ? <ChevronUp className="w-3.5 h-3.5 transition-transform duration-200" /> : <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />}
                                        </button>
                                    </div>
                                ) : (
                                    <Link
                                        href={group.href!}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-xs uppercase tracking-wider",
                                            isActive
                                                ? "bg-[#5C4033] text-white shadow-lg shadow-[#5C4033]/10"
                                                : "text-[#5F624F] hover:bg-[#5C4033]/5"
                                        )}
                                    >
                                        <group.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-[#5F624F]")} />
                                        {group.label}
                                    </Link>
                                )}

                                {/* Collapsible sub-items */}
                                {hasSubItems && isOpen && (
                                    <div className="mt-1 space-y-1 ml-4 border-l border-[#E6DFC8] pl-2 pb-2">
                                        {group.subItems!.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href.replace(/\/$/, "")
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 font-bold text-[11px] uppercase tracking-wider",
                                                        isSubActive
                                                            ? "text-[#5C4033] bg-[#5C4033]/15"
                                                            : "text-[#5F624F] hover:text-[#5C4033] hover:bg-[#5C4033]/5"
                                                    )}
                                                >
                                                    <sub.icon className={cn("w-3.5 h-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
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
                        type="button"
                        onClick={handleSignOut}
                        disabled={isPending}
                        className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-[#5F624F] hover:bg-red-50 hover:text-red-600 transition-all duration-200 font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                        <LogOut className="w-4 h-4" />
                        {isPending ? "Signing out…" : "Sign Out"}
                    </button>
                    <p className="text-[9px] text-[#5F624F]/70 font-bold uppercase tracking-widest px-4">
                        v0.1.0 Alpha
                    </p>
                </div>
            </aside>

            {/* 2. Main Content Wrapper */}
            <div className="flex flex-col flex-1 min-w-0 sm:h-screen">
                <header className="sticky top-0 z-40 shrink-0 w-full bg-white backdrop-blur-md border-b border-[#E6DFC8] px-4 py-3 sm:px-8">
                    <div className="flex items-center max-w-7xl mx-auto min-h-10 relative">

                        {/* Mobile Back Button */}
                        {backHref && (
                            <button
                                title="Go back"
                                type="button"
                                onClick={() => router.push(backHref)}
                                className="absolute left-0 p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95"
                            >
                                <ArrowLeft className="w-5 h-5 text-[#1F1F1A]" />
                            </button>
                        )}

                        {/* Title */}
                        <div className="flex flex-col items-center justify-center w-full">
                            <h1 className="text-sm sm:text-base font-black uppercase tracking-widest text-[#1F1F1A] text-center px-8 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                                <span className={cn(subtitle && backHref ? "hidden sm:inline" : "")}>{title}</span>
                                {subtitle && (
                                    <>
                                        <span className="hidden sm:inline opacity-30">/</span>
                                        <span className={cn(subtitle && backHref ? "" : "text-[#5F624F] opacity-70 sm:opacity-100")}>{subtitle}</span>
                                    </>
                                )}
                            </h1>
                        </div>
                    </div>
                </header>

                <main ref={mainRef} className="flex-1 w-full sm:overflow-y-auto sm:min-h-0">
                    <div className="w-full max-w-7xl mx-auto p-1 sm:p-6 pb-20 sm:pb-8">
                        {children}
                    </div>
                </main>

                {/* 3. Persistent Mobile Bottom Navigation */}
                <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E6DFC8] py-2 sm:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-around items-center w-full max-w-md mx-auto px-6">
                        {bottomTabs.map((item) => {
                            const isActive = activeGroup === item.group

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
                                        isActive ? "bg-[#5C4033]/15 text-[#5C4033]" : "text-[#5F624F]"
                                    )}>
                                        <item.icon className="w-5 h-5 mx-auto" />
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-bold uppercase tracking-tight text-center block w-full transition-colors",
                                        isActive ? "text-[#5C4033]" : "text-[#5F624F]"
                                    )}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5C4033] animate-in fade-in zoom-in duration-300" />
                                    )}
                                </Link>
                            )
                        })}

                        {/* "More" tab — opens a sheet with Quiz + Website + Settings + Sign Out */}
                        <button
                            type="button"
                            onClick={() => setMoreOpen(true)}
                            className={cn(
                                "flex flex-col items-center gap-1 transition-all duration-300 outline-none relative py-1 flex-1",
                                moreActive ? "opacity-100" : "opacity-60"
                            )}
                        >
                            <div className={cn(
                                "px-4 py-1 rounded-full transition-all duration-300 flex items-center justify-center",
                                moreActive ? "bg-[#5C4033]/15 text-[#5C4033]" : "text-[#5F624F]"
                            )}>
                                <MoreHorizontal className="w-5 h-5 mx-auto" />
                            </div>
                            <span className={cn(
                                "text-[9px] font-bold uppercase tracking-tight text-center block w-full transition-colors",
                                moreActive ? "text-[#5C4033]" : "text-[#5F624F]"
                            )}>
                                More
                            </span>
                            {moreActive && (
                                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5C4033] animate-in fade-in zoom-in duration-300" />
                            )}
                        </button>
                    </div>
                </nav>

                {/* 4. Mobile "More" Sheet */}
                {moreOpen && (
                    <div className="sm:hidden">
                        <div
                            className="fixed inset-0 z-50 bg-black/40 animate-in fade-in duration-200"
                            onClick={() => setMoreOpen(false)}
                            aria-hidden="true"
                        />
                        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl border-t border-[#E6DFC8] max-h-[85vh] overflow-y-auto pb-8 animate-in slide-in-from-bottom duration-300">
                            <div className="flex items-center justify-between px-6 pt-4 pb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#1F1F1A]">More</span>
                                <button
                                    type="button"
                                    onClick={() => setMoreOpen(false)}
                                    aria-label="Close menu"
                                    className="p-2 -mr-2 rounded-full hover:bg-slate-100 transition-colors active:scale-95"
                                >
                                    <X className="w-5 h-5 text-[#1F1F1A]" />
                                </button>
                            </div>

                            {[
                                { heading: "Quiz", items: quizSubItems },
                                { heading: "Website", items: websiteSubItems },
                                { heading: "Settings", items: settingsSubItems },
                            ].map((section) => (
                                <div key={section.heading} className="px-4 pt-2 pb-1">
                                    <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-widest text-[#5F624F]/70">{section.heading}</p>
                                    <div className="space-y-1">
                                        {section.items.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href.replace(/\/$/, "")
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    onClick={() => setMoreOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-xs uppercase tracking-wider",
                                                        isSubActive
                                                            ? "text-[#5C4033] bg-[#5C4033]/15"
                                                            : "text-[#5F624F] hover:text-[#5C4033] hover:bg-[#5C4033]/5"
                                                    )}
                                                >
                                                    <sub.icon className={cn("w-5 h-5 shrink-0", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div className="px-4 pt-2 mt-2 border-t border-[#E6DFC8]">
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    disabled={isPending}
                                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#5F624F] hover:bg-red-50 hover:text-red-600 transition-all duration-200 font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                                >
                                    <LogOut className="w-5 h-5" />
                                    {isPending ? "Signing out…" : "Sign Out"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
