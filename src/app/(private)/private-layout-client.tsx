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
    ShoppingBag,
    LogOut,
    TrendingUp,
    Brain,
    ChevronDown,
    ChevronUp,
    ChevronRight,
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
    PanelLeftOpen,
    MoreHorizontal
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/login/actions"
import { cardIcon } from "@/lib/booking-card-icons"
import { swatchHexFromColor } from "@/lib/event-type-colors"

type PageInfo = {
    title: string;
    subtitle: string | null;
    backHref: string | null;
    description?: string | null;
};

type BookingNavItem = { label: string; href: string; icon?: string | null; color?: string | null; count?: number };
type SubItem = {
    label: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
    colorHex?: string | null;
    count?: number;
};

const QUIZ_PATHS = [
    "/event-setups/quiz-history",
    "/event-setups/quiz-categories",
    "/event-setups/quiz-generator",
    "/event-setups/quiz-leaderboards",
    "/settings/teams",
]

const REQUEST_PATHS = [
    "/requests",
    "/event-bookings/music-bookings",
    "/event-bookings/private-bookings",
]

const WIDE_PATHS = ["/event-bookings/music-bookings", "/event-bookings/private-bookings"]

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

    const isRequestPath = (path: string): boolean =>
        REQUEST_PATHS.some((q) => path === q || path.startsWith(`${q}/`))

    const isWidePath = WIDE_PATHS.includes(pathname ?? "")

    const [collapsed, setCollapsed] = useState(false)
    const [moreOpen, setMoreOpen] = useState(false)

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

    const navItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Bookings", href: "/event-bookings", icon: Tickets },
        { label: "Requests", href: "/requests", icon: Inbox },
        { label: "Events", href: "/event-setups", icon: CalendarCogIcon },
    ]

    /* Trends and Settings live behind "More" so the five mobile targets stay legible. */
    const moreNavItems = [
        { label: "Market trends", href: "/marketing/trends", icon: TrendingUp },
        { label: "Settings", href: "/settings", icon: Settings },
    ]
    const normalizedPathname = pathname?.replace(/\/$/, "") || ""
    const onMoreRoute = moreNavItems.some(
        (i) => normalizedPathname === i.href.replace(/\/$/, "") || normalizedPathname.startsWith(`${i.href.replace(/\/$/, "")}/`)
    )

    const sidebarItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Bookings", href: "/event-bookings", icon: Tickets },
        { label: "Requests", href: "/requests", icon: Inbox },
        { label: "Events", href: "/event-setups", icon: CalendarCogIcon },
        { label: "Market trends", href: "/marketing/trends", icon: TrendingUp },
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

    const eventsNavSubItems = [
        { label: "Event list", href: "/event-setups/events", icon: CalendarDays },
        { label: "Event categories", href: "/event-setups/event-types", icon: Component },
    ]

    const quizSubItems = [
        { label: "Quiz history", href: "/event-setups/quiz-history", icon: Grid2X2 },
        { label: "Quiz rules", href: "/event-setups/quiz-categories", icon: Dices },
        { label: "Leaderboard", href: "/event-setups/quiz-leaderboards", icon: Crown },
        { label: "Teams", href: "/settings/teams", icon: Medal },
    ]

    const settingsSubItems = [
        { label: "Company info", href: "/settings/company", icon: Building2 },
        { label: "Guests", href: "/settings/customers", icon: BookUser },
        { label: "Music acts", href: "/settings/music-acts", icon: Guitar },
        { label: "Seating plan", href: "/settings/tables", icon: Grid2X2 },
        { label: "Menu", href: "/settings/menu", icon: UtensilsCrossed },
        { label: "Specials", href: "/settings/specials", icon: Sparkles },
        { label: "Merchandise", href: "/settings/merchandise", icon: ShoppingBag },
        { label: "Promo content", href: "/settings/promo-content", icon: ImageIcon },
        { label: "Gallery", href: "/settings/gallery", icon: Camera },
        { label: "System users", href: "/settings/users", icon: UserCog2 },
    ]

    const getPageInfo = () => {
        if (!pathname) return { title: "Venue manager", subtitle: null, backHref: null, description: null }

        const normalizedPath = pathname.replace(/\/$/, "")
        if (normalizedPath === "/dashboard") return { title: "Dashboard", subtitle: null, backHref: null, description: "An overview of bookings, requests and venue performance." }

        if (normalizedPath.startsWith("/requests")) {
            if (normalizedPath === "/requests") return { title: "Requests", subtitle: null, backHref: null, description: "Band applications, private hire and enquiries waiting on a decision." }
            const requestsMap: Record<string, string> = {
                "enquiries": "Enquiries",
            }
            const segment = normalizedPath.split("/")[2]
            const subtitle = requestsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Requests", subtitle, backHref: "/requests" }
        }

        if (normalizedPath.startsWith("/event-setups")) {
            if (normalizedPath === "/event-setups") return { title: "Events", subtitle: null, backHref: null, description: "Set up what your venue runs and when it runs." }

            const segment = normalizedPath.split("/")[2]

            const quizMap: Record<string, string> = {
                "quiz-history": "Quiz history",
                "quiz-categories": "Quiz rules",
                "leaderboard": "Leaderboard",
            }
            if (quizMap[segment]) {
                return { title: "Quiz", subtitle: quizMap[segment], backHref: "/event-setups" }
            }

            if (segment === "quiz-generator") {
                const eventId = searchParams.get("event_id")
                const category = searchParams.get("category")
                if (eventId) {
                    const categoryParam = category ? `?category=${encodeURIComponent(category)}` : ''
                    return { title: "Quiz", subtitle: "Quiz generator", backHref: `/event-setups/events/${eventId}${categoryParam}` }
                }
                return { title: "Quiz", subtitle: "Quiz generator", backHref: "/event-setups" }
            }

            const eventSetupsMap: Record<string, string> = {
                "events": "Event list",
                "event-types": "Event categories",
            }
            const subtitle = eventSetupsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")

            if (segment === "events") {
                const eventId = normalizedPath.split("/")[3]
                if (eventId) {
                    return { title: "Events", subtitle: "Quiz questions", backHref: `/event-setups/events?open=${eventId}` }
                }
            }

            const eventSetupsDescriptions: Record<string, string> = {
                "events": "View and manage scheduled venue events.",
                "event-types": "Set up the different types of events your venue runs.",
            }
            return { title: "Events", subtitle, backHref: "/event-setups", description: eventSetupsDescriptions[segment] ?? null }
        }

        if (normalizedPath.startsWith("/event-bookings")) {
            if (normalizedPath === "/event-bookings") return { title: "Bookings", subtitle: null, backHref: null, description: "Choose an event to view and manage its bookings." }

            const segment = normalizedPath.split("/")[2]

            const matchedRequest = requestSubItems.find(
                (s) => normalizedPath === s.href || normalizedPath.startsWith(`${s.href}/`)
            )
            if (matchedRequest) {
                return { title: "Requests", subtitle: matchedRequest.label, backHref: "/requests" }
            }

            if (segment === "music-bookings") {
                return { title: "Requests", subtitle: "Band applications", backHref: "/requests" }
            }
            if (segment === "private-bookings") {
                return { title: "Requests", subtitle: "Private hire", backHref: "/requests" }
            }

            const eventsMap: Record<string, string> = {
                "quiz-bookings": "Quiz",
                "bingo-bookings": "Bingo",
            }
            const matchedNav = eventSubItems.find(
                (s) => normalizedPath === s.href || normalizedPath.startsWith(`${s.href}/`)
            )
            const subtitle = matchedNav?.label || eventsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Bookings", subtitle, backHref: "/event-bookings" }
        }

        if (normalizedPath.startsWith("/settings")) {
            if (normalizedPath === "/settings") return { title: "Settings", subtitle: null, backHref: null, description: "Venue details, menus, staff and everything shown on your website." }

            const segment = normalizedPath.split("/")[2]

            if (segment === "teams") {
                return { title: "Quiz", subtitle: "Teams", backHref: "/settings" }
            }

            const settingsMap: Record<string, string> = {
                "tables": "Floor plan",
                "customers": "Guests",
                "users": "System users",
                "music-acts": "Music acts",
            }
            const subtitle = settingsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
            return { title: "Settings", subtitle, backHref: "/settings" }
        }

        return { title: "Venue manager", subtitle: null, backHref: null, description: null }
    }

    const { title, subtitle, backHref, description = null } = getPageInfo() as PageInfo

    return (
        <div className="pt-safe-top flex h-screen min-h-screen bg-[#F4F1E8] sm:overflow-hidden">
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
                        const isEventsNav = item.label === "Events"

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
                                                    <span className={cn(
                                                        "flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums",
                                                        isActive ? "bg-amber-400 text-[#20231A]" : "bg-amber-500 text-white"
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
                                                        <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white tabular-nums">
                                                            {sub.count > 99 ? "99+" : sub.count}
                                                        </span>
                                                    )}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {isEventsNav && eventsNavOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-nav-line pb-2 pl-2">
                                        {eventsNavSubItems.map((sub) => {
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

                                        <button
                                            type="button"
                                            onClick={() => setQuizOpen((p) => !p)}
                                            className={cn(
                                                "flex w-full items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-[13px] font-medium transition-colors duration-200",
                                                onQuizPath
                                                    ? "border-nav-indicator bg-nav-selected text-nav-ink"
                                                    : "border-transparent text-nav-muted hover:bg-nav-selected hover:text-nav-ink"
                                            )}
                                        >
                                            <Brain className={cn("h-3.5 w-3.5", onQuizPath ? "text-nav-indicator" : "text-nav-muted")} />
                                            <span className="flex-1 text-left">Quiz</span>
                                            {quizOpen ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                                        </button>
                                        {quizOpen && (
                                            <div className="mt-1 ml-3 space-y-1 border-l border-nav-line pb-1 pl-2">
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
                                    </div>
                                )}

                                {isSettings && settingsOpen && !collapsed && (
                                    <div className="mt-1 ml-4 space-y-1 border-l border-nav-line pb-2 pl-2">
                                        {settingsSubItems.map((sub) => {
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

            <div className="flex h-screen min-w-0 flex-1 flex-col sm:overflow-y-auto">
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
                                <ol className="flex items-center gap-1 text-[13px] font-medium text-admin-muted">
                                    <li className="flex items-center">
                                        {backHref ? (
                                            <Link href={backHref} className="rounded transition-colors hover:text-admin-ink hover:underline">
                                                {title}
                                            </Link>
                                        ) : (
                                            <span>{title}</span>
                                        )}
                                    </li>
                                    <li className="flex items-center" aria-hidden="true">
                                        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                                    </li>
                                    <li className="flex min-w-0 items-center">
                                        <span aria-current="page" className="truncate text-admin-ink">{subtitle}</span>
                                    </li>
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

                <main className={cn(
                    "mx-auto w-full flex-1 p-1 pb-20 sm:py-6 sm:pb-8",
                    isWidePath ? "max-w-none" : "max-w-7xl sm:px-6"
                )}>
                    {children}
                </main>

                <nav aria-label="Main" className="fixed right-0 bottom-0 left-0 z-50 border-t border-nav-line bg-nav-bg pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.18)] sm:hidden">
                    <div className="mx-auto flex w-full max-w-md items-stretch justify-around px-2">
                        {navItems.map((item) => {
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
                                    aria-current={isActive ? "page" : undefined}
                                    className="relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-nav-indicator"
                                >
                                    <span className={cn(
                                        "relative flex items-center justify-center rounded-full px-3 py-0.5 transition-colors",
                                        isActive ? "bg-nav-selected text-nav-ink" : "text-nav-muted"
                                    )}>
                                        <item.icon className="h-5.5 w-5.5" />

                                        {item.label === "Bookings" && (
                                            <span className="absolute top-0 right-1.5 h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                                        )}

                                        {item.label === "Requests" && pendingRequestsCount > 0 && (
                                            <span className="absolute -top-1 right-0 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white tabular-nums">
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
                                const isActive = normalizedPathname === item.href.replace(/\/$/, "")
                                    || normalizedPathname.startsWith(`${item.href.replace(/\/$/, "")}/`)
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