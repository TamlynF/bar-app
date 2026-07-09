"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    LayoutDashboard,
    Settings,
    CalendarDays,
    ArrowLeft,
    Sparkles,
    LogOut,
    TrendingUp,
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
    Crown,
    Inbox,
    Guitar,
    PartyPopper,
    MessageSquare,
    PanelLeftClose,
    PanelLeftOpen
} from "lucide-react"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/login/actions"
import { cardIcon } from "@/lib/booking-card-icons"
import { swatchHexFromColor } from "@/lib/event-type-colors"

type BookingNavItem = { label: string; href: string; icon?: string | null; color?: string | null; count?: number };
type SubItem = {
    label: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
    /** When set, render a coloured icon chip (icon in this hue, lighter background). */
    colorHex?: string | null;
    /** When > 0, render an amber count pill on the right (e.g. pending enquiries). */
    count?: number;
};

// Routes that belong to the Quiz group, regardless of URL prefix.
const QUIZ_PATHS = [
    "/event-setups/quiz-history",
    "/event-setups/quiz-categories",
    "/event-setups/quiz-generator",
    "/event-setups/quiz-leaderboards",
    "/settings/teams",
]

// Routes that belong to the Requests group. Band applications and private
// hire keep their existing /event-bookings routes but are claimed by
// Requests, not Bookings.
const REQUEST_PATHS = [
    "/requests",
    "/event-bookings/music-bookings",
    "/event-bookings/private-bookings",
]

function isQuizPath(path: string): boolean {
    return QUIZ_PATHS.some((q) => path === q || path.startsWith(`${q}/`))
}

export default function PrivateLayoutClient({
    children,
    employeeName,
    guestNav = [],
    pendingRequestsCount = 0,
    pendingBandCount = 0,
    pendingHireCount = 0,
    pendingEnquiriesCount = 0,
}: {
    children: React.ReactNode
    employeeName: string
    employeeRole: string
    guestNav?: BookingNavItem[]
    pendingRequestsCount?: number
    pendingBandCount?: number
    pendingHireCount?: number
    pendingEnquiriesCount?: number
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const searchParams = useSearchParams()

    // Requests own /requests and the band/private review pages (REQUEST_PATHS),
    // so those never light up Bookings.
    const isRequestPath = (path: string): boolean =>
        REQUEST_PATHS.some((q) => path === q || path.startsWith(`${q}/`))

    // Desktop sidebar collapse (icon-only rail). Survives SPA navigation.
    const [collapsed, setCollapsed] = useState(false)

    const [eventsOpen, setEventsOpen] = useState(() => !!pathname && pathname.startsWith("/event-bookings") && !isRequestPath(pathname))
    const [requestsOpen, setRequestsOpen] = useState(() => !!pathname && isRequestPath(pathname))
    const [eventsNavOpen, setEventsNavOpen] = useState(() => !!pathname && (pathname.startsWith("/event-setups") || isQuizPath(pathname)))
    const [quizOpen, setQuizOpen] = useState(() => !!pathname && isQuizPath(pathname))
    const [settingsOpen, setSettingsOpen] = useState(() => !!pathname && pathname.startsWith("/settings") && !isQuizPath(pathname))

    const initials = employeeName
        ? employeeName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
        : "DF"

    function handleSignOut() {
        startTransition(async () => {
            await signOut()
        })
    }

    const badgeText = pendingRequestsCount > 99 ? "99+" : String(pendingRequestsCount)

    // Mobile bottom nav — thumb-reach destinations. Quiz lives under Events;
    // Market Trends links straight to the marketing insights page.
    const navItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Bookings", href: "/event-bookings", icon: Tickets },
        { label: "Requests", href: "/requests", icon: Inbox },
        { label: "Events", href: "/event-setups", icon: CalendarCogIcon },
        { label: "Trends", href: "/marketing/trends", icon: TrendingUp },
        { label: "Settings", href: "/settings", icon: Settings },
    ]

    // Desktop sidebar. Quiz pages now live under the Events group; Market
    // Trends is a plain link to the marketing insights page.
    const sidebarItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Bookings", href: "/event-bookings", icon: Tickets },
        { label: "Requests", href: "/requests", icon: Inbox },
        { label: "Events", href: "/event-setups", icon: CalendarCogIcon },
        { label: "Market Trends", href: "/marketing/trends", icon: TrendingUp },
        { label: "Settings", href: "/settings", icon: Settings },
    ]

    // Booking links are data-driven from each category's booking_card config
    // (grouped + partitioned upstream in the layout), rendered with a coloured
    // icon chip. Guest bookings and requests keep their own nav groups; the
    // standalone Enquiries page is appended to Requests.
    const toSub = (nav: BookingNavItem): SubItem => ({
        label: nav.label,
        href: nav.href,
        icon: cardIcon(nav.icon),
        colorHex: swatchHexFromColor(nav.color ?? undefined) ?? null,
        count: nav.count,
    })

    const eventSubItems: SubItem[] = guestNav.map(toSub)

    // Requests are fixed review queues (not event-derived), so they're always
    // shown with their own pending-count pill and coloured icon chip.
    const requestSubItems: SubItem[] = [
        { label: "Band Applications", href: "/event-bookings/music-bookings", icon: Guitar, colorHex: "#7C3AED", count: pendingBandCount },
        { label: "Private Hire", href: "/event-bookings/private-bookings", icon: PartyPopper, colorHex: "#0EA5E9", count: pendingHireCount },
        { label: "Enquiries", href: "/requests/enquiries", icon: MessageSquare, colorHex: "#DC2626", count: pendingEnquiriesCount },
    ]

    const eventsNavSubItems = [
        { label: "Event List", href: "/event-setups/events", icon: CalendarDays },
        { label: "Event Categories", href: "/event-setups/event-types", icon: Component },
    ]

    // Nested Quiz sub-group, rendered inside the Events group.
    const quizSubItems = [
        { label: "Quiz History", href: "/event-setups/quiz-history", icon: Grid2X2 },
        { label: "Quiz Rules", href: "/event-setups/quiz-categories", icon: Dices },
        { label: "Leaderboard", href: "/event-setups/quiz-leaderboards", icon: Crown },
        { label: "Teams", href: "/settings/teams", icon: Medal },
    ]

    const settingsSubItems = [
        { label: "Company Info", href: "/settings/company", icon: Building2 },
        { label: "Guests", href: "/settings/customers", icon: BookUser },
        { label: "Seating Plan", href: "/settings/tables", icon: Grid2X2 },
        { label: "Menu", href: "/settings/menu", icon: UtensilsCrossed },
        { label: "Specials", href: "/settings/specials", icon: Sparkles },
        { label: "Promo Content", href: "/settings/promo-content", icon: ImageIcon },
        { label: "Gallery", href: "/settings/gallery", icon: Camera },
        { label: "System Users", href: "/settings/users", icon: UserCog2 },
    ]

    const getPageInfo = () => {
        if (!pathname) return { title: "Venue Manager", subtitle: null, backHref: null }

        const normalizedPath = pathname.replace(/\/$/, "")
        if (normalizedPath === "/dashboard") return { title: "Dashboard", subtitle: null, backHref: null }

        if (normalizedPath.startsWith("/requests")) {
            if (normalizedPath === "/requests") return { title: "Requests", subtitle: null, backHref: null }
            const requestsMap: Record<string, string> = {
                "enquiries": "Enquiries",
            }
            const segment = normalizedPath.split("/")[2]
            const subtitle = requestsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Requests", subtitle, backHref: "/requests" }
        }

        if (normalizedPath.startsWith("/event-setups")) {
            if (normalizedPath === "/event-setups") return { title: "Events", subtitle: null, backHref: null }

            const segment = normalizedPath.split("/")[2]

            // Quiz-group pages get the Quiz title even though they live under
            // the /event-setups URL prefix.
            const quizMap: Record<string, string> = {
                "quiz-history": "Quiz History",
                "quiz-categories": "Quiz Rules",
                "leaderboard": "Leaderboard",
            }
            if (quizMap[segment]) {
                return { title: "Quiz", subtitle: quizMap[segment], backHref: "/event-setups" }
            }

            // When on quiz generator with event_id, back button goes to event quiz page
            if (segment === "quiz-generator") {
                const eventId = searchParams.get("event_id")
                const category = searchParams.get("category")
                if (eventId) {
                    const categoryParam = category ? `?category=${encodeURIComponent(category)}` : ''
                    return { title: "Quiz", subtitle: "Quiz Generator", backHref: `/event-setups/events/${eventId}${categoryParam}` }
                }
                return { title: "Quiz", subtitle: "Quiz Generator", backHref: "/event-setups" }
            }

            const eventSetupsMap: Record<string, string> = {
                "events": "Event List",
                "event-types": "Event Categories",
            }
            const subtitle = eventSetupsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")

            // When on event detail page /event-setups/events/{id}, back goes to events list with sheet open
            if (segment === "events") {
                const eventId = normalizedPath.split("/")[3]
                if (eventId) {
                    return { title: "Events", subtitle: "Quiz Questions", backHref: `/event-setups/events?open=${eventId}` }
                }
            }

            return { title: "Events", subtitle, backHref: "/event-setups" }
        }

        if (normalizedPath.startsWith("/event-bookings")) {
            if (normalizedPath === "/event-bookings") return { title: "Bookings", subtitle: null, backHref: null }

            const segment = normalizedPath.split("/")[2]

            // Band applications, private hire and other Requests sub-links live
            // under /event-bookings but belong to Requests — show the Requests
            // nav label (e.g. "Band Applications"), not the "General" segment.
            const matchedRequest = requestSubItems.find(
                (s) => normalizedPath === s.href || normalizedPath.startsWith(`${s.href}/`)
            )
            if (matchedRequest) {
                return { title: "Requests", subtitle: matchedRequest.label, backHref: "/requests" }
            }

            // Legacy band/private routes.
            if (segment === "music-bookings") {
                return { title: "Requests", subtitle: "Band Applications", backHref: "/requests" }
            }
            if (segment === "private-bookings") {
                return { title: "Requests", subtitle: "Private Hire", backHref: "/requests" }
            }

            const eventsMap: Record<string, string> = {
                "quiz-bookings": "Quiz",
                "bingo-bookings": "Bingo",
            }
            // Prefer the label of the matching Bookings nav button (e.g.
            // "Music Bingo") over the raw URL segment ("General").
            const matchedNav = eventSubItems.find(
                (s) => normalizedPath === s.href || normalizedPath.startsWith(`${s.href}/`)
            )
            const subtitle = matchedNav?.label || eventsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Bookings", subtitle, backHref: "/event-bookings" }
        }

        if (normalizedPath.startsWith("/settings")) {
            if (normalizedPath === "/settings") return { title: "Settings", subtitle: null, backHref: null }

            const segment = normalizedPath.split("/")[2]

            // Teams belongs to the Quiz group but keeps its /settings route.
            if (segment === "teams") {
                return { title: "Quiz", subtitle: "Teams", backHref: "/settings" }
            }

            const settingsMap: Record<string, string> = {
                "tables": "Floor Plan",
                "customers": "Guests",
                "users": "System Users",
            }
            const subtitle = settingsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Settings", subtitle, backHref: "/settings" }
        }

        return { title: "Venue Manager", subtitle: null, backHref: null }
    }

    const { title, subtitle, backHref } = getPageInfo()

    return (
        <div className="pt-safe-top flex h-screen min-h-screen bg-[#F7F4EA] sm:overflow-hidden">
            {/* 1. Sidebar for Tablets/Desktops */}
            <aside className={cn(
                "sticky top-0 z-50 hidden h-screen shrink-0 flex-col border-r border-[#E6DFC8] bg-white transition-[width] duration-300 sm:flex",
                collapsed ? "w-16" : "w-72"
            )}>
                {/* Sidebar Brand + collapse toggle */}
                <div className={cn(
                    "flex min-h-10 items-center gap-3 border-b border-[#E6DFC8] px-3 py-3",
                    collapsed ? "justify-center" : "justify-between px-6"
                )}>
                    {!collapsed && (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5C4033] shadow-sm">
                            <span className="font-black text-sm text-white">{initials}</span>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setCollapsed((c) => !c)}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5F624F] hover:bg-[#5C4033]/5"
                    >
                        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                    </button>
                </div>

                {/* Sidebar Navigation */}
                <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto p-4">
                    {sidebarItems.map((item) => {
                        const normalizedPathname = pathname?.replace(/\/$/, "") || ""
                        const normalizedHref = item.href.replace(/\/$/, "")
                        const onQuizPath = isQuizPath(normalizedPathname)
                        const onRequestPath = isRequestPath(normalizedPathname)

                        const isSettings = item.label === "Settings"
                        const isEvents = item.label === "Bookings"
                        const isRequests = item.label === "Requests"
                        const isEventsNav = item.label === "Events"

                        // Requests claims its own paths; Bookings and Settings
                        // exclude Requests/Quiz so two parents never light up at
                        // once. Quiz pages now live under the Events group, so
                        // Events lights up on them too.
                        const isActive = isRequests
                            ? onRequestPath
                            : isEvents
                            ? (normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)) && !onRequestPath
                            : isEventsNav
                            ? (normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)) || onQuizPath
                            : isSettings
                            ? (normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)) && !onQuizPath
                            : normalizedPathname === normalizedHref || (item.href !== "/dashboard" && normalizedPathname.startsWith(`${normalizedHref}/`))

                        const hasSubItems = isEvents || isRequests || isSettings || isEventsNav
                        const isOpen = isEvents ? eventsOpen : isRequests ? requestsOpen : isSettings ? settingsOpen : isEventsNav ? eventsNavOpen : false
                        const toggle = isEvents
                            ? () => setEventsOpen((p) => !p)
                            : isRequests
                            ? () => setRequestsOpen((p) => !p)
                            : isSettings
                            ? () => setSettingsOpen((p) => !p)
                            : isEventsNav
                            ? () => setEventsNavOpen((p) => !p)
                            : undefined
                        // Collapsed rail: clicking a group expands the sidebar and opens it.
                        const openGroup = isEvents
                            ? () => setEventsOpen(true)
                            : isRequests
                            ? () => setRequestsOpen(true)
                            : isSettings
                            ? () => setSettingsOpen(true)
                            : isEventsNav
                            ? () => setEventsNavOpen(true)
                            : undefined

                        return (
                            <React.Fragment key={item.href}>
                                {/* Parent row — button for collapsible items, Link for plain items */}
                                {hasSubItems && toggle ? (
                                    <button
                                        type="button"
                                        onClick={collapsed ? () => { setCollapsed(false); openGroup?.() } : toggle}
                                        title={collapsed ? item.label : undefined}
                                        className={cn(
                                            "relative flex w-full items-center gap-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300",
                                            collapsed ? "justify-center px-0 py-3" : "px-4 py-3",
                                            isActive
                                                ? "bg-[#5C4033] text-white shadow-lg shadow-[#5C4033]/10"
                                                : "text-[#5F624F] hover:bg-[#5C4033]/5"
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-[#5F624F]")} />

                                        {/* Collapsed: amber dot when requests are pending */}
                                        {collapsed && isRequests && pendingRequestsCount > 0 && (
                                            <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                                        )}

                                        {!collapsed && (
                                            <>
                                                <span className="flex-1 text-left">{item.label}</span>

                                                {/* Green dot — confirmed capacity */}
                                                {isEvents && (
                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" aria-hidden="true" />
                                                )}

                                                {/* Amber count — pending requests */}
                                                {isRequests && pendingRequestsCount > 0 && (
                                                    <span className={cn(
                                                        "flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1 font-black text-[9px] tabular-nums",
                                                        isActive ? "bg-amber-400 text-[#1F1F1A]" : "bg-amber-500 text-white"
                                                    )}>
                                                        {badgeText}
                                                    </span>
                                                )}

                                                {isOpen ? <ChevronUp className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />}
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <Link
                                        href={item.href}
                                        title={collapsed ? item.label : undefined}
                                        className={cn(
                                            "flex items-center gap-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300",
                                            collapsed ? "justify-center px-0 py-3" : "px-4 py-3",
                                            isActive
                                                ? "bg-[#5C4033] text-white shadow-lg shadow-[#5C4033]/10"
                                                : "text-[#5F624F] hover:bg-[#5C4033]/5"
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-[#5F624F]")} />
                                        {!collapsed && item.label}
                                    </Link>
                                )}

                                {/* Sub-items for Bookings */}
                                {isEvents && eventsOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-[#E6DFC8] pb-2 pl-2">
                                        {eventSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href.replace(/\/$/, "")
                                            const Icon = sub.icon
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200",
                                                        isSubActive
                                                            ? "bg-[#5C4033]/15 text-[#5C4033]"
                                                            : "text-[#5F624F] hover:bg-[#5C4033]/5 hover:text-[#5C4033]"
                                                    )}
                                                >
                                                    {sub.colorHex ? (
                                                        <span
                                                            style={{ "--cc": sub.colorHex } as React.CSSProperties}
                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-(--cc)/15"
                                                        >
                                                            {Icon && <Icon className="h-3 w-3 text-(--cc)" />}
                                                        </span>
                                                    ) : (
                                                        Icon && <Icon className={cn("h-3.5 w-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    )}
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Sub-items for Requests */}
                                {isRequests && requestsOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-[#E6DFC8] pb-2 pl-2">
                                        {requestSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href || normalizedPathname.startsWith(`${sub.href}/`)
                                            const Icon = sub.icon
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200",
                                                        isSubActive
                                                            ? "bg-[#5C4033]/15 text-[#5C4033]"
                                                            : "text-[#5F624F] hover:bg-[#5C4033]/5 hover:text-[#5C4033]"
                                                    )}
                                                >
                                                    {sub.colorHex ? (
                                                        <span
                                                            style={{ "--cc": sub.colorHex } as React.CSSProperties}
                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-(--cc)/15"
                                                        >
                                                            {Icon && <Icon className="h-3 w-3 text-(--cc)" />}
                                                        </span>
                                                    ) : (
                                                        Icon && <Icon className={cn("h-3.5 w-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    )}
                                                    <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                                                    {typeof sub.count === "number" && sub.count > 0 && (
                                                        <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 font-black text-[9px] text-white tabular-nums">
                                                            {sub.count > 99 ? "99+" : sub.count}
                                                        </span>
                                                    )}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Sub-items for Events Nav */}
                                {isEventsNav && eventsNavOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-[#E6DFC8] pb-2 pl-2">
                                        {eventsNavSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200",
                                                        isSubActive
                                                            ? "bg-[#5C4033]/15 text-[#5C4033]"
                                                            : "text-[#5F624F] hover:bg-[#5C4033]/5 hover:text-[#5C4033]"
                                                    )}
                                                >
                                                    <sub.icon className={cn("h-3.5 w-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}

                                        {/* Nested Quiz sub-group */}
                                        <button
                                            type="button"
                                            onClick={() => setQuizOpen((p) => !p)}
                                            className={cn(
                                                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200",
                                                onQuizPath
                                                    ? "bg-[#5C4033]/15 text-[#5C4033]"
                                                    : "text-[#5F624F] hover:bg-[#5C4033]/5 hover:text-[#5C4033]"
                                            )}
                                        >
                                            <Brain className={cn("h-3.5 w-3.5", onQuizPath ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                            <span className="flex-1 text-left">Quiz</span>
                                            {quizOpen ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                                        </button>
                                        {quizOpen && (
                                            <div className="mt-1 ml-3 space-y-1 border-l border-[#E6DFC8] pb-1 pl-2">
                                                {quizSubItems.map((sub) => {
                                                    const isSubActive = normalizedPathname === sub.href || normalizedPathname.startsWith(`${sub.href}/`)
                                                    return (
                                                        <Link
                                                            key={sub.href}
                                                            href={sub.href}
                                                            className={cn(
                                                                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200",
                                                                isSubActive
                                                                    ? "bg-[#5C4033]/15 text-[#5C4033]"
                                                                    : "text-[#5F624F] hover:bg-[#5C4033]/5 hover:text-[#5C4033]"
                                                            )}
                                                        >
                                                            <sub.icon className={cn("h-3.5 w-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                            {sub.label}
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Sub-items for Settings */}
                                {isSettings && settingsOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-[#E6DFC8] pb-2 pl-2">
                                        {settingsSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200",
                                                        isSubActive
                                                            ? "bg-[#5C4033]/15 text-[#5C4033]"
                                                            : "text-[#5F624F] hover:bg-[#5C4033]/5 hover:text-[#5C4033]"
                                                    )}
                                                >
                                                    <sub.icon className={cn("h-3.5 w-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
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
                <div className="space-y-2 border-t border-[#E6DFC8] p-4">
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isPending}
                        title={collapsed ? "Sign Out" : undefined}
                        className={cn(
                            "flex w-full items-center gap-3 rounded-xl py-2.5 text-xs font-bold tracking-wider text-[#5F624F] uppercase transition-all duration-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50",
                            collapsed ? "justify-center px-0" : "px-4"
                        )}
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {!collapsed && (isPending ? "Signing out…" : "Sign Out")}
                    </button>
                    {!collapsed && (
                        <p className="px-4 text-[9px] font-bold tracking-widest text-[#5F624F]/70 uppercase">
                            v0.1.0 Alpha
                        </p>
                    )}
                </div>
            </aside>

            {/* 2. Main Content Wrapper */}
            <div className="flex h-screen min-w-0 flex-1 flex-col sm:overflow-y-auto">
                <header className="sticky top-0 z-40 w-full border-b border-[#E6DFC8] bg-white px-4 py-3 sm:px-8">
                    <div className="relative mx-auto flex min-h-10 max-w-7xl items-center">

                        {/* Mobile Back Button */}
                        {backHref && (
                            <button
                                title="Go back"
                                type="button"
                                onClick={() => router.push(backHref)}
                                className="absolute left-0 rounded-full p-2 transition-colors hover:bg-slate-100 active:scale-95"
                            >
                                <ArrowLeft className="h-5 w-5 text-[#1F1F1A]" />
                            </button>
                        )}

                        {/* Title */}
                        <div className="flex w-full flex-col items-center justify-center">
                            <h1 className="flex flex-wrap items-center justify-center gap-1 px-8 text-center font-black text-base text-sm tracking-widest text-[#1F1F1A] uppercase sm:gap-2">
                                <span className={cn(subtitle && backHref ? "hidden sm:inline" : "")}>{title}</span>
                                {subtitle && (
                                    <>
                                        <span className="hidden opacity-30 sm:inline">/</span>
                                        <span className={cn(subtitle && backHref ? "" : "text-[#5F624F] opacity-70 sm:opacity-100")}>{subtitle}</span>
                                    </>
                                )}
                            </h1>
                        </div>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-7xl flex-1 p-1 pb-8 pb-20 sm:p-6">
                    {children}
                </main>

                {/* 3. Persistent Mobile Bottom Navigation */}
                <nav className="fixed right-0 bottom-0 left-0 z-50 border-t border-[#E6DFC8] bg-white py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] sm:hidden">
                    <div className="mx-auto flex w-full max-w-md items-center justify-around px-4">
                        {navItems.map((item) => {
                            const normalizedPathname = pathname?.replace(/\/$/, "") || ""
                            const normalizedHref = item.href.replace(/\/$/, "")
                            const onRequestPath = isRequestPath(normalizedPathname)

                            const isActive = item.label === "Requests"
                                ? onRequestPath
                                : item.label === "Bookings"
                                ? (normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)) && !onRequestPath
                                : normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "relative flex flex-1 flex-col items-center gap-1 py-1 transition-all duration-300 outline-none",
                                        isActive ? "opacity-100" : "opacity-60"
                                    )}
                                >
                                    <div className={cn(
                                        "relative flex items-center justify-center rounded-full px-3 py-1 transition-all duration-300",
                                        isActive ? "bg-[#5C4033]/15 text-[#5C4033]" : "text-[#5F624F]"
                                    )}>
                                        <item.icon className="mx-auto h-5 w-5" />

                                        {/* Green dot — confirmed capacity */}
                                        {item.label === "Bookings" && (
                                            <span className="absolute top-0 right-1.5 h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                                        )}

                                        {/* Amber count — pending requests */}
                                        {item.label === "Requests" && pendingRequestsCount > 0 && (
                                            <span className="absolute -top-1 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 font-black text-[8px] text-white tabular-nums">
                                                {badgeText}
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "block w-full text-center text-[9px] font-bold tracking-tight uppercase transition-colors",
                                        isActive ? "text-[#5C4033]" : "text-[#5F624F]"
                                    )}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <div className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 animate-in rounded-full bg-[#5C4033] duration-300 fade-in zoom-in" />
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