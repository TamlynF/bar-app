import React from "react"
import { createClient } from "@/lib/supabase/server"
import { 
  Trophy, 
  Mic2, 
  Lock, 
  Users, 
  ChevronRight, 
  CheckCircle2, 
  Clock3, 
  LayoutGrid,
  TrendingUp,
  Music,
  PlusCircle,
  LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface EventTypeInfo {
  type: string;
  sub_type: string;
}

interface BookingInfo {
  status: string;
  group_size: number;
}

interface EventWithDetails {
  id: string;
  date: string;
  title: string;
  seating_required: boolean;
  event_types: EventTypeInfo;
  bookings: BookingInfo[];
}

export default async function EventsHubPage() {
  const supabase = await createClient()

  // 1. Fetch current live data
  const { data: rawEvents } = await supabase
    .from("events")
    .select(`
      id, date, title, seating_required,
      event_types (type, sub_type),
      bookings (status, group_size)
    `)
    .order('date', { ascending: true })

  const events = (rawEvents as unknown as EventWithDetails[]) || []

  // 2. Aggregate stats for different segments
  const quizEvents = events.filter(e => e.event_types?.sub_type === 'quiz')
  const liveMusic = events.filter(e => e.event_types?.type === 'music')
  const privateHire = events.filter(e => e.event_types?.type === 'private')

  // 3. Analytics Aggregation
  const totalGuests = events.reduce((acc, e) => 
    acc + e.bookings.reduce((bAcc, b) => bAcc + (b.status === 'confirmed' ? b.group_size : 0), 0), 0
  )
  const totalWaitlisted = events.reduce((acc, e) => 
    acc + e.bookings.filter(b => b.status === 'waitlisted').length, 0
  )
  
  // Mock constant for tables - should ideally come from public.tables count
  const totalTables = 15 

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-700">
      {/* Section 1: High Level Pulse Check */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Active Events" value={events.length} icon={LayoutGrid} />
        <KPICard label="Total Guests" value={totalGuests} icon={Users} color="amber" />
        <KPICard label="Waitlist Size" value={totalWaitlisted} icon={Clock3} />
        <KPICard label="Event Score" value={`${Math.min(100, Math.round(totalGuests / 5))}%`} icon={TrendingUp} color="green" />
      </section>

      {/* Section 2: Segments */}
      <div className="space-y-10 pb-10">
        
        {/* QUIZ SEGMENT - Detailed Capacity Management */}
        <div className="space-y-4">
          <SectionHeading title="Quiz Operations" icon={Trophy} badge={`${quizEvents.length} Active`} />
          <div className="grid grid-cols-1 gap-3">
            {quizEvents.length === 0 ? (
              <EmptyState message="No Quiz Nights scheduled" icon={Trophy} />
            ) : (
              quizEvents.map(event => {
                const confirmedBookings = event.bookings.filter(b => b.status === 'confirmed')
                const waitlistedCount = event.bookings.filter(b => b.status === 'waitlisted').length
                const confirmedGuestCount = confirmedBookings.reduce((a, b) => a + b.group_size, 0)
                const tablesReserved = confirmedBookings.length
                const occupancy = Math.round((tablesReserved / totalTables) * 100)
                
                return (
                  <Link key={event.id} href={`/dashboard?date=${event.date}`} className="group block bg-white border border-[#E6DFC8] rounded-2xl p-5 shadow-sm hover:border-[#26300D] transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-black text-lg text-[#1F1F1A] uppercase tracking-tight leading-tight">{event.title}</h4>
                        <p className="text-xs text-[#5F624F] font-bold opacity-60 uppercase mt-1">
                          {new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <StatusBadge occupancy={occupancy} />
                    </div>

                    {/* Table Allocation Visualization */}
                    <div className="bg-[#F7F4EA]/50 p-3 rounded-xl border border-[#E6DFC8]/50 mb-4">
                      <div className="flex justify-between text-[10px] font-black uppercase text-[#5F624F] mb-2 px-1">
                        <span>Floor Utilization</span>
                        <span className={cn(occupancy > 90 ? "text-red-600" : "text-[#26300D]")}>
                          {tablesReserved} / {totalTables} Tables Booked
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-white rounded-full overflow-hidden border border-[#E6DFC8]">
                        <div 
                          className={cn("h-full transition-all duration-1000 ease-out", occupancy > 80 ? "bg-red-500" : "bg-[#26300D]")} 
                          style={{ width: `${Math.min(occupancy, 100)}%` }} 
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-4">
                         <StatMini icon={Users} value={confirmedGuestCount} label="Guests" />
                         <StatMini icon={CheckCircle2} value={tablesReserved} label="Teams" color="green" />
                         {waitlistedCount > 0 && <StatMini icon={Clock3} value={waitlistedCount} label="Waiting" color="amber" />}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#26300D] group-hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* BANDS SEGMENT - Performance focused */}
        <div className="space-y-4">
          <SectionHeading title="Live Entertainment" icon={Mic2} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {liveMusic.length === 0 ? (
              <div className="col-span-full">
                <EmptyState message="No bands currently booked" icon={Music} />
              </div>
            ) : (
              liveMusic.map(band => (
                <div key={band.id} className="bg-white border border-[#E6DFC8] rounded-2xl p-4 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Music className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-[#1F1F1A]">{band.title}</p>
                        <p className="text-[10px] font-bold text-[#5F624F] opacity-60 uppercase">{new Date(band.date).toLocaleDateString()}</p>
                      </div>
                   </div>
                   <Button variant="ghost" size="icon" className="rounded-full">
                      <ChevronRight className="w-4 h-4" />
                   </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PRIVATE HIRE SEGMENT - CRM style */}
        <div className="space-y-4">
          <SectionHeading title="Private Hire Enquiries" icon={Lock} />
          <div className="bg-white border-2 border-dashed border-[#E6DFC8] rounded-2xl p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <p className="font-black text-[#1F1F1A] uppercase tracking-tight">Hire Pipeline</p>
              <p className="text-xs text-[#5F624F] font-medium max-w-50 mt-1">Review wedding, party, and corporate hire enquiries.</p>
            </div>
            <Button size="sm" variant="outline" className="rounded-full px-6 font-bold border-[#26300D] text-[#26300D]">
              View {privateHire.length} Requests
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * COMPONENTS
 */

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "amber" | "green" | "default";
}

function KPICard({ label, value, icon: Icon, color = "default" }: KPICardProps) {
  return (
    <div className="bg-white border border-[#E6DFC8] p-4 rounded-2xl shadow-sm space-y-2">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        color === "amber" ? "bg-amber-100 text-amber-700" : 
        color === "green" ? "bg-green-100 text-green-700" :
        "bg-[#F7F4EA] text-[#26300D]"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase text-[#5F624F] tracking-wider truncate">{label}</p>
        <p className="text-xl font-black text-[#1F1F1A] tracking-tighter">{value}</p>
      </div>
    </div>
  )
}

interface SectionHeadingProps {
  title: string;
  icon: LucideIcon;
  badge?: string;
}

function SectionHeading({ title, icon: Icon, badge }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-[#26300D] rounded-xl shadow-sm">
          <Icon className="w-4 h-4 text-[#FDCC4B]" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-[0.15em] text-[#1F1F1A]">{title}</h3>
      </div>
      {badge && (
        <span className="text-[9px] font-black bg-[#FDCC4B] text-[#26300D] px-2.5 py-1 rounded-full shadow-sm border border-[#26300D]/10 uppercase">
          {badge}
        </span>
      )}
    </div>
  )
}

function StatMini({ icon: Icon, value, label, color = "default" }: { icon: LucideIcon, value: number, label: string, color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("w-3.5 h-3.5", color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-slate-400')} />
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-black text-[#1F1F1A]">{value}</span>
        <span className="text-[9px] font-bold text-[#5F624F] uppercase opacity-60 tracking-tighter">{label}</span>
      </div>
    </div>
  )
}

function StatusBadge({ occupancy }: { occupancy: number }) {
  const isFull = occupancy >= 100
  return (
    <div className={cn(
      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
      isFull ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
    )}>
      {isFull ? "At Capacity" : "Open Bookings"}
    </div>
  )
}

function EmptyState({ message, icon: Icon }: { message: string, icon: LucideIcon }) {
  return (
    <div className="py-10 text-center border-2 border-dashed border-[#E6DFC8] rounded-2xl bg-white/40">
      <Icon className="w-8 h-8 text-[#E6DFC8] mx-auto mb-2" />
      <p className="text-[10px] font-black text-[#5F624F] uppercase tracking-widest opacity-40">{message}</p>
    </div>
  )
}