"use client"

import React, { useState, useRef, useEffect } from "react"
import { 
  Trophy, 
  Mic2, 
  Lock, 
  Users, 
  ChevronRight, 
  ChevronDown,
  CheckCircle2, 
  Clock3, 
  LayoutGrid,
  TrendingUp,
  Music,
  LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import styles from "./events-hub-client.module.css"

export interface EventTypeInfo {
  type: string;
  sub_type: string;
}

export interface BookingInfo {
  status: string;
  group_size: number;
}

export interface EventWithDetails {
  id: string;
  date: string;
  title: string;
  seating_required: boolean;
  event_types: EventTypeInfo;
  bookings: BookingInfo[];
}

function ProgressBar({ occupancy }: { occupancy: number }) {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fillRef.current) {
      const percentage = `${Math.min(occupancy, 100)}%`;
      fillRef.current.style.setProperty("--progress-width", percentage);
    }
  }, [occupancy]);

  return (
    <div className={styles.progressBarTrack}>
      <div 
        ref={fillRef}
        className={cn(
          styles.progressFill, 
          occupancy > 80 && styles.highOccupancy
        )} 
      />
    </div>
  );
}

export default function EventsHubClient({ 
  initialEvents,
  availableTablesCount 
}: { 
  initialEvents: EventWithDetails[],
  availableTablesCount: number
}) {
  // Mobile-first: Default to collapsed for secondary sections
  const [expandedSections, setExpandedSections] = useState({
    quiz: true,
    music: false,
    private: false
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Aggregate stats for events
  const quizEvents = initialEvents.filter(e => e.event_types?.sub_type === 'quiz')
  const liveMusic = initialEvents.filter(e => e.event_types?.type === 'music')
  const privateHire = initialEvents.filter(e => e.event_types?.type === 'private')

  const totalGuests = initialEvents.reduce((acc, e) => 
    acc + e.bookings.reduce((bAcc, b) => bAcc + (b.status === 'confirmed' ? b.group_size : 0), 0), 0
  )
  const totalWaitlisted = initialEvents.reduce((acc, e) => 
    acc + e.bookings.filter(b => b.status === 'waitlisted').length, 0
  )

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-700 max-w-5xl mx-auto pb-24 sm:pb-8 text-left">
      
      {/* KPI Stats Grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Active Events" value={initialEvents.length} icon={LayoutGrid} />
        <KPICard label="Total Guests" value={totalGuests} icon={Users} color="amber" />
        <KPICard label="Waitlist Size" value={totalWaitlisted} icon={Clock3} />
        <KPICard label="Event Score" value={`${Math.min(100, Math.round(totalGuests / 5))}%`} icon={TrendingUp} color="green" />
      </section>

      <div className="space-y-5 sm:space-y-6">
        
        {/* QUIZ SECTION */}
        <CollapsibleSection 
          title="Quiz Bookings" 
          icon={Trophy} 
          badge={`${quizEvents.length} Active`}
          isOpen={expandedSections.quiz}
          onToggle={() => toggleSection('quiz')}
        >
          <div className="grid grid-cols-1 gap-3 pt-2">
            {quizEvents.length === 0 ? (
              <EmptyState message="No Quiz Nights scheduled" icon={Trophy} />
            ) : (
              quizEvents.map(event => {
                const confirmedBookings = event.bookings.filter(b => b.status === 'confirmed')
                const waitlistedCount = event.bookings.filter(b => b.status === 'waitlisted').length
                const confirmedGuestCount = confirmedBookings.reduce((a, b) => a + b.group_size, 0)
                const tablesReserved = confirmedBookings.length
                
                // NEW LOGIC: totalTables is 0 if seating not required, otherwise use venue available count
                const eventTotalTables = event.seating_required ? availableTablesCount : 0
                const occupancy = eventTotalTables > 0 ? Math.round((tablesReserved / eventTotalTables) * 100) : 0
                
                return (
                  <Link key={event.id} href={`/dashboard?date=${event.date}`} className="group block bg-white border border-[#E6DFC8] rounded-2xl p-4 sm:p-5 shadow-sm hover:border-[#26300D] transition-all hover:shadow-md active:scale-[0.99]">
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0 pr-2">
                        <h4 className="font-black text-base sm:text-lg text-[#1F1F1A] uppercase tracking-tight truncate leading-tight">{event.title}</h4>
                        <p className="text-[10px] text-[#5F624F] font-bold opacity-60 uppercase mt-1">
                          {new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <StatusBadge occupancy={occupancy} />
                    </div>

                   <div className="bg-[#F7F4EA]/50 p-3 rounded-xl border border-[#E6DFC8]/50 mb-4">
                      <div className="flex justify-between text-[9px] font-black uppercase text-[#5F624F] mb-2 px-1">
                        <span>Floor Utilization</span>
                        <span className={cn(occupancy > 90 ? "text-red-600" : "text-[#26300D]")}>
                          {tablesReserved} / {eventTotalTables} Tables
                        </span>
                      </div>
                      <ProgressBar occupancy={occupancy} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-4">
                         <StatMini icon={Users} value={confirmedGuestCount} label="Guests" />
                         <StatMini icon={CheckCircle2} value={tablesReserved} label="Teams" color="green" />
                         {waitlistedCount > 0 && <StatMini icon={Clock3} value={waitlistedCount} label="Wait" color="amber" />}
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
        </CollapsibleSection>

        {/* BANDS SECTION */}
        <CollapsibleSection 
          title="Live Entertainment" 
          icon={Mic2} 
          isOpen={expandedSections.music}
          onToggle={() => toggleSection('music')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {liveMusic.length === 0 ? (
              <div className="col-span-full">
                <EmptyState message="No bands currently booked" icon={Music} />
              </div>
            ) : (
              liveMusic.map(band => (
                <div key={band.id} className="bg-white border border-[#E6DFC8] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Music className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-[#1F1F1A]">{band.title}</p>
                        <p className="text-[10px] font-bold text-[#5F624F] opacity-60 uppercase">{new Date(band.date).toLocaleDateString()}</p>
                      </div>
                   </div>
                   <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                      <ChevronRight className="w-4 h-4" />
                   </Button>
                </div>
              ))
            )}
          </div>
        </CollapsibleSection>

        {/* PRIVATE HIRE SECTION */}
        <CollapsibleSection 
          title="Private Hire CRM" 
          icon={Lock} 
          isOpen={expandedSections.private}
          onToggle={() => toggleSection('private')}
        >
          <div className="pt-2">
            <div className="bg-white border-2 border-dashed border-[#E6DFC8] rounded-2xl p-6 sm:p-10 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                <Lock className="w-7 h-7" />
              </div>
              <div>
                <p className="font-black text-[#1F1F1A] uppercase tracking-tight">Hire Pipeline</p>
                <p className="text-xs text-[#5F624F] font-medium max-w-64 mt-1 opacity-70 leading-relaxed">Review wedding, party, and corporate hire enquiries for the season.</p>
              </div>
              <Button size="sm" variant="outline" className="rounded-full px-8 h-10 font-black uppercase tracking-widest border-[#26300D] text-[#26300D] hover:bg-[#26300D] hover:text-white transition-all">
                View {privateHire.length} Requests
              </Button>
            </div>
          </div>
        </CollapsibleSection>

      </div>
    </div>
  )
}

/**
 * REUSABLE INTERNAL COMPONENTS
 */

function CollapsibleSection({ 
  title, 
  icon: Icon, 
  badge, 
  children, 
  isOpen, 
  onToggle 
}: { 
  title: string; 
  icon: LucideIcon; 
  badge?: string; 
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Header acting as the toggle button */}
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1 group outline-none focus-visible:ring-2 focus-visible:ring-[#26300D] rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#26300D] rounded-xl shadow-sm group-active:scale-95 transition-transform">
            <Icon className="w-4 h-4 text-[#FDCC4B]" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] text-[#1F1F1A]">{title}</h3>
            {badge && (
              <span className="text-[8px] font-black bg-[#FDCC4B] text-[#26300D] px-2 py-0.5 rounded-full shadow-sm border border-[#26300D]/10 uppercase">
                {badge}
              </span>
            )}
          </div>
        </div>
        <div className={cn("transition-transform duration-300", isOpen ? "rotate-0" : "rotate-180")}>
          <ChevronDown className="w-5 h-5 text-[#5F624F] opacity-40 group-hover:opacity-100" />
        </div>
      </button>
      
      {/* Animated container using grid-rows for smooth height transition */}
      <div className={cn(
        styles.collapsibleContainer,
        isOpen ? styles.expanded : styles.collapsed
      )}>
        <div className={styles.collapsibleInner}>
          {children}
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon: Icon, color = "default" }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
  return (
    <div className="bg-white border border-[#E6DFC8] p-3 sm:p-4 rounded-2xl shadow-sm space-y-2">
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
        <p className="text-lg sm:text-xl font-black text-[#1F1F1A] tracking-tighter">{value}</p>
      </div>
    </div>
  )
}

function StatMini({ icon: Icon, value, label, color = "default" }: { icon: LucideIcon, value: number, label: string, color?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className={cn("w-3 h-3", color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-slate-400')} />
      <div className="flex items-baseline gap-1">
        <span className="text-xs font-black text-[#1F1F1A]">{value}</span>
        <span className="text-[8px] font-bold text-[#5F624F] uppercase opacity-60 tracking-tighter">{label}</span>
      </div>
    </div>
  )
}

function StatusBadge({ occupancy }: { occupancy: number }) {
  const isFull = occupancy >= 100
  return (
    <div className={cn(
      "px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shrink-0",
      isFull ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
    )}>
      {isFull ? "Full" : "Open"}
    </div>
  )
}

function EmptyState({ message, icon: Icon }: { message: string, icon: LucideIcon }) {
  return (
    <div className="py-8 text-center border-2 border-dashed border-[#E6DFC8] rounded-2xl bg-white/40">
      <Icon className="w-6 h-6 text-[#E6DFC8] mx-auto mb-2" />
      <p className="text-[9px] font-black text-[#5F624F] uppercase tracking-widest opacity-40">{message}</p>
    </div>
  )
}
