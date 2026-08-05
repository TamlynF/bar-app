"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    LayoutDashboard,
    Settings,
    ArrowLeft,
    LogOut,
    Brain,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Tickets,
    CalendarCogIcon,
    Inbox,
    Guitar,
    PartyPopper,
    MessageSquare,
    PanelLeftClose,
    PanelLeftOpen,
    MoreHorizontal,
    Users
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/login/actions"
import { cardIcon } from "@/lib/booking-card-icons"
import { swatchHexFromColor } from "@/lib/event-type-colors"
import {
    MARKET_TRENDS_ITEM,
    QUIZ_HUB_HREF,
    QUIZ_NAV_ITEMS,
    SCHEDULE_HREF,
    SETTINGS_NAV_GROUPS,
    isMarketTrendsPath,
    isQuizPath,
    isSchedulePath,
    isSettingsPath,
    isWidePath,
} from "@/lib/admin-nav"

type Crumb = { label: string; href?: string | null };

type PageInfo = {
    title: string;
    subtitle: string | null;
    backHref: string | null;
    description?: string | null;
    // Set when a page needs more than the default "title > subtitle" pair.
    trail?: Crumb[];
};

function internalHref(value: string | null): string | null {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null
    return value
}

type BookingNavItem = { label: string; href: string; icon?: string | null; color?: string | null; count?: number };
type SubItem = {
    label: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
    colorHex?: string | null;
    count?: number;
};

/* Dark ink on amber: white on amber-500 is about 2:1 at this size, which is
   what made the counts hard to read. The parent badge is a shade darker than
   the sub-item badges it totals up. */
const COUNT_BADGE =
    "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-[#20231A] tabular-nums"
const COUNT_BADGE_PARENT = "bg-amber-500"
const COUNT_BADGE_SUB = "bg-amber-300"

const REQUEST_PATHS = [
    "/requests",
    "/event-bookings/music-bookings",
    "/event-bookings/private-bookings",
]


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

    const isRequestPath = (path: string): boolean =>
        REQUEST_PATHS.some((q) => path === q || path.startsWith(`${q}/`))

    const widePath = isWidePath(pathname)

    const [collapsed, setCollapsed] = useState(false)
    const [moreOpen, setMoreOpen] = useState(false)

    const [eventsOpen, setEventsOpen] = useState(() => !!pathname && pathname.startsWith("/event-bookings") && !isRequestPath(pathname))
    const [requestsOpen, setRequestsOpen] = useState(() => !!pathname && isRequestPath(pathname))
    const [quizOpen, setQuizOpen] = useState(() => !!pathname && isQuizPath(pathname))
    const [settingsOpen, setSettingsOpen] = useState(() => !!pathname && pathname.startsWith("/settings") && !isQuizPath(pathname))
    /* Both groups start open, so nothing is hidden until you choose to hide it. */
    const [openSettingsGroups, setOpenSettingsGroups] = useState<Set<string>>(
        () => new Set(SETTINGS_NAV_GROUPS.map((group) => group.label))
    )

    const toggleSettingsGroup = (label: string) =>
        setOpenSettingsGroups((prev) => {
            const next = new Set(prev)
            if (next.has(label)) { next.delete(label) } else { next.add(label) }
            return next
        })

    const initials = employeeName
        ? employeeName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
        : "DF"

    function handleSignOut() {
        startTransition(async () => {
            await signOut()
        })
    }

    const badgeText = pendingRequestsCount > 99 ? "99+" : String(pendingRequestsCount)

    /* Mobile only: bookings and requests share one "Guests" target that opens a chooser. */
    const navItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Guests", href: "/guests", icon: Users },
        { label: "Schedule", href: SCHEDULE_HREF, icon: CalendarCogIcon },
        { label: "Quiz", href: QUIZ_HUB_HREF, icon: Brain },
    ]

    /* Trends and Settings live behind "More" so the five mobile targets stay legible. */
    const moreNavItems = [
        { label: MARKET_TRENDS_ITEM.label, href: MARKET_TRENDS_ITEM.href, icon: MARKET_TRENDS_ITEM.icon, matches: isMarketTrendsPath },
        { label: "Settings", href: "/settings", icon: Settings, matches: isSettingsPath },
    ]
    const normalizedPathname = pathname?.replace(/\/$/, "") || ""
    const onMoreRoute = moreNavItems.some((i) => i.matches(normalizedPathname))

    /* Read and analyse, then operate, then configure. */
    const sidebarItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: MARKET_TRENDS_ITEM.label, href: MARKET_TRENDS_ITEM.href, icon: MARKET_TRENDS_ITEM.icon },
        { label: "Bookings", href: "/event-bookings", icon: Tickets },
        { label: "Requests", href: "/requests", icon: Inbox },
        { label: "Schedule", href: SCHEDULE_HREF, icon: CalendarCogIcon },
        { label: "Quiz", href: QUIZ_HUB_HREF, icon: Brain },
        { label: "Settings", href: "/settings", icon: Settings },
    ]

    const toSub = (nav: BookingNavItem): SubItem => ({
        label: nav.label,
        href: nav.href,
        icon: cardIcon(nav.icon),
        colorHex: swatchHexFromColor(nav.color ?? undefined) ?? null,
        count: nav.count,
    })

    const eventSubItems: SubItem[] = guestNav.map(toSub)

    const requestSubItems: SubItem[] = [
        { label: "Band applications", href: "/event-bookings/music-bookings", icon: Guitar, colorHex: "#7C3AED", count: pendingBandCount },
        { label: "Private hire", href: "/event-bookings/private-bookings", icon: PartyPopper, colorHex: "#0EA5E9", count: pendingHireCount },
        { label: "Enquiries", href: "/requests/enquiries", icon: MessageSquare, colorHex: "#DC2626", count: pendingEnquiriesCount },
    ]

    const quizSubItems = QUIZ_NAV_ITEMS
    /* Grouped the same way the settings hub is, so the sidebar and the page it
       opens read as one list rather than two orderings of it. */
    const settingsSubGroups = SETTINGS_NAV_GROUPS

    const getPageInfo = () => {
        if (!pathname) return { title: "Venue manager", subtitle: null, backHref: null, description: null }

        const normalizedPath = pathname.replace(/\/$/, "")
        if (normalizedPath === "/dashboard") return { title: "Dashboard", subtitle: null, backHref: null, description: "An overview of bookings, requests and venue performance." }

        if (normalizedPath === "/guests") return { title: "Guests", subtitle: null, backHref: null, description: "Bookings guests have made and requests waiting on you." }

        if (normalizedPath.startsWith("/marketing")) return { title: "Market trends", subtitle: null, backHref: null, description: "Ideas, events and price-offs from venues near you, refreshed each week." }

        if (normalizedPath.startsWith("/requests")) {
            if (normalizedPath === "/requests") return { title: "Requests", subtitle: null, backHref: "/guests", description: "Band applications, private hire and enquiries waiting on a decision." }
            const requestsMap: Record<string, string> = {
                "enquiries": "Enquiries",
            }
            const segment = normalizedPath.split("/")[2]
            const subtitle = requestsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Requests", subtitle, backHref: "/requests" }
        }

        if (normalizedPath.startsWith("/event-setups")) {
            if (normalizedPath === "/event-setups") return { title: "Schedule", subtitle: null, backHref: null, description: "View and manage scheduled venue events." }

            const segment = normalizedPath.split("/")[2]

            if (segment === "quiz") {
                return { title: "Quiz", subtitle: null, backHref: null, description: "Rounds, rules, teams and the season leaderboard." }
            }

            const quizMap: Record<string, string> = {
                "quiz-history": "Quiz history",
                "quiz-categories": "Quiz categories",
                "quiz-leaderboards": "Leaderboard",
            }
            if (quizMap[segment]) {
                return { title: "Quiz", subtitle: quizMap[segment], backHref: QUIZ_HUB_HREF }
            }

            if (segment === "quiz-generator") {
                const eventId = searchParams.get("event_id")
                const category = searchParams.get("category")
                if (eventId) {
                    const categoryParam = category ? `?category=${encodeURIComponent(category)}` : ''
                    return { title: "Quiz", subtitle: "Quiz generator", backHref: `/event-setups/events/${eventId}${categoryParam}` }
                }
                return { title: "Quiz", subtitle: "Quiz generator", backHref: QUIZ_HUB_HREF }
            }

            if (segment === "event-types") {
                return { title: "Settings", subtitle: "Event categories", backHref: "/settings", description: "Set up the different types of events your venue runs." }
            }

            if (segment === "events") {
                const eventId = normalizedPath.split("/")[3]
                if (eventId) {
                    const eventHref = internalHref(searchParams.get("back")) ?? `${SCHEDULE_HREF}?open=${eventId}`
                    return {
                        title: "Schedule",
                        subtitle: "Quiz questions",
                        backHref: eventHref,
                        trail: [
                            { label: "Schedule", href: SCHEDULE_HREF },
                            { label: `#${eventId}`, href: eventHref },
                            { label: "Quiz questions" },
                        ],
                    }
                }
                return { title: "Schedule", subtitle: null, backHref: null, description: "View and manage scheduled venue events." }
            }

            const subtitle = segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : ""
            return { title: "Schedule", subtitle, backHref: SCHEDULE_HREF }
        }

        if (normalizedPath.startsWith("/event-bookings")) {
            if (normalizedPath === "/event-bookings") return { title: "Bookings", subtitle: null, backHref: "/guests", description: "Choose an event to view and manage its bookings." }

            const segment = normalizedPath.split("/")[2]

            /* Arrived from a customer's record, so the trail leads back to that
               person rather than to the list this page normally hangs off. */
            const customerId = searchParams.get("from") === "customer" ? searchParams.get("customerId") : null
            const customerHref = "/settings/customers"

            const matchedRequest = requestSubItems.find(
                (s) => normalizedPath === s.href || normalizedPath.startsWith(`${s.href}/`)
            )
            if (matchedRequest) {
                return { title: "Requests", subtitle: matchedRequest.label, backHref: "/requests" }
            }

            if (segment === "event") {
                const eventId = normalizedPath.split("/")[3]
                if (eventId) {
                    const setupHref = internalHref(searchParams.get("back"))
                    const eventTitle = searchParams.get("title")
                    const navLabel = eventSubItems.find((s) => normalizedPath === s.href)?.label
                    const subtitle = eventTitle ?? navLabel ?? `Event #${eventId}`
                    if (customerId) {
                        return {
                            title: "Bookings",
                            subtitle,
                            backHref: customerHref,
                            trail: [
                                { label: "Settings", href: "/settings" },
                                { label: "Customers", href: customerHref },
                                { label: `#${customerId}`, href: customerHref },
                                { label: "Bookings", href: "/event-bookings" },
                                { label: subtitle },
                            ],
                        }
                    }
                    if (setupHref) {
                        return {
                            title: "Bookings",
                            subtitle,
                            backHref: setupHref,
                            trail: [
                                { label: "Schedule", href: SCHEDULE_HREF },
                                { label: `#${eventId}`, href: setupHref },
                                { label: "Bookings", href: "/event-bookings" },
                                { label: subtitle },
                            ],
                        }
                    }
                    return {
                        title: "Bookings",
                        subtitle,
                        backHref: "/event-bookings",
                        trail: [
                            { label: "Bookings", href: "/event-bookings" },
                            { label: subtitle },
                        ],
                    }
                }
            }

            if (segment === "music-bookings" || segment === "private-bookings") {
                const subtitle = segment === "music-bookings" ? "Band applications" : "Private hire"
                if (customerId) {
                    return {
                        title: "Requests",
                        subtitle,
                        backHref: customerHref,
                        trail: [
                            { label: "Settings", href: "/settings" },
                            { label: `Customer #${customerId}`, href: customerHref },
                            { label: "Requests", href: "/requests" },
                            { label: subtitle },
                        ],
                    }
                }
                return { title: "Requests", subtitle, backHref: "/requests" }
            }

            const matchedNav = eventSubItems.find(
                (s) => normalizedPath === s.href || normalizedPath.startsWith(`${s.href}/`)
            )
            const subtitle = matchedNav?.label || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Bookings", subtitle, backHref: "/event-bookings" }
        }

        if (normalizedPath.startsWith("/settings")) {
            if (normalizedPath === "/settings") return { title: "Settings", subtitle: null, backHref: null, description: "Venue details, menus, staff and everything shown on your website." }

            const segment = normalizedPath.split("/")[2]

            if (segment === "teams") {
                return { title: "Quiz", subtitle: "Teams", backHref: QUIZ_HUB_HREF }
            }

            const settingsMap: Record<string, string> = {
                "company": "Company Information",
                "venue": "Venue layout",
                "tables": "Seating plan",
                "customers": "Customers",
                "users": "System users",
                "music-acts": "Music acts",
            }
            const subtitle = settingsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Settings", subtitle, backHref: "/settings" }
        }

        return { title: "Venue manager", subtitle: null, backHref: null, description: null }
    }

    const { title, subtitle, backHref, description = null, trail } = getPageInfo() as PageInfo
    const crumbs: Crumb[] = trail ?? [{ label: title, href: backHref }, { label: subtitle ?? "" }]

    return (
        <div className="pt-safe-top flex min-h-screen bg-[#F4F1E8] sm:h-screen sm:overflow-hidden">
            <aside className={cn(
                "sticky top-0 z-50 hidden h-screen shrink-0 flex-col border-r border-nav-line bg-nav-bg transition-[width] duration-300 sm:flex",
                collapsed ? "w-16" : "w-72"
            )}>
                <div className={cn(
                    "flex min-h-10 items-center gap-3 border-b border-nav-line px-3 py-3",
                    collapsed ? "justify-center" : "justify-between px-6"
                )}>
                    {!collapsed && (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nav-selected ring-1 ring-nav-line">
                            <span className="text-sm font-bold text-nav-ink">{initials}</span>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setCollapsed((c) => !c)}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-nav-muted transition-colors hover:bg-nav-selected hover:text-nav-ink"
                    >
                        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                    </button>
                </div>

                <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto p-4">
                    {sidebarItems.map((item) => {
                        const normalizedPathname = pathname?.replace(/\/$/, "") || ""
                        const normalizedHref = item.href.replace(/\/$/, "")
                        const onQuizPath = isQuizPath(normalizedPathname)
                        const onRequestPath = isRequestPath(normalizedPathname)

                        const isSettings = item.label === "Settings"
                        const isEvents = item.label === "Bookings"
                        const isRequests = item.label === "Requests"
                        const isQuizNav = item.label === "Quiz"

                        const isActive = isRequests
                            ? onRequestPath
                            : isEvents
                            ? (normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)) && !onRequestPath
                            : isQuizNav
                            ? onQuizPath
                            : item.label === "Schedule"
                            ? isSchedulePath(normalizedPathname)
                            : isSettings
                            ? isSettingsPath(normalizedPathname)
                            : normalizedPathname === normalizedHref || (item.href !== "/dashboard" && normalizedPathname.startsWith(`${normalizedHref}/`))

                        const hasSubItems = isEvents || isRequests || isSettings || isQuizNav
                        const isOpen = isEvents ? eventsOpen : isRequests ? requestsOpen : isSettings ? settingsOpen : isQuizNav ? quizOpen : false
                        const toggle = isEvents
                            ? () => setEventsOpen((p) => !p)
                            : isRequests
                            ? () => setRequestsOpen((p) => !p)
                            : isSettings
                            ? () => setSettingsOpen((p) => !p)
                            : isQuizNav
                            ? () => setQuizOpen((p) => !p)
                            : undefined
                        const openGroup = isEvents
                            ? () => setEventsOpen(true)
                            : isRequests
                            ? () => setRequestsOpen(true)
                            : isSettings
                            ? () => setSettingsOpen(true)
                            : isQuizNav
                            ? () => setQuizOpen(true)
                            : undefined

                        return (
                            <React.Fragment key={item.href}>
                                {hasSubItems && toggle ? (
                                    <button
                                        type="button"
                                        onClick={collapsed ? () => { setCollapsed(false); openGroup?.() } : toggle}
                                        title={collapsed ? item.label : undefined}
                                        className={cn(
                                            "relative flex w-full items-center gap-3 rounded-xl border-l-2 text-sm font-semibold transition-colors duration-300",
                                            collapsed ? "justify-center px-0 py-3" : "px-4 py-3",
                                            isActive
                                                ? "border-nav-indicator bg-nav-selected text-nav-ink"
                                                : "border-transparent text-nav-ink hover:bg-nav-selected"
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-nav-ink" : "text-nav-muted")} />

                                        {collapsed && isRequests && pendingRequestsCount > 0 && (
                                            <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                                        )}

                                        {!collapsed && (
                                            <>
                                                <span className="flex-1 text-left">{item.label}</span>

                                                {isEvents && (
                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" aria-hidden="true" />
                                                )}

                                                {isRequests && pendingRequestsCount > 0 && (
                                                    <span
                                                        title={`${pendingRequestsCount} pending`}
                                                        className={cn(COUNT_BADGE, COUNT_BADGE_PARENT)}
                                                    >
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
                                            "flex items-center gap-3 rounded-xl border-l-2 text-sm font-semibold transition-colors duration-300",
                                            collapsed ? "justify-center px-0 py-3" : "px-4 py-3",
                                            isActive
                                                ? "border-nav-indicator bg-nav-selected text-nav-ink"
                                                : "border-transparent text-nav-ink hover:bg-nav-selected"
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-nav-ink" : "text-nav-muted")} />
                                        {!collapsed && item.label}
                                    </Link>
                                )}

                                {isEvents && eventsOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-nav-line pb-2 pl-2">
                                        {eventSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href.replace(/\/$/, "")
                                            const Icon = sub.icon
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-[13px] font-medium transition-colors duration-200",
                                                        isSubActive
                                                            ? "border-nav-indicator bg-nav-selected text-nav-ink"
                                                            : "border-transparent text-nav-muted hover:bg-nav-selected hover:text-nav-ink"
                                                    )}
                                                >
                                                    {sub.colorHex ? (
                                                        <span
                                                            style={{ "--cc": sub.colorHex } as React.CSSProperties}
                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-(--cc)/25"
                                                        >
                                                            {Icon && <Icon className="h-3 w-3 text-(--cc)" />}
                                                        </span>
                                                    ) : (
                                                        Icon && <Icon className={cn("h-3.5 w-3.5", isSubActive ? "text-nav-indicator" : "text-nav-muted")} />
                                                    )}
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {isRequests && requestsOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-nav-line pb-2 pl-2">
                                        {requestSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href || normalizedPathname.startsWith(`${sub.href}/`)
                                            const Icon = sub.icon
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-[13px] font-medium transition-colors duration-200",
                                                        isSubActive
                                                            ? "border-nav-indicator bg-nav-selected text-nav-ink"
                                                            : "border-transparent text-nav-muted hover:bg-nav-selected hover:text-nav-ink"
                                                    )}
                                                >
                                                    {sub.colorHex ? (
                                                        <span
                                                            style={{ "--cc": sub.colorHex } as React.CSSProperties}
                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-(--cc)/25"
                                                        >
                                                            {Icon && <Icon className="h-3 w-3 text-(--cc)" />}
                                                        </span>
                                                    ) : (
                                                        Icon && <Icon className={cn("h-3.5 w-3.5", isSubActive ? "text-nav-indicator" : "text-nav-muted")} />
                                                    )}
                                                    <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                                                    {typeof sub.count === "number" && sub.count > 0 && (
                                                        <span
                                                            title={`${sub.count} pending`}
                                                            className={cn(COUNT_BADGE, COUNT_BADGE_SUB)}
                                                        >
                                                            {sub.count > 99 ? "99+" : sub.count}
                                                        </span>
                                                    )}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {isQuizNav && quizOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-nav-line pb-2 pl-2">
                                        {quizSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href || normalizedPathname.startsWith(`${sub.href}/`)
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-[13px] font-medium transition-colors duration-200",
                                                        isSubActive
                                                            ? "border-nav-indicator bg-nav-selected text-nav-ink"
                                                            : "border-transparent text-nav-muted hover:bg-nav-selected hover:text-nav-ink"
                                                    )}
                                                >
                                                    <sub.icon className={cn("h-3.5 w-3.5", isSubActive ? "text-nav-indicator" : "text-nav-muted")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {isSettings && settingsOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-2 border-l border-nav-line pb-2 pl-2">
                                        {settingsSubGroups.map((group) => {
                                            const groupOpen = openSettingsGroups.has(group.label)
                                            const holdsCurrent = group.items.some((sub) => normalizedPathname === sub.href)
                                            return (
                                            <div key={group.label} className="space-y-1">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSettingsGroup(group.label)}
                                                    aria-expanded={groupOpen}
                                                    className="flex w-full items-center gap-1.5 rounded-lg px-3 pt-1 pb-0.5 text-left text-[11px] font-semibold tracking-wide text-nav-muted/70 uppercase transition-colors hover:text-nav-ink"
                                                >
                                                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                                                    {/* A closed group holding the page you are on says so, rather
                                                        than leaving the sidebar looking like nothing is selected. */}
                                                    {!groupOpen && holdsCurrent && (
                                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-nav-indicator" aria-hidden="true" />
                                                    )}
                                                    <ChevronDown
                                                        className={cn(
                                                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                                                            groupOpen && "rotate-180"
                                                        )}
                                                    />
                                                </button>
                                                {groupOpen && group.items.map((sub) => {
                                                    const isSubActive = normalizedPathname === sub.href
                                                    return (
                                                        <Link
                                                            key={sub.href}
                                                            href={sub.href}
                                                            className={cn(
                                                                "flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-[13px] font-medium transition-colors duration-200",
                                                                isSubActive
                                                                    ? "border-nav-indicator bg-nav-selected text-nav-ink"
                                                                    : "border-transparent text-nav-muted hover:bg-nav-selected hover:text-nav-ink"
                                                            )}
                                                        >
                                                            <sub.icon className={cn("h-3.5 w-3.5", isSubActive ? "text-nav-indicator" : "text-nav-muted")} />
                                                            {sub.label}
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </React.Fragment>
                        )
                    })}
                </nav>

                <div className="space-y-2 border-t border-nav-line p-4">
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isPending}
                        title={collapsed ? "Sign out" : undefined}
                        className={cn(
                            "flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium text-nav-muted transition-colors duration-200 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50",
                            collapsed ? "justify-center px-0" : "px-4"
                        )}
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {!collapsed && (isPending ? "Signing outâ€¦" : "Sign out")}
                    </button>
                    {!collapsed && (
                        <p className="px-4 text-[11px] font-medium text-nav-muted/70">
                            v0.1.0 Alpha
                        </p>
                    )}
                </div>
            </aside>

            <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-admin-bg sm:h-screen sm:overflow-y-auto">
                <header className="sticky top-0 z-40 w-full border-b border-admin-line bg-admin-card/95 backdrop-blur-sm">
                    <div className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-2 sm:hidden">
                        {backHref ? (
                            <button
                                type="button"
                                title="Go back"
                                aria-label="Go back"
                                onClick={() => router.push(backHref)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink active:scale-95"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        ) : (
                            <span className="h-11 w-11 shrink-0" aria-hidden="true" />
                        )}
                        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] leading-tight font-bold tracking-tight text-admin-ink">
                            {subtitle ?? title}
                        </h1>
                        <span className="h-11 w-11 shrink-0" aria-hidden="true" />
                    </div>

                    <div className="mx-auto hidden max-w-7xl flex-col justify-center px-6 py-3 sm:flex sm:min-h-16 md:px-8">
                        {subtitle && (
                            <nav aria-label="Breadcrumb" className="mb-0.5">
                                <ol className="flex flex-wrap items-center gap-1 text-[13px] font-medium text-admin-muted">
                                    {crumbs.map((crumb, index) => {
                                        const isLast = index === crumbs.length - 1
                                        return (
                                            <React.Fragment key={`${crumb.label}-${index}`}>
                                                {index > 0 && (
                                                    <li className="flex items-center" aria-hidden="true">
                                                        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                                                    </li>
                                                )}
                                                <li className="flex min-w-0 items-center">
                                                    {isLast || !crumb.href ? (
                                                        <span
                                                            aria-current={isLast ? "page" : undefined}
                                                            className={cn("truncate", isLast && "text-admin-ink")}
                                                        >
                                                            {crumb.label}
                                                        </span>
                                                    ) : (
                                                        <Link href={crumb.href} className="rounded transition-colors hover:text-admin-ink hover:underline">
                                                            {crumb.label}
                                                        </Link>
                                                    )}
                                                </li>
                                            </React.Fragment>
                                        )
                                    })}
                                </ol>
                            </nav>
                        )}
                        <h1 className="truncate text-xl leading-tight font-bold tracking-tight text-admin-ink lg:text-2xl">
                            {subtitle ?? title}
                        </h1>
                        {description && (
                            <p className="mt-1 max-w-[70ch] truncate text-sm leading-normal font-normal text-admin-muted">
                                {description}
                            </p>
                        )}
                    </div>
                </header>

                {/* The bottom gutter is deliberately generous: on phones it has to
                    clear the fixed nav, and on a long list the last row otherwise
                    sits flush against the viewport edge. */}
                <main className={cn(
                    "mx-auto w-full flex-1 p-1 pb-28 sm:min-h-0 sm:py-6 sm:pb-16",
                    widePath ? "max-w-none" : "max-w-7xl sm:px-6"
                )}>
                    {children}
                </main>

                <nav aria-label="Main" className="fixed right-0 bottom-0 left-0 z-50 border-t border-nav-line bg-nav-bg pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.18)] sm:hidden">
                    <div className="mx-auto flex w-full max-w-md items-stretch justify-around px-2">
                        {navItems.map((item) => {
                            const normalizedHref = item.href.replace(/\/$/, "")

                            const isActive = item.label === "Guests"
                                ? normalizedPathname === "/guests"
                                    || isRequestPath(normalizedPathname)
                                    || normalizedPathname === "/event-bookings"
                                    || normalizedPathname.startsWith("/event-bookings/")
                                : item.label === "Quiz"
                                ? isQuizPath(normalizedPathname)
                                : item.label === "Schedule"
                                ? isSchedulePath(normalizedPathname)
                                : normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={isActive ? "page" : undefined}
                                    className="relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-nav-indicator"
                                >
                                    <span className={cn(
                                        "relative flex items-center justify-center rounded-full px-3 py-0.5 transition-colors",
                                        isActive ? "bg-nav-selected text-nav-ink" : "text-nav-muted"
                                    )}>
                                        <item.icon className="h-5.5 w-5.5" />

                                        {item.label === "Guests" && pendingRequestsCount > 0 && (
                                            <span
                                                title={`${pendingRequestsCount} pending`}
                                                /* Ringed in the bar's own colour so it reads as a badge
                                                   rather than part of the icon it sits over. */
                                                className={cn(COUNT_BADGE, COUNT_BADGE_PARENT, "absolute -top-1 right-0 ring-2 ring-nav-bg")}
                                            >
                                                {badgeText}
                                            </span>
                                        )}
                                    </span>
                                    <span className={cn(
                                        "block w-full text-center text-[11px] leading-none font-semibold transition-colors",
                                        isActive ? "text-nav-ink" : "text-nav-muted"
                                    )}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 animate-in rounded-full bg-nav-indicator duration-300 fade-in zoom-in" aria-hidden="true" />
                                    )}
                                </Link>
                            )
                        })}

                        <button
                            type="button"
                            onClick={() => setMoreOpen(true)}
                            aria-haspopup="dialog"
                            aria-expanded={moreOpen}
                            aria-current={onMoreRoute ? "page" : undefined}
                            className="relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-nav-indicator"
                        >
                            <span className={cn(
                                "flex items-center justify-center rounded-full px-3 py-0.5 transition-colors",
                                onMoreRoute ? "bg-nav-selected text-nav-ink" : "text-nav-muted"
                            )}>
                                <MoreHorizontal className="h-5.5 w-5.5" />
                            </span>
                            <span className={cn(
                                "block w-full text-center text-[11px] leading-none font-semibold transition-colors",
                                onMoreRoute ? "text-nav-ink" : "text-nav-muted"
                            )}>
                                More
                            </span>
                            {onMoreRoute && (
                                <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-nav-indicator" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </nav>

                <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                    <SheetContent
                        side="bottom"
                        showCloseButton={false}
                        className="gap-0 rounded-t-3xl border-t border-nav-line bg-nav-bg p-0 pb-[calc(12px+env(safe-area-inset-bottom))] sm:hidden"
                    >
                        <div className="mx-auto mt-2 h-1 w-11 shrink-0 rounded-full bg-nav-muted/40" aria-hidden="true" />
                        <SheetTitle className="px-5 pt-3 pb-1 text-base font-bold text-nav-ink">More</SheetTitle>
                        <SheetDescription className="px-5 pb-2 text-[13px] font-normal text-nav-muted">
                            Trends, settings and your account.
                        </SheetDescription>
                        <div className="flex flex-col p-2">
                            {moreNavItems.map((item) => {
                                const isActive = item.matches(normalizedPathname)
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMoreOpen(false)}
                                        aria-current={isActive ? "page" : undefined}
                                        className={cn(
                                            "flex min-h-12 items-center gap-3 rounded-xl border-l-2 px-3 text-sm font-semibold transition-colors",
                                            isActive
                                                ? "border-nav-indicator bg-nav-selected text-nav-ink"
                                                : "border-transparent text-nav-ink hover:bg-nav-selected"
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-nav-ink" : "text-nav-muted")} />
                                        {item.label}
                                    </Link>
                                )
                            })}
                            <button
                                type="button"
                                onClick={() => { setMoreOpen(false); handleSignOut() }}
                                disabled={isPending}
                                className="mt-1 flex min-h-12 items-center gap-3 rounded-xl border-l-2 border-transparent px-3 text-sm font-medium text-nav-muted transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                            >
                                <LogOut className="h-5 w-5 shrink-0" />
                                {isPending ? "Signing out…" : "Sign out"}
                            </button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    )
}