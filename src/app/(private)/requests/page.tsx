import Link from "next/link"
import { Guitar, PartyPopper, MessageSquare, ChevronRight } from "lucide-react"

const requestItems = [
    {
        title: "Band Applications",
        description: "Acts applying to play — review, confirm, book",
        href: "/event-bookings/music-bookings",
        icon: Guitar,
        color: "bg-sky-50 text-sky-600",
    },
    {
        title: "Private Hire",
        description: "Enquiries and venue hire pipeline",
        href: "/event-bookings/private-bookings",
        icon: PartyPopper,
        color: "bg-amber-50 text-amber-700",
    },
    {
        title: "Enquiries",
        description: "General questions from guests",
        href: "/requests/enquiries",
        icon: MessageSquare,
        color: "bg-green-50 text-green-700",
    },
]

export default function RequestsHubPage() {
    return (
        <div className="space-y-3 mx-auto p-4 sm:p-6 w-full max-w-3xl">
            {requestItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-4 bg-white shadow-sm hover:shadow-md p-4 border border-[#E6DFC8] hover:border-[#5C4033] rounded-2xl active:scale-[0.98] transition-all"
                >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                        <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-[#1F1F1A] text-sm uppercase tracking-tight">{item.title}</h3>
                        <p className="font-medium text-[#5F624F] text-xs truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5F624F] group-hover:text-[#5C4033] shrink-0" />
                </Link>
            ))}
        </div>
    )
}