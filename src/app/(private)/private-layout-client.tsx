"use client"

import React, { useState, useTransition, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    LayoutDashboard,
    Settings,
    ArrowLeft,
    Sparkles,
    Award,
    LogOut,
    Brain,
    ChevronDown,
    ChevronUp,
    Tickets,
    Grid2X2,
    CalendarCogIcon,
    Component,
    Dices,
    BookUser,
    Medal,
    UserCog2,
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
import { cardIcon } from "@/lib/booking-card-icons"
import { swatchHexFromColor } from "@/lib/event-type-colors"

type BookingNavItem = { label: string; href: string; icon?: string | null; color?: string | null };
type SubItem = {
    label: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
    /** When set, render a coloured icon chip (icon in this hue, lighter background). */
    colorHex?: string | null;
    /** When true, render as a non-clickable sub-heading rather than a link. */
    heading?: boolean;
};
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
    guestNav = [],
    requestNav = [],
}: {
    children: React.ReactNode
    employeeName: string
    employeeRole: string
    guestNav?: BookingNavItem[]
    requestNav?: BookingNavItem[]
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

    // Booking links are data-driven from each category's booking_card config, split
    // into two sub-headed groups (guest bookings vs requests & enquiries) and sorted
    // alphabetically upstream in the layout. A heading only shows when its group has items.
    const toSub = (nav: BookingNavItem): SubItem => ({
        label: nav.label,
        href: nav.href,
        icon: cardIcon(nav.icon),
        colorHex: swatchHexFromColor(nav.color ?? undefined) ?? null,
    })
    const bookingsSubItems: SubItem[] = [
        ...(requestNav.length ? [{ heading: true as const, label: "Requests & Enquiries", href: "heading-requests" }, ...requestNav.map(toSub)] : []),
        ...(guestNav.length ? [{ heading: true as const, label: "Guest Bookings", href: "heading-guest" }, ...guestNav.map(toSub)] : []),
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
        <div className="pt-safe-top flex bg-[#F7F4EA] h-screen min-h-screen sm:overflow-hidden">
            {/* 1. Sidebar for Tablets/Desktops */}
            <aside className="hidden top-0 z-50 sticky sm:flex flex-col bg-white border-[#E6DFC8] border-r w-64 h-screen shrink-0">
                {/* Sidebar Brand */}
                <div className="flex items-center gap-3 p-6 border-[#E6DFC8] border-b">
                    <div className="flex justify-center items-center bg-[#5C4033] shadow-sm rounded-xl w-10 h-10 shrink-0">
                        <span className="font-black text-white text-sm">{initials}</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-black text-[#1F1F1A] text-[10px] truncate uppercase tracking-[0.2em]">{displayName}</span>
                        <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-[0.2em]">{employeeRole}</span>
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <nav className="flex-1 space-y-1 p-4 overflow-y-auto no-scrollbar">
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
                                                "flex flex-1 items-center gap-3 px-4 py-3 min-w-0 font-bold text-xs uppercase tracking-wider",
                                                isActive ? "text-white" : "text-[#5F624F]"
                                            )}
                                        >
                                            <group.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "text-[#5F624F]")} />
                                            <span className="text-left truncate">{group.label}</span>
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.label)}
                                            aria-label={isOpen ? `Collapse ${group.label}` : `Expand ${group.label}`}
                                            className="hover:bg-black/5 px-3 py-3 rounded-r-xl transition-colors shrink-0"
                                        >
                                            {isOpen ? <ChevronUp className="w-3.5 h-3.5 transition-transform duration-200" /> : <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />}
                                        </button>
                                    </div>
                                ) : (
                                    <Link
                                        href={group.href!}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300",
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
                                    <div className="space-y-1 mt-1 ml-4 pb-2 pl-2 border-[#E6DFC8] border-l">
                                        {group.subItems!.map((sub) => {
                                            if (sub.heading) {
                                                return (
                                                    <p key={sub.href} className="px-3 pt-3 first:pt-1 pb-0.5 font-black text-[#5F624F]/50 text-[9px] uppercase tracking-widest">
                                                        {sub.label}
                                                    </p>
                                                )
                                            }
                                            const isSubActive = normalizedPathname === sub.href.replace(/\/$/, "")
                                            const Icon = sub.icon
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all duration-200",
                                                        isSubActive
                                                            ? "text-[#5C4033] bg-[#5C4033]/15"
                                                            : "text-[#5F624F] hover:text-[#5C4033] hover:bg-[#5C4033]/5"
                                                    )}
                                                >
                                                    {sub.colorHex ? (
                                                        <span
                                                            style={{ "--cc": sub.colorHex } as React.CSSProperties}
                                                            className="flex items-center justify-center w-5 h-5 bg-(--cc)/15 rounded-md shrink-0"
                                                        >
                                                            {Icon && <Icon className="w-3 h-3 text-(--cc)" />}
                                                        </span>
                                                    ) : (
                                                        Icon && <Icon className={cn("w-3.5 h-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    )}
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
                <div className="space-y-2 p-4 border-[#E6DFC8] border-t">
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isPending}
                        className="flex items-center gap-3 hover:bg-red-50 disabled:opacity-50 px-4 py-2.5 rounded-xl w-full font-bold text-[#5F624F] hover:text-red-600 text-xs uppercase tracking-wider transition-all duration-200"
                    >
                        <LogOut className="w-4 h-4" />
                        {isPending ? "Signing out…" : "Sign Out"}
                    </button>
                    <p className="px-4 font-bold text-[#5F624F]/70 text-[9px] uppercase tracking-widest">
                        v0.1.0 Alpha
                    </p>
                </div>
            </aside>

            {/* 2. Main Content Wrapper */}
            <div className="flex flex-col flex-1 min-w-0 sm:h-screen">
                <header className="top-0 z-40 sticky bg-white backdrop-blur-md px-4 sm:px-8 py-3 border-[#E6DFC8] border-b w-full shrink-0">
                    <div className="relative flex items-center mx-auto max-w-7xl min-h-10">

                        {/* Mobile Back Button */}
                        {backHref && (
                            <button
                                title="Go back"
                                type="button"
                                onClick={() => router.push(backHref)}
                                className="left-0 absolute hover:bg-slate-100 p-2 rounded-full active:scale-95 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-[#1F1F1A]" />
                            </button>
                        )}

                        {/* Title */}
                        <div className="flex flex-col justify-center items-center w-full">
                            <h1 className="flex flex-wrap justify-center items-center gap-1 sm:gap-2 px-8 font-black text-[#1F1F1A] text-sm sm:text-base text-center uppercase tracking-widest">
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

                <main ref={mainRef} className="flex-1 w-full min-h-0 sm:overflow-y-auto">
                    <div className="mx-auto p-1 sm:p-6 pb-20 sm:pb-8 w-full max-w-7xl">
                        {children}
                    </div>
                </main>

                {/* 3. Persistent Mobile Bottom Navigation */}
                <nav className="sm:hidden right-0 bottom-0 left-0 z-50 fixed bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] py-2 border-[#E6DFC8] border-t">
                    <div className="flex justify-around items-center mx-auto px-6 w-full max-w-md">
                        {bottomTabs.map((item) => {
                            const isActive = activeGroup === item.group

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "relative flex flex-col flex-1 items-center gap-1 py-1 outline-none transition-all duration-300",
                                        isActive ? "opacity-100" : "opacity-60"
                                    )}
                                >
                                    <div className={cn(
                                        "flex justify-center items-center px-4 py-1 rounded-full transition-all duration-300",
                                        isActive ? "bg-[#5C4033]/15 text-[#5C4033]" : "text-[#5F624F]"
                                    )}>
                                        <item.icon className="mx-auto w-5 h-5" />
                                    </div>
                                    <span className={cn(
                                        "block w-full font-bold text-[9px] text-center uppercase tracking-tight transition-colors",
                                        isActive ? "text-[#5C4033]" : "text-[#5F624F]"
                                    )}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <div className="-bottom-0.5 left-1/2 absolute bg-[#5C4033] rounded-full w-1 h-1 -translate-x-1/2 animate-in duration-300 fade-in zoom-in" />
                                    )}
                                </Link>
                            )
                        })}

                        {/* "More" tab — opens a sheet with Quiz + Website + Settings + Sign Out */}
                        <button
                            type="button"
                            onClick={() => setMoreOpen(true)}
                            className={cn(
                                "relative flex flex-col flex-1 items-center gap-1 py-1 outline-none transition-all duration-300",
                                moreActive ? "opacity-100" : "opacity-60"
                            )}
                        >
                            <div className={cn(
                                "flex justify-center items-center px-4 py-1 rounded-full transition-all duration-300",
                                moreActive ? "bg-[#5C4033]/15 text-[#5C4033]" : "text-[#5F624F]"
                            )}>
                                <MoreHorizontal className="mx-auto w-5 h-5" />
                            </div>
                            <span className={cn(
                                "block w-full font-bold text-[9px] text-center uppercase tracking-tight transition-colors",
                                moreActive ? "text-[#5C4033]" : "text-[#5F624F]"
                            )}>
                                More
                            </span>
                            {moreActive && (
                                <div className="-bottom-0.5 left-1/2 absolute bg-[#5C4033] rounded-full w-1 h-1 -translate-x-1/2 animate-in duration-300 fade-in zoom-in" />
                            )}
                        </button>
                    </div>
                </nav>

                {/* 4. Mobile "More" Sheet */}
                {moreOpen && (
                    <div className="sm:hidden">
                        <div
                            className="z-50 fixed inset-0 bg-black/40 animate-in duration-200 fade-in"
                            onClick={() => setMoreOpen(false)}
                            aria-hidden="true"
                        />
                        <div className="right-0 bottom-0 slide-in-from-bottom left-0 z-50 fixed bg-white pb-8 border-[#E6DFC8] border-t rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in duration-300">
                            <div className="flex justify-between items-center px-6 pt-4 pb-2">
                                <span className="font-black text-[#1F1F1A] text-[10px] uppercase tracking-widest">More</span>
                                <button
                                    type="button"
                                    onClick={() => setMoreOpen(false)}
                                    aria-label="Close menu"
                                    className="hover:bg-slate-100 -mr-2 p-2 rounded-full active:scale-95 transition-colors"
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
                                    <p className="px-2 pb-1 font-black text-[#5F624F]/70 text-[10px] uppercase tracking-widest">{section.heading}</p>
                                    <div className="space-y-1">
                                        {section.items.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href.replace(/\/$/, "")
                                            const Icon = sub.icon
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    onClick={() => setMoreOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200",
                                                        isSubActive
                                                            ? "text-[#5C4033] bg-[#5C4033]/15"
                                                            : "text-[#5F624F] hover:text-[#5C4033] hover:bg-[#5C4033]/5"
                                                    )}
                                                >
                                                    {Icon && <Icon className={cn("w-5 h-5 shrink-0", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />}
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div className="mt-2 px-4 pt-2 border-[#E6DFC8] border-t">
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    disabled={isPending}
                                    className="flex items-center gap-3 hover:bg-red-50 disabled:opacity-50 px-4 py-3 rounded-xl w-full font-bold text-[#5F624F] hover:text-red-600 text-xs uppercase tracking-wider transition-all duration-200"
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
