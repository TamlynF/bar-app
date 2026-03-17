'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

// Using relative path for internal actions to resolve build errors
import { 
  generateQuizAction, 
  saveQuizToDatabase, 
  getUpcomingQuizzesAction,
  getQuizCategoryConfigsAction,
  getFullQuestionHistoryAction,
  type QuizEventSummary,
  type QuizCategoryConfig,
  type PastQuestionRecord
} from '@/app/(private)/quiz-generator/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Sparkles, 
  CheckCircle2, 
  BrainCircuit, 
  Loader2, 
  AlertCircle,
  MessageSquareQuote,
  BookOpen,
  ChevronDown,
  History,
  CalendarCheck,
  CheckCircle,
  Check,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

export default function QuizGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [category, setCategory] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [upcomingEvents, setUpcomingEvents] = useState<QuizEventSummary[]>([])
  const [categories, setCategories] = useState<QuizCategoryConfig[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [eventHistory, setEventHistory] = useState<PastQuestionRecord[]>([])
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [events, categoryConfigs] = await Promise.all([
          getUpcomingQuizzesAction(),
          getQuizCategoryConfigsAction()
        ]);
        
        setUpcomingEvents(events);
        setCategories(categoryConfigs);

        if (events.length > 0) {
          const firstEventId = String(events[0].id);
          setSelectedEventId(firstEventId);
          loadEventHistory(firstEventId);
        }

        if (categoryConfigs.length > 0) {
          setCategory(categoryConfigs[0].category_name);
          setNumQuestions(categoryConfigs[0].question_count);
        }
      } catch (err) {
        console.error("Failed to load setup data:", err);
        toast.error("Could not load categories or events from database");
      }
    }
    loadInitialData();
  }, [])

  const loadEventHistory = async (eventId: string) => {
    if (!eventId) return;
    try {
      const history = await getFullQuestionHistoryAction(eventId);
      setEventHistory(history);
    } catch (err) {
      console.error("Failed to load history for event:", err);
    }
  };

  // Derived state for category progress relative to the selected quiz night
  const categoryStats = useMemo(() => {
    return categories.map(config => {
      const currentCount = eventHistory.filter((q: PastQuestionRecord) => {
        const qCat = q.quiz_category_configs?.category_name || q.category;
        return qCat?.toLowerCase() === config.category_name.toLowerCase();
      }).length;
      
      return {
        ...config,
        currentCount,
        isFull: currentCount >= config.question_count
      };
    });
  }, [categories, eventHistory]);

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedEventId(id);
    loadEventHistory(id);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    setCategory(selectedName);
    const config = categories.find(c => c.category_name === selectedName);
    if (config) setNumQuestions(config.question_count);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isLoading) return
    
    const stats = categoryStats.find(s => s.category_name === category);
    
    if (stats?.isFull) {
      toast.error(`${category} is already full for this event.`);
      return;
    }

    setIsLoading(true)
    setError('')
    
    try {
      const generated = await generateQuizAction(topic, category, numQuestions)
      setQuestions(generated)
      setSelectedIndices(new Set(generated.map((_, i) => i)))
      toast.success("Draft round generated!")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed.')
      toast.error("AI Master is unavailable")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    const selectedData = questions.filter((_, i) => selectedIndices.has(i))
    if (selectedData.length === 0 || isSaving) return
    
    if (!selectedEventId) {
      toast.error("Select a Quiz Event first.");
      return
    }

    setIsSaving(true)
    try {
      await saveQuizToDatabase(selectedData, parseInt(selectedEventId))
      const eventName = upcomingEvents.find(e => String(e.id) === selectedEventId)?.title || 'Event'
      toast.success(`Approved ${selectedData.length} items for ${eventName}!`)
      setQuestions([])
      setSelectedIndices(new Set())
      setTopic('')
      loadEventHistory(selectedEventId); // Refresh progress indicators
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save to database.'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredQuestions = useMemo(() => {
    if (!filterCategory) return questions;
    return questions.filter(q => q.category.toLowerCase() === filterCategory.toLowerCase());
  }, [questions, filterCategory]);

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 animate-in fade-in duration-700 pb-32 text-left">
      
      {/* HEADER SECTION - ULTRA COMPACT FOR MOBILE */}
      <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8]/40 pb-3 sm:pb-0 sm:border-none">

        <Link 
          href="/quiz-generator/history" 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6DFC8] bg-white text-[#5F624F] font-bold text-[9px] uppercase tracking-wider hover:bg-[#26300D]/5 transition-all shadow-xs shrink-0"
        >
          <History className="w-3.5 h-3.5" />
          <span className="xs:inline">View Past Questions</span>
        </Link>
      </div>

      {/* CATEGORY PROGRESS INDICATORS */}
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
        {categoryStats.map((stat) => (
          <button
            key={stat.id}
            type="button"
            onClick={() => setFilterCategory(filterCategory === stat.category_name ? null : stat.category_name)}
            className={cn(
              "flex flex-col gap-1 px-2.5 py-2 rounded-xl border-2 transition-all text-left relative overflow-hidden",
              stat.isFull 
                ? "bg-emerald-50/50 border-emerald-200" 
                : "bg-white border-[#E6DFC8] hover:border-[#26300D]",
              filterCategory === stat.category_name && "ring-2 ring-offset-1 ring-[#26300D] border-[#26300D] z-10"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                "text-[8px] sm:text-[9px] font-black uppercase tracking-tight truncate",
                stat.isFull ? "text-emerald-700" : "text-[#5F624F]"
              )}>
                {stat.category_name}
              </span>
              {stat.isFull ? (
                <CheckCircle className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
              ) : (
                <span className="text-[8px] font-black text-[#26300D]/30 tabular-nums">
                  {stat.currentCount}/{stat.question_count}
                </span>
              )}
            </div>
            
            {/* Minimal Progress Bar */}
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-700", stat.isFull ? "bg-emerald-500" : "bg-[#26300D]")}
                style={{ width: `${Math.min(100, (stat.currentCount / stat.question_count) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* COMPACT CONFIGURATION ROW - IMPROVED FOR MOBILE DEVICE SCREENS */}
      <div className="bg-white border-2 border-[#E6DFC8] p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm">
        <form onSubmit={handleGenerate} className="flex flex-col gap-3 lg:flex-row lg:items-end">
          
          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 flex-grow">
            {/* Event Selection */}
            <div className="col-span-2 sm:col-span-4 space-y-1">
              <Label className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-[#5F624F] ml-1 flex items-center gap-1">
                 <CalendarCheck className="w-2.5 h-2.5" /> Event
              </Label>
              <div className="relative">
                <select 
                  title='Event'
                  value={selectedEventId}
                  onChange={handleEventChange}
                  className="w-full h-9 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA]/40 px-2.5 text-[11px] font-black text-[#26300D] appearance-none outline-none focus:border-[#26300D] transition-all uppercase truncate"
                >
                  {upcomingEvents.map(event => (
                    <option key={event.id} value={event.id}>{event.title} — {format(new Date(event.date), "dd/MM")}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#26300D] opacity-40 pointer-events-none" />
              </div>
            </div>

            {/* Category Selection */}
            <div className="col-span-1 sm:col-span-3 space-y-1">
              <Label className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Category</Label>
              <div className="relative">
                <select 
                  title='Category'
                  value={category}
                  onChange={handleCategoryChange}
                  className="w-full h-9 rounded-lg border border-[#E6DFC8] bg-white px-2.5 text-[11px] font-bold appearance-none outline-none focus:border-[#26300D] transition-all uppercase truncate"
                >
                  {categories.map(opt => (
                    <option key={opt.id} value={opt.category_name}>{opt.category_name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#5F624F] opacity-40 pointer-events-none" />
              </div>
            </div>

            {/* Topic Input - Grouped with Roll button for space efficiency */}
            <div className="col-span-1 sm:col-span-5 space-y-1">
              <Label className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Topic</Label>
              <div className="flex gap-1.5">
                <Input 
                  placeholder="e.g. Disney, 90s..." 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="h-9 rounded-lg border-[#E6DFC8] bg-white text-[11px] font-bold focus:ring-0 focus:border-[#26300D] px-2.5 min-w-0 flex-grow"
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || categories.length === 0} 
                  className="h-9 rounded-lg bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-widest text-[8px] px-3 shadow-sm active:scale-95 transition-all shrink-0"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 p-2.5 rounded-xl flex items-center gap-2.5 text-red-700 animate-in slide-in-from-top-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <p className="text-[9px] font-bold leading-tight uppercase">{error}</p>
        </div>
      )}

      {/* DRAFT RESULTS SECTION */}
      {questions.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          
          {/* STICKY ACTION BAR */}
          <div className="flex items-center justify-between bg-[#26300D] p-2.5 rounded-2xl shadow-xl border border-white/5 sticky top-16 z-20">
             <div className="flex items-center gap-3 px-1">
                <div className="bg-[#FDCC4B] text-[#26300D] w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs">
                   {selectedIndices.size}
                </div>
                <div className="flex flex-col">
                   <span className="text-[#FDCC4B] text-[8px] font-black uppercase tracking-wider leading-none">Draft Items</span>
                   {filterCategory && (
                     <span className="text-white/40 text-[7px] font-bold uppercase mt-1 flex items-center gap-1">
                       <CheckCircle className="w-2 h-2" /> {filterCategory}
                     </span>
                   )}
                </div>
             </div>

             <div className="flex items-center gap-2">
                {filterCategory && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFilterCategory(null)}
                    className="h-8 text-white/50 text-[7px] font-black uppercase tracking-widest px-2 hover:text-white"
                  >
                    Clear Filter
                  </Button>
                )}
                <Button 
                  variant="default" 
                  onClick={handleSave} 
                  disabled={isSaving || selectedIndices.size === 0} 
                  className="h-8 bg-[#FDCC4B] text-[#26300D] px-4 font-black uppercase text-[8px] tracking-widest rounded-xl hover:bg-[#e5b843] active:scale-95 transition-transform"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Approve Round"}
                </Button>
             </div>
          </div>

          {/* DRAFT CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredQuestions.map((q, idx) => {
              const originalIndex = questions.indexOf(q);
              const isSelected = selectedIndices.has(originalIndex);
              return (
                <div 
                  key={idx} 
                  onClick={() => {
                    const next = new Set(selectedIndices);
                    if (next.has(originalIndex)) next.delete(originalIndex);
                    else next.add(originalIndex);
                    setSelectedIndices(next);
                  }}
                  className={cn(
                    "group relative flex flex-col bg-white border-2 rounded-2xl transition-all cursor-pointer select-none overflow-hidden",
                    isSelected 
                      ? "border-[#26300D] shadow-md translate-y-[-1px]" 
                      : "border-transparent border-dashed border-[#E6DFC8] opacity-50 hover:opacity-100"
                  )}
                >
                  <div className="px-5 py-4 space-y-4 relative">
                    {/* Floating Selection Indicator - Absolute Positioned with Space from Text */}
                    <div className={cn(
                      "absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10",
                      isSelected 
                        ? "bg-[#26300D] border-[#26300D] text-[#FDCC4B] scale-110 shadow-sm" 
                        : "bg-white border-[#E6DFC8] text-[#E6DFC8]"
                    )}>
                      {isSelected ? <Check className="w-3 h-3 stroke-[4]" /> : <Plus className="w-3 h-3" />}
                    </div>

                    {/* Question Content - Added right padding to prevent overlap with indicator */}
                    <div className="flex items-start gap-2.5 pr-10">
                      <MessageSquareQuote className="w-4 h-4 text-[#26300D] shrink-0 opacity-10 mt-0.5" />                                      
                       <p className="text-[13px] font-black text-[#1F1F1A] leading-snug tracking-tight">
                         {q.question}
                       </p>
                    </div>
                    
                    {/* Answer Content - Center Aligned, Compact Padding, and Updated Backgrounds */}
                    <div className={cn(
                      "p-2.5 rounded-xl border transition-all duration-500 text-center",
                      isSelected 
                        ? "bg-[#FDCC4B]/20 border-[#FDCC4B]/40" 
                        : "bg-[#F7F4EA] border-[#E6DFC8]/40"
                    )}>
                      <p className="text-[12px] font-black text-[#26300D] leading-tight">
                        {q.answer}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && questions.length === 0 && (
        <div className="py-16 text-center border-2 border-dashed border-[#E6DFC8] rounded-[2rem] bg-white/40 flex flex-col items-center">
           <BookOpen className="w-8 h-8 text-[#26300D]/10 mb-2.5" />
           <p className="text-[8px] sm:text-[9px] text-[#5F624F] uppercase tracking-[0.25em] font-black opacity-40">Select parameters to draft a round</p>
        </div>
      )}
    </div>
  )
}
