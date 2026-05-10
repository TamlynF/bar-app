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
  deletePastQuestionAction,
  generateMusicSnippetsAction,
  saveMusicSnippetsAction,
  getMusicSnippetsForEventAction,
} from '@/app/(private)/event-setups/quiz-generator/actions'

import type {
  QuizEventSummary,
  QuizCategoryConfig,
  PastQuestionRecord,
  MusicSnippetCandidate,
  SavedMusicSnippet,
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
  BookOpen,
  ChevronDown,
  History,
  Check,
  Plus,
  CheckCircle,
  Target,
  Edit2,
  Trash2,
  Save,
  Music,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpotifyPlayer } from '@/components/spotify-player'
import { useConfirm } from '@/components/ui/confirm-dialog'
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
  const { confirm, ConfirmDialogUI } = useConfirm()
  const searchParams = useSearchParams()
  const presetEventId = searchParams.get('event_id')
  const presetCategory = searchParams.get('category')

  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('Medium')
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

  // Music Snippets state
  const [musicSnippets, setMusicSnippets] = useState<MusicSnippetCandidate[]>([])
  const [selectedSnippetIndices, setSelectedSnippetIndices] = useState<Set<number>>(new Set())
  const [savedSnippets, setSavedSnippets] = useState<SavedMusicSnippet[]>([])
  const [spotifyConnected, setSpotifyConnected] = useState(false)

  // Check Spotify connection on mount
  useEffect(() => {
    const hasCookie = document.cookie.includes('spotify_access_token')
    const urlParams = new URLSearchParams(window.location.search)
    if (hasCookie || urlParams.get('spotify_connected') === 'true') {
      setSpotifyConnected(true)
    }
  }, [])
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

  const selectedCategoryConfig = useMemo(() => {
    return categories.find(c => c.category_name === category) || null
  }, [categories, category])

  const isMusicSnippets = selectedCategoryConfig?.include_spotify ?? false
  const isHigherOrLower = isMusicSnippets && category.toLowerCase().includes('higher')

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedEventId(id);
    loadEventHistory(id);
    // Load saved snippets for the new event
    if (selectedCategoryConfig?.include_spotify) {
      getMusicSnippetsForEventAction(id, selectedCategoryConfig.id).then(setSavedSnippets).catch(() => {});
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    setCategory(selectedName);
    const config = categories.find(c => c.category_name === selectedName);
    if (config) setNumQuestions(config.question_count);
    // Clear all draft results when switching category
    setQuestions([])
    setSelectedIndices(new Set())
    setMusicSnippets([])
    setSelectedSnippetIndices(new Set())
    setError('')
  };

  // Load saved snippets when event or spotify category changes
  useEffect(() => {
    if (selectedEventId && selectedCategoryConfig?.include_spotify) {
      getMusicSnippetsForEventAction(selectedEventId, selectedCategoryConfig.id).then(setSavedSnippets).catch(() => {});
    } else {
      setSavedSnippets([])
    }
  }, [selectedEventId, selectedCategoryConfig])

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
      if (isMusicSnippets) {
        const result = await generateMusicSnippetsAction(numQuestions, category, topic, difficulty)
        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else if (result.songs) {
          setMusicSnippets(result.songs)
          setSelectedSnippetIndices(new Set(result.songs.map((_, i) => i)))
          setQuestions([])
          toast.success("Song suggestions generated!")
        }
      } else {
        const result = await generateQuizAction(topic, category, numQuestions, difficulty)
        if (result && 'error' in result && result.error) {
          setError(result.error)
          toast.error(result.error)
        } else if (result && 'questions' in result && result.questions) {
          setQuestions(result.questions)
          setSelectedIndices(new Set(result.questions.map((_, i) => i)))
          setMusicSnippets([])
          toast.success("Draft round generated!")
        }
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
    if (isSaving) return
    if (!selectedEventId) {
      toast.error("Select a Quiz Event first.");
      return
    }

    if (isMusicSnippets) {
      const selectedData = musicSnippets.filter((_, i) => selectedSnippetIndices.has(i))
      if (selectedData.length === 0) return
      setIsSaving(true)
      try {
        await saveMusicSnippetsAction(
          selectedData.map(s => ({
            artist: s.artist,
            title: s.title,
            year: s.year,
            spotify_track_id: s.spotify_track_id,
            hint_year: s.hint_year,
          })),
          parseInt(selectedEventId),
          category,
          selectedCategoryConfig!.id
        )
        const eventName = upcomingEvents.find(e => String(e.id) === selectedEventId)?.title || 'Event'
        toast.success(`Approved ${selectedData.length} songs for ${eventName}!`)
        setMusicSnippets([])
        setSelectedSnippetIndices(new Set())
        loadEventHistory(selectedEventId)
        getMusicSnippetsForEventAction(selectedEventId, selectedCategoryConfig!.id).then(setSavedSnippets).catch(() => {})
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save to database.'
        toast.error(message)
      } finally {
        setIsSaving(false)
      }
      return
    }

    const selectedData = questions.filter((_, i) => selectedIndices.has(i))
    if (selectedData.length === 0) return
    setIsSaving(true)
    try {
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
    <div className="max-w-6xl mx-auto px-2 sm:px-6 py-2 sm:py-4 space-y-2 sm:space-y-4 animate-in fade-in duration-700 pb-32 text-left">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        {presetEventId ? (
          <Link
            href={`/event-setups/events/${presetEventId}${presetCategory ? `?category=${encodeURIComponent(presetCategory)}` : ''}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E6DFC8] bg-white text-[#5F624F] font-bold text-[10px] uppercase tracking-wider hover:bg-[#26300D]/5 transition-all shadow-xs"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Event</span>
          </Link>
        ) : (
          <div />
        )}
        <Link
          href="/event-setups/quiz-history"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E6DFC8] bg-white text-[#5F624F] font-bold text-[10px] uppercase tracking-wider hover:bg-[#26300D]/5 transition-all shadow-xs"
        >
          <History className="w-3 h-3" />
          <span>History</span>
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
              style={{ borderColor: isFull ? '#047857' : hasQuestions ? '#b45309' : '#b91c1c' }}
              className={cn(
                "flex flex-row! items-center gap-1.5 px-3 h-9 rounded-lg border border-solid shrink-0 whitespace-nowrap shadow-md transition-all hover:shadow-lg active:scale-[0.98]",
                isFull
                  ? "bg-green-50"
                  : hasQuestions
                    ? "bg-amber-50"
                    : "bg-red-50",
                filterCategory === stat.category_name && "ring-2 ring-[#26300D] ring-offset-1 z-10"
              )}
            >
              <span className={cn(
                "text-[11px] font-black uppercase tracking-tight leading-none",
                isFull ? "text-green-700" : hasQuestions ? "text-amber-700" : "text-red-700"
              )}>
                {stat.short_name || stat.category_name}:
              </span>

              {isFull ? (
                <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />
              ) : (
                <span className={cn(
                  "text-[11px] font-black tabular-nums leading-none shrink-0",
                  hasQuestions ? "text-amber-700" : "text-red-700"
                )}>
                  {stat.currentCount}/{stat.question_count}
                </span>
              )}
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
                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide",
                        viewingCategory.isFull ? "bg-green-100 text-green-700" : "bg-[#FDCC4B] text-[#26300D]"
                      )}>
                        {viewingCategory.isFull ? "Round Complete" : "Round In Progress"}
                      </span>
                    </div>
                    <SheetTitle className="text-2xl font-black text-[#1F1F1A] uppercase tracking-tighter">
                      {viewingCategory.category_name}
                    </SheetTitle>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-[#5F624F] uppercase tracking-wide opacity-60">Locked Items</p>
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
                                  <Label className="text-[10px] font-black uppercase text-[#5F624F] ml-1">Edit Question</Label>
                                <textarea 
                                    title="Edit Question Text"
                                    value={editForm.question}
                                    onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                                    className="w-full text-sm font-semibold min-h-[80px] p-3 bg-[#F7F4EA]/30 border-2 border-[#E6DFC8] focus:border-[#26300D] rounded-xl outline-none resize-none"
                                  />
                               </div>
                               <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase text-[#5F624F] ml-1">Edit Answer</Label>
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
                                    className="flex-1 bg-[#26300D] text-white font-black uppercase text-[10px] tracking-wide h-10 rounded-xl"
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
                            <div className="space-y-3">
                              <div className="flex items-start gap-4">
                                {record.release_year ? (
                                  <span className="shrink-0 bg-[#26300D] text-white text-[10px] font-black px-2 py-1 rounded-lg tracking-wider mt-0.5">
                                    {record.release_year}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black text-[#26300D]/20 mt-1 shrink-0">Q{i+1}</span>
                                )}
                                <div className="space-y-3 flex-1 min-w-0">
                                  {!record.spotify_track_id && (
                                    <p className="text-sm font-bold text-[#1F1F1A] leading-snug">{record.question_text}</p>
                                  )}
                                  <div className="flex items-center gap-2 bg-[#26300D] text-white px-3 py-2 rounded-xl w-fit shadow-sm">
                                    <Target className="w-3 h-3 text-white/50" />
                                    <span className="text-xs font-black tracking-tight">{record.answer_text}</span>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-2 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEditing(record)}
                                    className="h-9 w-9 rounded-xl bg-[#F7F4EA] text-[#5F624F] hover:bg-[#26300D]/5 hover:text-[#26300D]"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      const ok = await confirm({ title: "Delete question", description: "Delete this question? This cannot be undone.", confirmLabel: "Delete", variant: "destructive" })
                                      if (ok) deleteQuestion(record.id)
                                    }}
                                    className="h-9 w-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              {record.spotify_track_id && (
                                <SpotifyPlayer trackId={record.spotify_track_id} title={record.answer_text} compact />
                              )}
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
                  className="w-full h-12 rounded-2xl bg-[#26300D] text-white font-black uppercase tracking-wide text-xs shadow-lg active:scale-95 transition-transform"
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
      <form onSubmit={handleGenerate} className="bg-[#F7F4EA] border border-[#E6DFC8] p-3 sm:p-4 rounded-xl shadow-sm">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {/* Row 1 col 1: Event */}
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wide text-[#26300D] ml-0.5 mb-0.5 block text-left">Event</Label>
            <div className="relative">
              <select
                title='Event'
                value={selectedEventId}
                onChange={handleEventChange}
                className="w-full h-8 rounded-md border border-[#E6DFC8] bg-white pl-2 pr-6 text-[10px] font-bold text-[#26300D] appearance-none [-webkit-appearance:none] [-moz-appearance:none] outline-none focus:border-[#26300D] transition-all uppercase"
              >
                {upcomingEvents.map(event => (
                  <option key={event.id} value={event.id}>{format(new Date(event.date), "dd MMM yyyy")}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#26300D] opacity-40 pointer-events-none" />
            </div>
          </div>

          {/* Row 1 col 2: Category */}
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wide text-[#26300D] ml-0.5 mb-0.5 block text-left">Category</Label>
            <div className="relative">
              <select
                title='Category'
                value={category}
                onChange={handleCategoryChange}
                className={cn(
                  "w-full h-8 rounded-md border pl-2 pr-6 text-[10px] font-bold appearance-none [-webkit-appearance:none] [-moz-appearance:none] outline-none transition-all uppercase",
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
                "absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none",
                currentCategoryIsFull ? "text-red-400" : "text-[#5F624F] opacity-40"
              )} />
            </div>
          </div>

          {/* Row 2: Topic full width */}
          <div className="col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-wide text-[#26300D] ml-0.5 mb-0.5 block text-left">
              {isMusicSnippets ? 'Theme' : 'Topic'}
            </Label>
            <Input
              placeholder={isMusicSnippets ? "e.g. 80s, Rock, Christmas..." : "e.g. Disney, 90s..."}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={currentCategoryIsFull}
              className={cn(
                "h-8 rounded-md border text-[10px] font-bold focus:ring-0 px-2 w-full",
                currentCategoryIsFull
                  ? "bg-[#F7F4EA] border-[#E6DFC8] placeholder:text-[#5F624F]/40"
                  : "bg-white border-[#E6DFC8] focus:border-[#26300D]"
              )}
            />
          </div>

          {/* Row 3: Difficulty + Generate button */}
          <div className="col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-wide text-[#26300D] ml-0.5 mb-0.5 block text-left">Difficulty</Label>
            <div className="flex items-center justify-between gap-1.5">
              <div className="relative">
                  <select
                    title="Difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={{ minWidth: '180px' }}
                    className="h-8 rounded-md border border-[#E6DFC8] bg-white pl-2 pr-6 text-[10px] font-bold text-[#26300D] appearance-none [-webkit-appearance:none] [-moz-appearance:none] outline-none focus:border-[#26300D] transition-all uppercase"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Difficult">Hard</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#26300D] opacity-40 pointer-events-none" />
                </div>
              <Button
                type="submit"
                disabled={isLoading || categories.length === 0 || currentCategoryIsFull}
                className="h-8 px-6 rounded-md bg-[#26300D] text-white font-black uppercase tracking-wider text-[10px] shadow-sm active:scale-95 transition-all hover:bg-[#26300D]/90"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Generate
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
        {currentCategoryIsFull && (
          <p className="text-[10px] font-black text-red-600 uppercase tracking-wide mt-1 ml-0.5 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="inline w-2.5 h-2.5 mr-0.5 -mt-0.5" />
            {category} is full for this date
          </p>
        )}
        {isMusicSnippets && !spotifyConnected && (
          <div className="mt-2 flex items-center gap-2">
            <a
              href={`/api/spotify/login?return=${encodeURIComponent(`/event-setups/quiz-generator?category=${encodeURIComponent(category)}${selectedEventId ? `&event_id=${selectedEventId}` : ''}`)}`}
              style={{ backgroundColor: '#1DB954' }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-md text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <Music className="w-3 h-3" />
              Connect Spotify
            </a>
            <span className="text-[10px] text-[#5F624F]">Required to play songs</span>
          </div>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-100 p-2.5 rounded-xl flex items-center gap-2.5 text-red-700 animate-in slide-in-from-top-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <p className="text-[10px] font-bold leading-tight uppercase">{error}</p>
        </div>
      )}

      {/* DRAFT RESULTS SECTION */}
      {questions.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 bg-[#F7F4EA] rounded-xl p-2 sm:p-3 space-y-2">

          {/* STICKY ACTION BAR */}
          <div className="flex items-center justify-between bg-white border border-[#E6DFC8] p-2 rounded-lg shadow-md sticky top-16 z-20">
            <div className="flex items-center gap-2 px-0.5">
              <div className="bg-[#26300D] text-white w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px]">
                {selectedIndices.size}
              </div>
              <span className="text-[#26300D] text-[10px] font-black uppercase tracking-wider leading-none">Draft Items</span>
            </div>
            <Button
              variant="default"
              onClick={handleSave}
              disabled={isSaving || selectedIndices.size === 0}
              className="h-8 bg-[#26300D] text-white px-4 font-black uppercase text-[10px] tracking-wider rounded-md active:scale-95 transition-transform"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Approve
                </span>
              )}
            </Button>
          </div>

          {/* DRAFT CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                    "group relative flex flex-col bg-white rounded-lg transition-all cursor-pointer select-none overflow-hidden shadow-sm",
                    isSelected
                      ? "border border-[#26300D]/60 shadow-md"
                      : "border border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-[11px] font-bold text-[#1F1F1A] leading-snug">
                        {q.question}
                      </p>
                      <div className="px-2.5 py-1.5 rounded-md text-center bg-[#F7F4EA]">
                        <p className="text-[10px] font-black text-[#26300D] leading-tight">
                          {q.answer}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300 shrink-0 mt-0.5",
                      isSelected
                        ? "bg-[#26300D] border-[#26300D] text-[#FDCC4B]"
                        : "bg-white border-[#E6DFC8] text-[#E6DFC8]"
                    )}>
                      {isSelected ? <Check className="w-2.5 h-2.5 stroke-4" /> : <Plus className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MUSIC SNIPPETS DRAFT SECTION */}
      {musicSnippets.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 bg-[#F7F4EA] rounded-xl p-2 sm:p-3 space-y-2">

          {/* STICKY ACTION BAR */}
          <div className="flex items-center justify-between bg-white border border-[#E6DFC8] p-2 rounded-lg shadow-md sticky top-16 z-20">
            <div className="flex items-center gap-2 px-0.5">
              <div className="bg-[#26300D] text-white w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px]">
                {selectedSnippetIndices.size}
              </div>
              <span className="text-[#26300D] text-[10px] font-black uppercase tracking-wider leading-none">Songs</span>
            </div>
            <Button
              variant="default"
              onClick={handleSave}
              disabled={isSaving || selectedSnippetIndices.size === 0}
              className="h-8 bg-[#26300D] text-white px-4 font-black uppercase text-[10px] tracking-wider rounded-md active:scale-95 transition-transform"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Approve
                </span>
              )}
            </Button>
          </div>

          {/* SONG CARDS */}
          <div className="grid grid-cols-1 gap-2">
            {musicSnippets.map((song, idx) => {
              const isSelected = selectedSnippetIndices.has(idx)
              return (
                <div
                  key={idx}
                  className={cn(
                    "group relative bg-white rounded-lg transition-all overflow-hidden shadow-sm",
                    isSelected
                      ? "border border-[#26300D]/60 shadow-md"
                      : "border border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  {/* Clickable header row */}
                  <div
                    className="flex items-center gap-2 px-2.5 py-2 cursor-pointer select-none"
                    onClick={() => {
                      const next = new Set(selectedSnippetIndices)
                      if (next.has(idx)) next.delete(idx)
                      else next.add(idx)
                      setSelectedSnippetIndices(next)
                    }}
                  >
                    <span className="shrink-0 bg-[#26300D] text-white text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider">
                      {song.year}
                    </span>
                    <div className="flex-1 min-w-0">
                      {isHigherOrLower && song.hint_year ? (
                        <>
                          <p className="text-[10px] font-black text-amber-700 leading-tight">
                            Higher or Lower than {song.hint_year}?
                          </p>
                          <p className="text-[11px] font-bold text-[#1F1F1A] leading-tight tracking-tight truncate mt-0.5">
                            {song.artist} — {song.title}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[11px] font-bold text-[#1F1F1A] leading-tight tracking-tight truncate">
                            {song.artist} — {song.title}
                          </p>
                          <p className="text-[10px] text-[#5F624F] font-medium mt-0.5 leading-tight line-clamp-1">
                            {song.intro_description}
                          </p>
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 transition-all duration-300 shrink-0",
                      isSelected
                        ? "bg-[#26300D] border-[#26300D] text-[#FDCC4B]"
                        : "bg-white border-[#E6DFC8] text-[#E6DFC8]"
                    )}>
                      {isSelected ? <Check className="w-2.5 h-2.5 stroke-4" /> : <Plus className="w-2.5 h-2.5" />}
                    </div>
                  </div>

                  {/* Spotify player or fallback */}
                  <div className="px-2.5 pb-2" onClick={(e) => e.stopPropagation()}>
                    {song.spotify_track_id ? (
                      <SpotifyPlayer trackId={song.spotify_track_id} title={`${song.artist} - ${song.title}`} compact />
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#F7F4EA] rounded-md">
                        <AlertCircle className="w-2.5 h-2.5 text-[#5F624F] shrink-0" />
                        <span className="text-[10px] font-bold text-[#5F624F] uppercase tracking-wider">Not on Spotify</span>
                        <a
                          href={`https://open.spotify.com/search/${encodeURIComponent(song.artist + ' ' + song.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-0.5 text-[10px] font-black text-[#26300D] uppercase tracking-wider hover:underline"
                        >
                          Search <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SAVED SNIPPETS FOR EVENT */}
      {isMusicSnippets && savedSnippets.length > 0 && musicSnippets.length === 0 && questions.length === 0 && (
        <div className="animate-in fade-in duration-500 bg-[#F7F4EA] rounded-xl p-2 sm:p-3 space-y-2">
          <p className="text-[10px] font-black text-[#5F624F] uppercase tracking-wide ml-0.5">
            Saved Songs ({savedSnippets.length})
          </p>
          <div className="grid grid-cols-1 gap-2">
            {savedSnippets.map((snippet) => (
              <div key={snippet.id} className="bg-white border border-[#26300D]/20 rounded-lg overflow-hidden shadow-sm">
                <div className="px-2.5 py-2 flex items-center gap-2">
                  <span className="shrink-0 bg-[#26300D] text-white text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider">
                    {snippet.release_year || '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {isHigherOrLower && snippet.hint_year && (
                      <p className="text-[10px] font-black text-amber-700 leading-tight">
                        Higher or Lower than {snippet.hint_year}?
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-[#1F1F1A] tracking-tight truncate">
                      {snippet.answer_text}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      const ok = await confirm({ title: "Remove song", description: "Remove this song from the round?", confirmLabel: "Remove", variant: "destructive" })
                      if (ok) {
                        await deletePastQuestionAction(snippet.id)
                        toast.success("Song removed")
                        loadEventHistory(selectedEventId)
                        if (selectedCategoryConfig) getMusicSnippetsForEventAction(selectedEventId, selectedCategoryConfig.id).then(setSavedSnippets).catch(() => {})
                      }
                    }}
                    className="h-7 w-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {snippet.spotify_track_id && (
                  <div className="px-3 pb-2">
                    <SpotifyPlayer trackId={snippet.spotify_track_id} title={snippet.answer_text} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && questions.length === 0 && musicSnippets.length === 0 && (
        <div className={cn(
          "py-10 text-center border border-dashed border-[#E6DFC8] rounded-xl bg-white/40 flex flex-col items-center",
          isMusicSnippets && savedSnippets.length > 0 && "hidden"
        )}>
           {isMusicSnippets ? (
             <Music className="w-6 h-6 text-[#26300D]/10 mb-2" />
           ) : (
             <BookOpen className="w-6 h-6 text-[#26300D]/10 mb-2" />
           )}
           <p className="text-[10px] text-[#5F624F] uppercase tracking-[0.2em] font-black opacity-40">
             {isMusicSnippets ? 'Generate song suggestions' : 'Select parameters to draft a round'}
           </p>
        </div>
      )}
      {ConfirmDialogUI}
    </div>
  )
}