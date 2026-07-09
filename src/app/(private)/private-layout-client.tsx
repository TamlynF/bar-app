"use client"

import React, { useState, useTransition } from "react"
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
    Crown,
    Inbox,
    Guitar,
    MessageSquare
} from "lucide-react"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/login/actions"

type BookableEvent = { id: number; title: string; date: string };

// Routes that belong to the Quiz group, regardless of URL prefix.
const QUIZ_PATHS = [
    "/event-setups/quiz-history",
    "/event-setups/quiz-categories",
    "/event-setups/quiz-generator",
    "/event-setups/leaderboard",
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

function isRequestPath(path: string): boolean {
    return REQUEST_PATHS.some((q) => path === q || path.startsWith(`${q}/`))
}

export default function PrivateLayoutClient({
    children,
    employeeName,
    employeeRole,
    bookableEvents = [],
    pendingRequestsCount = 0,
}: {
    children: React.ReactNode
    employeeName: string
    employeeRole: string
    bookableEvents?: BookableEvent[]
    pendingRequestsCount?: number
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const searchParams = useSearchParams()
    const [eventsOpen, setEventsOpen] = useState(() => !!pathname && pathname.startsWith("/event-bookings") && !isRequestPath(pathname))
    const [requestsOpen, setRequestsOpen] = useState(() => !!pathname && isRequestPath(pathname))
    const [eventsNavOpen, setEventsNavOpen] = useState(() => !!pathname && pathname.startsWith("/event-setups") && !isQuizPath(pathname))
    const [quizOpen, setQuizOpen] = useState(() => !!pathname && isQuizPath(pathname))
    const [settingsOpen, setSettingsOpen] = useState(() => !!pathname && pathname.startsWith("/settings") && !isQuizPath(pathname))

    const initials = employeeName
        ? employeeName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
        : "DF"
    const displayName = employeeName || "Venue Manager"

    function handleSignOut() {
        startTransition(async () => {
            await signOut()
        })
    }

    const badgeText = pendingRequestsCount > 99 ? "99+" : String(pendingRequestsCount)

    // Mobile bottom nav — five thumb-reach destinations. Quiz stays
    // desktop/hub-only until Trends & Content arrive with a "More" sheet.
    const navItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Bookings", href: "/event-bookings", icon: Tickets },
        { label: "Requests", href: "/requests", icon: Inbox },
        { label: "Events", href: "/event-setups", icon: CalendarCogIcon },
        { label: "Settings", href: "/settings", icon: Settings },
    ]

    // Desktop sidebar. `/quiz` is a stable key only — the Quiz parent row is
    // a toggle and never navigates.
    const sidebarItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Bookings", href: "/event-bookings", icon: Tickets },
        { label: "Requests", href: "/requests", icon: Inbox },
        { label: "Events", href: "/event-setups", icon: CalendarCogIcon },
        { label: "Quiz", href: "/quiz", icon: Brain },
        { label: "Settings", href: "/settings", icon: Settings },
    ]

    // Confirmed capacity only. Band applications (music-bookings) moved to
    // Requests — confirmed bands surface here as bookable events via the
    // band → event sync.
    const eventSubItems = [
        { label: "Music Bingo", href: "/event-bookings/bingo-bookings", icon: Speaker },
        { label: "Thursday Quiz", href: "/event-bookings/quiz-bookings", icon: Trophy },
        ...bookableEvents.map(ev => ({
            label: ev.title,
            href: `/event-bookings/event/${ev.id}`,
            icon: CalendarDays,
        })),
    ]

    const requestSubItems = [
        { label: "Band Applications", href: "/event-bookings/music-bookings", icon: Guitar },
        { label: "Private Hire", href: "/event-bookings/private-bookings", icon: PartyPopper },
        { label: "Enquiries", href: "/requests/enquiries", icon: MessageSquare },
    ]

    const eventsNavSubItems = [
        { label: "Event List", href: "/event-setups/events", icon: CalendarDays },
        { label: "Event Categories", href: "/event-setups/event-types", icon: Component },
    ]

    const quizSubItems = [
        { label: "Quiz History", href: "/event-setups/quiz-history", icon: Grid2X2 },
        { label: "Leaderboard", href: "/event-setups/leaderboard", icon: Crown },
        { label: "Quiz Rules", href: "/event-setups/quiz-categories", icon: Dices },
        { label: "Teams", href: "/settings/teams", icon: Medal },
    ]

    const settingsSubItems = [
        { label: "Company Info", href: "/settings/company", icon: Building2 },
        { label: "Guests", href: "/settings/customers", icon: BookUser },
        { label: "Floor Plan", href: "/settings/tables", icon: Grid2X2 },
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

            // Band applications and private hire live under /event-bookings
            // but belong to Requests.
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
            const subtitle = eventsMap[segment] || (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ") : "")
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
        <div className="pt-safe-top flex bg-[#F7F4EA] min-h-screen">
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
                    {sidebarItems.map((item) => {
                        const normalizedPathname = pathname?.replace(/\/$/, "") || ""
                        const normalizedHref = item.href.replace(/\/$/, "")
                        const onQuizPath = isQuizPath(normalizedPathname)
                        const onRequestPath = isRequestPath(normalizedPathname)

                        const isSettings = item.label === "Settings"
                        const isEvents = item.label === "Bookings"
                        const isRequests = item.label === "Requests"
                        const isEventsNav = item.label === "Events"
                        const isQuizGroup = item.label === "Quiz"

                        // Quiz and Requests claim their own paths; Bookings,
                        // Events and Settings exclude them so two parents
                        // never light up at once.
                        const isActive = isQuizGroup
                            ? onQuizPath
                            : isRequests
                            ? onRequestPath
                            : isEvents
                            ? (normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)) && !onRequestPath
                            : isEventsNav
                            ? (normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)) && !onQuizPath
                            : isSettings
                            ? (normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)) && !onQuizPath
                            : normalizedPathname === normalizedHref || (item.href !== "/dashboard" && normalizedPathname.startsWith(`${normalizedHref}/`))

                        const hasSubItems = isEvents || isRequests || isSettings || isEventsNav || isQuizGroup
                        const isOpen = isEvents ? eventsOpen : isRequests ? requestsOpen : isSettings ? settingsOpen : isEventsNav ? eventsNavOpen : isQuizGroup ? quizOpen : false
                        const toggle = isEvents
                            ? () => setEventsOpen((p) => !p)
                            : isRequests
                            ? () => setRequestsOpen((p) => !p)
                            : isSettings
                            ? () => setSettingsOpen((p) => !p)
                            : isEventsNav
                            ? () => setEventsNavOpen((p) => !p)
                            : isQuizGroup
                            ? () => setQuizOpen((p) => !p)
                            : undefined

                        return (
                            <React.Fragment key={item.href}>
                                {/* Parent row — button for collapsible items, Link for plain items */}
                                {hasSubItems && toggle ? (
                                    <button
                                        type="button"
                                        onClick={toggle}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl w-full font-bold text-xs uppercase tracking-wider transition-all duration-300",
                                            isActive
                                                ? "bg-[#5C4033] text-white shadow-lg shadow-[#5C4033]/10"
                                                : "text-[#5F624F] hover:bg-[#5C4033]/5"
                                        )}
                                    >
                                        <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "text-[#5F624F]")} />
                                        <span className="flex-1 text-left">{item.label}</span>

                                        {/* Green dot — confirmed capacity */}
                                        {isEvents && (
                                            <span className="bg-green-500 rounded-full w-1.5 h-1.5 shrink-0" aria-hidden="true" />
                                        )}

                                        {/* Amber count — pending requests */}
                                        {isRequests && pendingRequestsCount > 0 && (
                                            <span className={cn(
                                                "flex justify-center items-center px-1 rounded-full min-w-4.5 h-4.5 font-black tabular-nums text-[9px] shrink-0",
                                                isActive ? "bg-amber-400 text-[#1F1F1A]" : "bg-amber-500 text-white"
                                            )}>
                                                {badgeText}
                                            </span>
                                        )}

                                        {isOpen ? <ChevronUp className="w-3.5 h-3.5 transition-transform duration-200 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 shrink-0" />}
                                    </button>
                                ) : (
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300",
                                            isActive
                                                ? "bg-[#5C4033] text-white shadow-lg shadow-[#5C4033]/10"
                                                : "text-[#5F624F] hover:bg-[#5C4033]/5"
                                        )}
                                    >
                                        <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-[#5F624F]")} />
                                        {item.label}
                                    </Link>
                                )}

                                {/* Sub-items for Bookings */}
                                {isEvents && eventsOpen && (
                                    <div className="space-y-1 mt-1 ml-4 pb-2 pl-2 border-[#E6DFC8] border-l">
                                        {eventSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href
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
                                                    <sub.icon className={cn("w-3.5 h-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Sub-items for Requests */}
                                {isRequests && requestsOpen && (
                                    <div className="space-y-1 mt-1 ml-4 pb-2 pl-2 border-[#E6DFC8] border-l">
                                        {requestSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href || normalizedPathname.startsWith(`${sub.href}/`)
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
                                                    <sub.icon className={cn("w-3.5 h-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Sub-items for Events Nav */}
                                {isEventsNav && eventsNavOpen && (
                                    <div className="space-y-1 mt-1 ml-4 pb-2 pl-2 border-[#E6DFC8] border-l">
                                        {eventsNavSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href
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
                                                    <sub.icon className={cn("w-3.5 h-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Sub-items for Quiz */}
                                {isQuizGroup && quizOpen && (
                                    <div className="space-y-1 mt-1 ml-4 pb-2 pl-2 border-[#E6DFC8] border-l">
                                        {quizSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href || normalizedPathname.startsWith(`${sub.href}/`)
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
                                                    <sub.icon className={cn("w-3.5 h-3.5", isSubActive ? "text-[#5C4033]" : "text-[#5F624F]/50")} />
                                                    {sub.label}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Sub-items for Settings */}
                                {isSettings && settingsOpen && (
                                    <div className="space-y-1 mt-1 ml-4 pb-2 pl-2 border-[#E6DFC8] border-l">
                                        {settingsSubItems.map((sub) => {
                                            const isSubActive = normalizedPathname === sub.href
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
            <div className="flex flex-col flex-1 min-w-0">
                <header className="top-0 z-40 sticky bg-[#F7F4EA]/95 backdrop-blur-md px-4 sm:px-8 py-3 border-[#E6DFC8] border-b w-full">
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

                <main className="flex-1 mx-auto p-1 sm:p-6 pb-20 sm:pb-8 w-full max-w-7xl">
                    {children}
                </main>

                {/* 3. Persistent Mobile Bottom Navigation */}
                <nav className="sm:hidden right-0 bottom-0 left-0 z-50 fixed bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] py-2 border-[#E6DFC8] border-t">
                    <div className="flex justify-around items-center mx-auto px-4 w-full max-w-md">
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
                                        "relative flex flex-col flex-1 items-center gap-1 py-1 outline-none transition-all duration-300",
                                        isActive ? "opacity-100" : "opacity-60"
                                    )}
                                >
                                    <div className={cn(
                                        "relative flex justify-center items-center px-3 py-1 rounded-full transition-all duration-300",
                                        isActive ? "bg-[#5C4033]/15 text-[#5C4033]" : "text-[#5F624F]"
                                    )}>
                                        <item.icon className="mx-auto w-5 h-5" />

                                        {/* Green dot — confirmed capacity */}
                                        {item.label === "Bookings" && (
                                            <span className="top-0 right-1.5 absolute bg-green-500 rounded-full w-1.5 h-1.5" aria-hidden="true" />
                                        )}

                                        {/* Amber count — pending requests */}
                                        {item.label === "Requests" && pendingRequestsCount > 0 && (
                                            <span className="-top-1 right-0 absolute flex justify-center items-center bg-amber-500 px-1 rounded-full min-w-4 h-4 font-black tabular-nums text-[8px] text-white">
                                                {badgeText}
                                            </span>
                                        )}
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
                    </div>
                </nav>
            </div>
        </div>
    )
}