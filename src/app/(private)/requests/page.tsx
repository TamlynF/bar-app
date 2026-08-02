import Link from "next/link"
import { Guitar, PartyPopper, MessageSquare, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getPendingRequestCounts } from "@/lib/request-counts"

export default async function RequestsHubPage() {
    const supabase = await createClient()
    const counts = await getPendingRequestCounts(supabase)

    const requestItems = [
        {
            title: "Band Applications",
            description: "Acts applying to play - review, confirm, book",
            href: "/event-bookings/music-bookings",
            icon: Guitar,
            color: "bg-sky-50 text-sky-600",
            count: counts.band,
        },
        {
            title: "Private Hire",
            description: "Enquiries and venue hire pipeline",
            href: "/event-bookings/private-bookings",
            icon: PartyPopper,
            color: "bg-amber-50 text-amber-700",
            count: counts.privateHire,
        },
        {
            title: "Enquiries",
            description: "General questions from guests",
            href: "/requests/enquiries",
            icon: MessageSquare,
            color: "bg-green-50 text-green-700",
            count: counts.enquiries,
        },
    ]

    return (
        <div className="mx-auto w-full max-w-3xl space-y-3 p-4 sm:p-6">
            {requestItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="group relative flex items-center gap-4 rounded-2xl border border-[#E6DFC8] bg-white p-4 shadow-sm transition-all hover:border-[#5C4033] hover:shadow-md active:scale-[0.98]"
                >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
                        <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-black text-sm tracking-tight text-[#1F1F1A] uppercase">{item.title}</h3>
                        <p className="truncate text-xs font-medium text-[#5F624F]">{item.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F] group-hover:text-[#5C4033]" />

                    {item.count > 0 && (
                        <span
                            aria-label={`${item.count} awaiting action`}
                            className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 font-black text-[10px] text-white uppercase shadow-sm ring-2 ring-[#F7F4EA] tabular-nums"
                        >
                            {item.count > 99 ? "99+" : item.count}
                        </span>
                    )}
                </Link>
            ))}
        </div>
    )
}
