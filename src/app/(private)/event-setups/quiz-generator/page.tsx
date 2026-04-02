'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import styles from './quiz-generator.module.css'

// Using relative paths to resolve build errors and environment pathing issues
import { 
  generateQuizAction, 
  saveQuizToDatabase, 
  getUpcomingQuizzesAction,
  getQuizCategoryConfigsAction,
  getFullQuestionHistoryAction,
  updatePastQuestionAction,
  deletePastQuestionAction
} from '@/app/(private)/event-setups/quiz-generator/actions'

import type { 
  QuizEventSummary, 
  QuizCategoryConfig, 
  PastQuestionRecord 
} from '@/app/(private)/event-setups/quiz-generator/actions'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { 
  Sparkles, 
  Loader2, 
  AlertCircle,
  MessageSquareQuote,
  BookOpen,
  ChevronDown,
  History,
  CalendarCheck,
  Check,
  Plus,
  CheckCircle,
  Target,
  Edit2,
  Trash2,
  Save
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

interface CategoryStat extends QuizCategoryConfig {
  currentCount: number;
  isFull: boolean;
  progress: number;
}

export default function QuizGeneratorPage() {
  const searchParams = useSearchParams()
  const presetEventId = searchParams.get('event_id')
  const presetCategory = searchParams.get('category')

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
  
  // State for category detail popup and inline editing
  const [viewingCategory, setViewingCategory] = useState<CategoryStat | null>(null)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ question: '', answer: '' })
  const [isActionPending, setIsActionPending] = useState(false)

  // Ref to handle scrolling the detail popup to the top
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

        // Event: prefer URL param, fallback to first
        const targetEventId = presetEventId && events.some(e => String(e.id) === presetEventId)
          ? presetEventId
          : events.length > 0 ? String(events[0].id) : '';
        if (targetEventId) {
          setSelectedEventId(targetEventId);
          loadEventHistory(targetEventId);
        }

        // Category: prefer URL param, fallback to first
        const targetCategory = presetCategory && categoryConfigs.some(c => c.category_name === presetCategory)
          ? presetCategory
          : categoryConfigs.length > 0 ? categoryConfigs[0].category_name : '';
        if (targetCategory) {
          setCategory(targetCategory);
          const config = categoryConfigs.find(c => c.category_name === targetCategory);
          if (config) setNumQuestions(config.question_count);
        }
      } catch (err) {
        console.error("Failed to load setup data:", err);
        toast.error("Could not load categories or events from database");
      }
    }
    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Force scroll reset when category details open
  useEffect(() => {
    if (viewingCategory) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [viewingCategory]);

  const loadEventHistory = async (eventId: string) => {
    if (!eventId) return;
    try {
      const history = await getFullQuestionHistoryAction(eventId);
      setEventHistory(history);
    } catch (err) {
      console.error("Failed to load history for event:", err);
    }
  };

  // Derived state: Includes ALL categories from config even if they have 0 questions
  const categoryStats = useMemo((): CategoryStat[] => {
    if (!categories.length) return [];
    return categories.map(config => {
      const currentCount = eventHistory.filter((q: PastQuestionRecord) => {
        const qCat = q.quiz_category_configs?.category_name || q.category;
        return qCat?.toLowerCase() === config.category_name.toLowerCase();
      }).length;
      
      return {
        ...config,
        currentCount,
        isFull: currentCount >= config.question_count,
        progress: Math.min(100, (currentCount / config.question_count) * 100)
      };
    });
  }, [categories, eventHistory]);

  const currentCategoryIsFull = useMemo(() => {
    const stats = categoryStats.find(s => s.category_name === category);
    return stats?.isFull || false;
  }, [category, categoryStats]);

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedEventId(id);
    loadEventHistory(id);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    //console.log("Category selection changed:", selectedName);
    setCategory(selectedName);
    const config = categories.find(c => c.category_name === selectedName);
    if (config) setNumQuestions(config.question_count);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return
    
    if (currentCategoryIsFull) {
      toast.error(`${category} is already full for this event.`);
      return;
    }
    
    setIsLoading(true)
    setError('')
    try {
      const result = await generateQuizAction(topic, category, numQuestions)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        toast.error(result.error)
      } else if (result && 'questions' in result && result.questions) {
        setQuestions(result.questions)
        setSelectedIndices(new Set(result.questions.map((_, i) => i)))
        toast.success("Draft round generated!")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed.'
      setError(msg)
      toast.error("The AI Master encountered an issue")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    //console.log("Save button clicked with selected indices:", selectedIndices);
    const selectedData = questions.filter((_, i) => selectedIndices.has(i))
    if (selectedData.length === 0 || isSaving) return
    if (!selectedEventId) {
      toast.error("Select a Quiz Event first.");
      return
    }
    setIsSaving(true)
    try {
      // Pass the 'topic' state value to the save action
      await saveQuizToDatabase(selectedData, parseInt(selectedEventId), topic)
      
      const eventName = upcomingEvents.find(e => String(e.id) === selectedEventId)?.title || 'Event'
      toast.success(`Approved ${selectedData.length} items for ${eventName}!`)
      setQuestions([])
      setSelectedIndices(new Set())
      setTopic('')
      loadEventHistory(selectedEventId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save to database.'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  // --- Inline Actions for existing questions ---

  const startEditing = (record: PastQuestionRecord) => {
    setEditingQuestionId(record.id)
    setEditForm({ question: record.question_text, answer: record.answer_text })
  }

  const cancelEditing = () => {
    setEditingQuestionId(null)
    setEditForm({ question: '', answer: '' })
  }

  const saveEdit = async (id: string) => {
    if (!editForm.question || !editForm.answer) {
      toast.error("Fields cannot be empty")
      return
    }
    setIsActionPending(true)
    try {
      await updatePastQuestionAction(id, editForm.question, editForm.answer)
      toast.success("Question updated")
      await loadEventHistory(selectedEventId)
      setEditingQuestionId(null)
    } catch (err) {
      toast.error("Update failed")
    } finally {
      setIsActionPending(false)
    }
  }

  const deleteQuestion = async (id: string) => {
    setIsActionPending(true)
    try {
      await deletePastQuestionAction(id)
      toast.success("Question removed")
      await loadEventHistory(selectedEventId)
    } catch (err) {
      toast.error("Delete failed")
    } finally {
      setIsActionPending(false)
    }
  }

  const filteredQuestions = useMemo(() => {
    //console.log("Filtering questions with filterCategory:", filterCategory, " and questions:", questions);
    if (!filterCategory) return questions;
    return questions.filter(q => q.category.toLowerCase() === filterCategory.toLowerCase());
  }, [questions, filterCategory]);

  // Questions specifically for the viewing category detail popup
  const savedQuestionsForCategory = useMemo(() => {
    if (!viewingCategory) return [];
    return eventHistory.filter((q: PastQuestionRecord) => {
      const qCat = q.quiz_category_configs?.category_name || q.category;
      return qCat?.toLowerCase() === viewingCategory.category_name.toLowerCase();
    });
  }, [viewingCategory, eventHistory]);

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 animate-in fade-in duration-700 pb-32 text-left">
      
      {/* HEADER: Archive Shortcut */}
      <div className="flex items-center justify-end">
        <Link 
          href="/event-setups/quiz-history" 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6DFC8] bg-white text-[#5F624F] font-bold text-[9px] uppercase tracking-wider hover:bg-[#26300D]/5 transition-all shadow-xs"
        >
          <History className="w-3.5 h-3.5" />
          <span>History Archive</span>
        </Link>
      </div>

      {/* CATEGORY PROGRESS INDICATORS */}
      <div className={styles.pillsContainer}>
        {categoryStats.map((stat) => {
          const isFull = stat.isFull;
          const hasQuestions = stat.currentCount > 0;
          
          return (
            <button
              key={stat.id}
              type="button"
              onClick={() => setViewingCategory(stat)}
              className={cn(
                styles.pill,
                isFull ? styles.pillFull : hasQuestions ? styles.pillPartial : styles.pillEmpty,
                filterCategory === stat.category_name && styles.pillActive
              )}
            >
              {/* Top Row: Name & Fraction */}
              <div className={styles.headerRow}>
                <span className={cn(
                  styles.catName,
                  isFull ? styles.textFull : hasQuestions ? styles.textPartial : styles.textEmpty
                )}>
                  {stat.category_name}
                </span>
                
                {isFull ? (
                  <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : (
                  <span className={cn(
                    styles.statsText,
                    hasQuestions ? styles.statsTextPartial : styles.statsTextEmpty
                  )}>
                    {stat.currentCount}/{stat.question_count}
                  </span>
                )}
              </div>
              
              {/* Bottom Row: Full-width Progress Bar */}
              <div className={cn(
                styles.barTrack,
                isFull ? styles.trackFull : hasQuestions ? styles.trackPartial : styles.trackEmpty
              )}>
                <div 
                  className={cn(
                    styles.barFill,
                    isFull ? styles.fillFull : hasQuestions ? styles.fillPartial : styles.fillEmpty
                  )}
                  style={{ '--progress-width': `${stat.progress}%` } as React.CSSProperties}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* POPUP: Category Details Sheet with Edit/Delete */}
      <Sheet open={!!viewingCategory} onOpenChange={(open) => {
        if(!open) {
          setViewingCategory(null)
          cancelEditing()
        }
      }}>
        <SheetContent 
          side="bottom" 
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh] flex flex-col outline-none shadow-2xl"
        >
          {viewingCategory && (
            <>
              <SheetHeader className="p-6 pb-4 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-20 text-left shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                        viewingCategory.isFull ? "bg-emerald-100 text-emerald-700" : "bg-[#FDCC4B] text-[#26300D]"
                      )}>
                        {viewingCategory.isFull ? "Round Complete" : "Round In Progress"}
                      </span>
                    </div>
                    <SheetTitle className="text-2xl font-black text-[#1F1F1A] uppercase tracking-tighter">
                      {viewingCategory.category_name}
                    </SheetTitle>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-[#5F624F] uppercase tracking-widest opacity-60">Locked Items</p>
                    <p className="text-lg font-black text-[#26300D] tabular-nums leading-none">
                      {viewingCategory.currentCount} <span className="text-xs opacity-30">/</span> {viewingCategory.question_count}
                    </p>
                  </div>
                </div>
                {/* <SheetDescription className="text-xs font-bold text-[#5F624F] uppercase tracking-wider mt-2">
                  Showing questions saved for {upcomingEvents.find(e => String(e.id) === selectedEventId)?.title || 'this event'}.
                </SheetDescription> */}
              </SheetHeader>

              {/* Scrollable Container Fix: Added overflow-y-auto and min-h-0 for flex context */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left overscroll-contain min-h-0"
              >
                {savedQuestionsForCategory.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white border-2 border-dashed border-[#E6DFC8] rounded-[2rem] flex items-center justify-center text-[#E6DFC8]">
                      <Plus className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-black text-[#1F1F1A] uppercase tracking-tight">No questions assigned yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 pb-6">
                    {savedQuestionsForCategory.map((record, i) => {
                      const isEditing = editingQuestionId === record.id;
                      
                      return (
                        <div key={record.id} className={cn(
                          "bg-white border-2 rounded-2xl p-4 shadow-sm relative overflow-hidden group transition-all",
                          isEditing ? "border-[#26300D] ring-4 ring-[#26300D]/5" : "border-[#E6DFC8]"
                        )}>
                          {isEditing ? (
                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                               <div className="space-y-1.5">
                                  <Label className="text-[9px] font-black uppercase text-[#5F624F] ml-1">Edit Question</Label>
                                <textarea 
                                    title="Edit Question Text"
                                    value={editForm.question}
                                    onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                                    className="w-full text-sm font-semibold min-h-[80px] p-3 bg-[#F7F4EA]/30 border-2 border-[#E6DFC8] focus:border-[#26300D] rounded-xl outline-none resize-none"
                                  />
                               </div>
                               <div className="space-y-1.5">
                                  <Label className="text-[9px] font-black uppercase text-[#5F624F] ml-1">Edit Answer</Label>
                                  <Input 
                                    value={editForm.answer}
                                    onChange={(e) => setEditForm({...editForm, answer: e.target.value})}
                                    className="text-sm font-black text-[#26300D] bg-[#FDCC4B]/10 border-2 border-[#FDCC4B]/20 focus:border-[#26300D] rounded-xl h-11"
                                  />
                               </div>
                               <div className="flex gap-2 pt-2">
                                  <Button 
                                    onClick={() => saveEdit(record.id)}
                                    disabled={isActionPending}
                                    className="flex-1 bg-[#26300D] text-[#FDCC4B] font-black uppercase text-[10px] tracking-widest h-10 rounded-xl"
                                  >
                                    {isActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-2" /> Save Changes</>}
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    onClick={cancelEditing}
                                    disabled={isActionPending}
                                    className="px-4 border-2 border-[#E6DFC8] text-[#5F624F] font-bold uppercase text-[10px] h-10 rounded-xl"
                                  >
                                    Cancel
                                  </Button>
                               </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-4">
                               <span className="text-[10px] font-black text-[#26300D]/20 mt-1 shrink-0">Q{i+1}</span>
                               <div className="space-y-3 flex-1 min-w-0">
                                  <p className="text-sm font-bold text-[#1F1F1A] leading-snug">{record.question_text}</p>
                                  <div className="flex items-center gap-2 bg-[#26300D] text-white px-3 py-2 rounded-xl w-fit shadow-sm">
                                     <Target className="w-3 h-3 text-[#FDCC4B]" />
                                     <span className="text-xs font-black tracking-tight">{record.answer_text}</span>
                                  </div>
                               </div>
                               
                               <div className="flex flex-col gap-2 shrink-0">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => startEditing(record)}
                                    className="h-9 w-9 rounded-xl bg-slate-50 text-[#5F624F] hover:bg-[#26300D]/5 hover:text-[#26300D]"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => {
                                      if(window.confirm("Delete this question?")) deleteQuestion(record.id)
                                    }}
                                    className="h-9 w-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                               </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="p-6 pt-2 border-t border-[#E6DFC8] bg-white/80 backdrop-blur-md pb-10 shrink-0 z-20">
                <Button 
                  className="w-full h-12 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-transform"
                  onClick={() => {
                    setFilterCategory(viewingCategory.category_name);
                    setCategory(viewingCategory.category_name);
                    setViewingCategory(null);
                    const remaining = viewingCategory.question_count - viewingCategory.currentCount;
                    setNumQuestions(remaining > 0 ? remaining : viewingCategory.question_count);
                  }}
                >
                  <Sparkles className="w-4 h-4 mr-2" /> 
                  {viewingCategory.isFull ? "Generate Extra Items" : "Generate Remaining Items"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* GENERATOR FORM */}
      <form onSubmit={handleGenerate} className="bg-white border-2 border-[#E6DFC8] p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm">
        <div className="flex flex-col gap-3 grow">
          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5">
            {/* Event Selection - Full width on smallest mobile, half width on grid */}
            <div className="col-span-1 sm:col-span-4 space-y-1">
              <Label className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-[#5F624F] ml-1 flex items-center gap-1 text-left">
                 <CalendarCheck className="w-2.5 h-2.5" /> Event
              </Label>
              <div className="relative">
                <select 
                  title='Event'
                  value={selectedEventId}
                  onChange={handleEventChange}
                  className="w-full h-10 sm:h-9 rounded-xl sm:rounded-lg border-2 border-[#E6DFC8] bg-[#F7F4EA]/40 px-2.5 text-[11px] font-black text-[#26300D] appearance-none outline-none focus:border-[#26300D] transition-all uppercase truncate"
                >
                  {upcomingEvents.map(event => (
                    <option key={event.id} value={event.id}>{format(new Date(event.date), "dd MMM yyyy")}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#26300D] opacity-40 pointer-events-none" />
              </div>
            </div>

            {/* Category Selection - Half width on mobile grid */}
            <div className="col-span-1 sm:col-span-3 space-y-1">
              <Label className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-[#5F624F] ml-1 text-left">Category</Label>
              <div className="relative">
                <select 
                  title='Category'
                  value={category}
                  onChange={handleCategoryChange}
                  className={cn(
                    "w-full h-10 sm:h-9 rounded-xl sm:rounded-lg border-2 px-2.5 text-[11px] font-bold appearance-none outline-none transition-all uppercase truncate",
                    currentCategoryIsFull 
                      ? "border-red-200 bg-red-50 text-red-600" 
                      : "border-[#E6DFC8] bg-white text-[#26300D] focus:border-[#26300D]"
                  )}
                >
                  {categories.map(opt => (
                    <option key={opt.id} value={opt.category_name}>{opt.category_name}</option>
                  ))}
                </select>
                <ChevronDown className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none",
                  currentCategoryIsFull ? "text-red-400" : "text-[#5F624F] opacity-40"
                )} />
              </div>
            </div>

            {/* Topic Input - Full width on mobile underneath selection row */}
            <div className="col-span-2 sm:col-span-5 space-y-1">
              <Label className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-[#5F624F] ml-1 text-left">Topic</Label>
              <div className="flex gap-1.5">
                <Input 
                  placeholder="e.g. Disney, 90s..." 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={currentCategoryIsFull}
                  className={cn(
                    "h-10 sm:h-9 rounded-xl sm:rounded-lg border-2 text-[11px] font-bold focus:ring-0 px-3 min-w-0 grow",
                    currentCategoryIsFull 
                      ? "bg-slate-50 border-slate-200 placeholder:text-slate-300" 
                      : "bg-white border-[#E6DFC8] focus:border-[#26300D]"
                  )}
                />
                <Button 
                  type="submit"
                  disabled={isLoading || categories.length === 0 || currentCategoryIsFull} 
                  className="h-10 sm:h-9 rounded-xl sm:rounded-lg bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-widest text-[8px] px-4 shadow-sm active:scale-95 transition-all shrink-0"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                </Button>
              </div>
              {currentCategoryIsFull && (
                <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="inline w-2.5 h-2.5 mr-1 -mt-0.5" />
                  {category} is full for this date
                </p>
              )}
            </div>
          </div>
        </div>
      </form>

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
                      ? "border-[#26300D] shadow-md -translate-y-px" 
                      : "border-dashed border-[#E6DFC8] opacity-50 hover:opacity-100"
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
                      {isSelected ? <Check className="w-3 h-3 stroke-4" /> : <Plus className="w-3 h-3" />}
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