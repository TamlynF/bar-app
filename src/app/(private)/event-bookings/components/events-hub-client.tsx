"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
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
  LucideIcon,
  History,
  CalendarCheck2,
  MessageSquare
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { EventBehavior } from "@/lib/event-behavior"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import styles from "./events-hub-client.module.css"

export interface EventTypeInfo {
  type: string;
  sub_type: string;
  behavior: EventBehavior;
}

export interface BookingInfo {
  status: string;
  group_size: number;
  special_requests?: string;
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
  const [expandedSections, setExpandedSections] = useState({
    quiz: true,
    historicQuiz: false,
    music: false,
    private: false
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const allQuizEvents = initialEvents.filter(e => e.event_types?.behavior === 'quiz')
  
  const today = new Date().toISOString().split('T')[0]
  const { upcomingQuiz, historicQuiz } = useMemo(() => {
    const sorted = [...allQuizEvents].sort((a, b) => a.date.localeCompare(b.date));
    return {
      upcomingQuiz: sorted.filter(e => e.date >= today),
      historicQuiz: sorted.filter(e => e.date < today).reverse() // Show most recent past first
    }
  }, [allQuizEvents, today])

  const liveMusic = initialEvents.filter(e => e.event_types?.behavior === 'music_act')
  const privateHire = initialEvents.filter(e => e.event_types?.behavior === 'private')

  const totalGuests = initialEvents.reduce((acc, e) => 
    acc + e.bookings.reduce((bAcc, b) => bAcc + (b.status === 'confirmed' ? b.group_size : 0), 0), 0
  )
  const totalWaitlisted = initialEvents.reduce((acc, e) => 
    acc + e.bookings.filter(b => b.status === 'waitlisted').length, 0
  )

  return (
    <div className="mx-auto max-w-5xl animate-in space-y-6 px-4 pt-4 pb-24 text-left duration-700 fade-in sm:space-y-8 sm:px-8 sm:pt-0 sm:pb-8">
      
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Active Events" value={initialEvents.length} icon={LayoutGrid} />
        <KPICard label="Total Guests" value={totalGuests} icon={Users} color="amber" />
        <KPICard label="Waitlist Size" value={totalWaitlisted} icon={Clock3} />
        <KPICard label="Event Score" value={`${Math.min(100, Math.round(totalGuests / 5))}%`} icon={TrendingUp} color="green" />
      </section>

      <div className="space-y-5 sm:space-y-6">
        
        <CollapsibleSection 
          title="Upcoming Quizzes" 
          icon={CalendarCheck2} 
          badge={`${upcomingQuiz.length} Live`}
          isOpen={expandedSections.quiz}
          onToggle={() => toggleSection('quiz')}
        >
          <div className="grid grid-cols-1 gap-4 pt-2">
            {upcomingQuiz.length === 0 ? (
              <EmptyState message="No upcoming Quiz Nights" icon={Trophy} />
            ) : (
              upcomingQuiz.map(event => (
                <QuizEventCard 
                  key={event.id} 
                  event={event} 
                  availableTablesCount={availableTablesCount} 
                  isHistoric={false} 
                />
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Historic Quizzes" 
          icon={History} 
          isOpen={expandedSections.historicQuiz}
          onToggle={() => toggleSection('historicQuiz')}
        >
          <div className="grid grid-cols-1 gap-3 pt-2 opacity-80 sm:grid-cols-2">
            {historicQuiz.length === 0 ? (
              <EmptyState message="No previous data found" icon={History} />
            ) : (
              historicQuiz.map(event => (
                <QuizEventCard 
                  key={event.id} 
                  event={event} 
                  availableTablesCount={availableTablesCount} 
                  isHistoric={true} 
                />
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Live Entertainment" 
          icon={Mic2} 
          isOpen={expandedSections.music}
          onToggle={() => toggleSection('music')}
        >
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            {liveMusic.length === 0 ? (
              <div className="col-span-full">
                <EmptyState message="No bands currently booked" icon={Music} />
              </div>
            ) : (
              liveMusic.map(band => (
                <div key={band.id} className="flex items-center justify-between rounded-2xl border border-[#E6DFC8] bg-white p-4 shadow-sm">
                   <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                        <Music className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-[#1F1F1A]">{band.title}</p>
                        <p className="text-[10px] font-bold text-[#5F624F] uppercase opacity-60">{new Date(band.date).toLocaleDateString()}</p>
                      </div>
                   </div>
                   <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <ChevronRight className="h-4 w-4" />
                   </Button>
                </div>
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Private Hire CRM" 
          icon={Lock} 
          isOpen={expandedSections.private}
          onToggle={() => toggleSection('private')}
        >
          <div className="pt-2">
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-[#E6DFC8] bg-white p-6 text-center sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7F4EA] text-[#5F624F]/50">
                <Lock className="h-7 w-7" />
              </div>
              <div>
                <p className="font-black tracking-tight text-[#1F1F1A] uppercase">Hire Pipeline</p>
                <p className="mt-1 max-w-64 text-xs leading-relaxed font-medium text-[#5F624F] opacity-70">Review wedding, party, and corporate hire enquiries for the season.</p>
              </div>
              <Button size="sm" variant="outline" className="h-10 rounded-full border-[#5C4033] px-8 font-black tracking-wide text-[#5C4033] uppercase transition-all hover:bg-[#5C4033] hover:text-white">
                View {privateHire.length} Requests
              </Button>
            </div>
          </div>
        </CollapsibleSection>

      </div>
    </div>
  )
}


function QuizEventCard({ 
  event, 
  availableTablesCount, 
  isHistoric 
}: { 
  event: EventWithDetails, 
  availableTablesCount: number, 
  isHistoric: boolean 
}) {
  const confirmedBookings = event.bookings.filter(b => b.status === 'confirmed')
  const waitlistedCount = event.bookings.filter(b => b.status === 'waitlisted').length
  const specialRequestsCount = event.bookings.filter(b => b.special_requests && b.special_requests.trim() !== "").length
  const confirmedGuestCount = confirmedBookings.reduce((a, b) => a + b.group_size, 0)
  const tablesReserved = confirmedBookings.length
  
  const eventTotalTables = event.seating_required ? availableTablesCount : 0
  const occupancy = eventTotalTables > 0 ? Math.round((tablesReserved / eventTotalTables) * 100) : 0

  return (
    <Link 
      href={`/dashboard?date=${event.date}`} 
      className={cn(
        "group block rounded-2xl border border-[#E6DFC8] bg-white p-4 shadow-sm transition-all active:scale-[0.99] sm:p-5",
        isHistoric ? "hover:border-[#E6DFC8]" : "hover:border-[#5C4033] hover:shadow-md"
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0 pr-2">
          <div className="mb-1 flex items-center gap-2">
             <h4 className="truncate font-black text-base leading-tight tracking-tight text-[#1F1F1A] uppercase sm:text-lg">{event.title}</h4>
             {specialRequestsCount > 0 && !isHistoric && (
               <div className="flex items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 shadow-sm">
                  <MessageSquare className="mr-1 h-3 w-3 text-white" />
                  <span className="font-black text-[9px] text-white">{specialRequestsCount}</span>
               </div>
             )}
          </div>
          <p className="text-[10px] font-bold text-[#5F624F] uppercase opacity-60">
            {new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: isHistoric ? 'numeric' : undefined })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge occupancy={occupancy} isHistoric={isHistoric} />
          {isHistoric && <span className="text-[10px] font-bold tracking-wide text-[#5F624F]/50 uppercase">Completed</span>}
        </div>
      </div>

      {!isHistoric && (
        <div className="mb-4 rounded-xl border border-[#E6DFC8]/50 bg-[#F7F4EA]/50 p-3">
          <div className="mb-2 flex justify-between px-1 font-black text-[9px] text-[#5F624F] uppercase">
            <span>Floor Utilization</span>
            <span className={cn(occupancy > 90 ? "text-red-600" : "text-[#5C4033]")}>
              {tablesReserved} / {eventTotalTables} Tables
            </span>
          </div>
          <ProgressBar occupancy={occupancy} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <StatMini icon={Users} value={confirmedGuestCount} label="Guests" />
          <StatMini icon={CheckCircle2} value={tablesReserved} label="Teams" color={isHistoric ? "default" : "green"} />
          {waitlistedCount > 0 && (
            <StatMini 
              icon={Clock3} 
              value={waitlistedCount} 
              label="Wait" 
              color={isHistoric ? "default" : "amber"} 
            />
          )}
        </div>
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F4EA] transition-colors",
          !isHistoric && "group-hover:bg-[#5C4033] group-hover:text-white"
        )}>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  )
}

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
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center justify-between rounded-xl px-1 outline-none focus-visible:ring-2 focus-visible:ring-[#5C4033]"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#5C4033] p-2 shadow-sm transition-transform group-active:scale-95">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-black text-xs tracking-[0.15em] text-[#1F1F1A] uppercase sm:text-sm">{title}</h3>
            {badge && (
              <span className="rounded-full border border-[#5C4033]/10 bg-[#C8956D] px-2 py-0.5 font-black text-[10px] text-[#5C4033] uppercase shadow-sm">
                {badge}
              </span>
            )}
          </div>
        </div>
        <div className={cn("transition-transform duration-300", isOpen ? "rotate-0" : "rotate-180")}>
          <ChevronDown className="h-5 w-5 text-[#5F624F] opacity-40 group-hover:opacity-100" />
        </div>
      </button>
      
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
    <div className="space-y-2 rounded-2xl border border-[#E6DFC8] bg-white p-3 shadow-sm sm:p-4">
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg",
        color === "amber" ? "bg-amber-100 text-amber-700" : 
        color === "green" ? "bg-green-100 text-green-700" :
        "bg-[#F7F4EA] text-[#5C4033]"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="truncate font-black text-[9px] tracking-wider text-[#5F624F] uppercase">{label}</p>
        <p className="font-black text-lg tracking-tighter text-[#1F1F1A] sm:text-xl">{value}</p>
      </div>
    </div>
  )
}

function StatMini({ icon: Icon, value, label, color = "default" }: { icon: LucideIcon, value: number, label: string, color?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className={cn("h-3 w-3", color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-[#5F624F]/50')} />
      <div className="flex items-baseline gap-1">
        <span className="font-black text-xs text-[#1F1F1A]">{value}</span>
        <span className="text-[10px] font-bold tracking-tighter text-[#5F624F] uppercase opacity-60">{label}</span>
      </div>
    </div>
  )
}

function StatusBadge({ occupancy, isHistoric }: { occupancy: number, isHistoric: boolean }) {
  if (isHistoric) {
    return (
      <div className="shrink-0 rounded-full border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 font-black text-[10px] tracking-wide text-[#5F624F]/50 uppercase sm:px-3 sm:text-[9px]">
        Closed
      </div>
    )
  }

  const isFull = occupancy >= 100
  return (
    <div className={cn(
      "shrink-0 rounded-full border px-2 py-1 font-black text-[10px] tracking-wide uppercase sm:px-3 sm:text-[9px]",
      isFull ? "border-red-200 bg-red-50 text-red-600" : "border-green-200 bg-green-50 text-green-600"
    )}>
      {isFull ? "Full" : "Open"}
    </div>
  )
}

function EmptyState({ message, icon: Icon }: { message: string, icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#E6DFC8] bg-white/40 py-8 text-center">
      <Icon className="mx-auto mb-2 h-6 w-6 text-[#E6DFC8]" />
      <p className="font-black text-[9px] tracking-wide text-[#5F624F] uppercase opacity-40">{message}</p>
    </div>
  )
}
