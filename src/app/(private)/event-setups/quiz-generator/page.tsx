'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  generatePictureRoundAction,
  savePictureRoundAction,
  cleanupGeneratedQuestionsForInactiveEventAction,
  syncCategoryPlaylistAction,
} from '@/app/(private)/event-setups/quiz-generator/actions'

import type {
  QuizEventSummary,
  QuizCategoryConfig,
  PastQuestionRecord,
  MusicSnippetCandidate,
  SavedMusicSnippet,
  PictureRoundItem,
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
  Check,
  Plus,
  CheckCircle,
  Target,
  Edit2,
  Trash2,
  Save,
  Music,
  ExternalLink,
  ImageIcon,
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
  console.log('Preset event_id:', presetEventId, 'Preset category:', presetCategory)
  
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

  // Picture Round state
  const [pictureItems, setPictureItems] = useState<PictureRoundItem[]>([])
  const [selectedPictureIndices, setSelectedPictureIndices] = useState<Set<number>>(new Set())
  const [pictureTopicLocked, setPictureTopicLocked] = useState(false)
  const [previousPictureAnswers, setPreviousPictureAnswers] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(true)

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

  const currentCategoryStat = useMemo(() => {
    return categoryStats.find(s => s.category_name === category) || null;
  }, [category, categoryStats]);

  const currentCategoryIsFull = currentCategoryStat?.isFull ?? false;

  // Approving must not push the saved count over the category's question_count.
  // Returns true when (already-saved + currently-selected) exceeds the target.
  const approveExceedsCapacity = (selectedCount: number) => {
    if (!currentCategoryStat) return false;
    return currentCategoryStat.currentCount + selectedCount > currentCategoryStat.question_count;
  };

  const selectedCategoryConfig = useMemo(() => {
    return categories.find(c => c.category_name === category) || null
  }, [categories, category])

  const isMusicSnippets = selectedCategoryConfig?.include_spotify ?? false
  const isHigherOrLower = isMusicSnippets && (selectedCategoryConfig?.is_higher_lower ?? false)
  const isPictureRound = selectedCategoryConfig?.is_picture ?? false

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedEventId(id);
    // Purge the generated-question exclusion log if this event is no longer active.
    if (id) cleanupGeneratedQuestionsForInactiveEventAction(parseInt(id)).catch(() => {});
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
    setPictureItems([])
    setSelectedPictureIndices(new Set())
    setPreviousPictureAnswers([])
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

  // For picture rounds, lock the topic to the saved question_text if one exists for this event+category
  useEffect(() => {
    if (!selectedCategoryConfig?.is_picture) {
      setPictureTopicLocked(false)
      return
    }
    const existing = eventHistory.find(
      q => q.quiz_category_configs_id === selectedCategoryConfig.id && q.question_text
    )
    if (existing) {
      setTopic(existing.question_text)
      setPictureTopicLocked(true)
    } else {
      setTopic('')
      setPictureTopicLocked(false)
    }
  }, [selectedCategoryConfig, eventHistory])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return

    if (!selectedEventId) {
      toast.error("Select a Quiz Event first.");
      return;
    }

    if (!selectedCategoryConfig) {
      toast.error("Select a category first.");
      return;
    }

    if (currentCategoryIsFull) {
      toast.error(`${category} is already full for this event.`);
      return;
    }

    setIsLoading(true)
    setError('')
    try {
      if (isPictureRound) {
        if (!topic.trim()) {
          toast.error("Topic is required for picture rounds")
          setIsLoading(false)
          return
        }
        const result = await generatePictureRoundAction(numQuestions, topic, difficulty, selectedEventId ? parseInt(selectedEventId) : undefined, selectedCategoryConfig?.id, previousPictureAnswers)
        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else if (result.items) {
          setPreviousPictureAnswers(prev => [...prev, ...result.items!.map(i => i.answer)])
          setPictureItems(result.items)
          setSelectedPictureIndices(new Set(result.items.map((_, i) => i)))
          setQuestions([])
          setMusicSnippets([])
          toast.success("Picture round generated!")
        }
      } else if (isMusicSnippets) {
        const result = await generateMusicSnippetsAction(numQuestions, topic, difficulty, parseInt(selectedEventId), selectedCategoryConfig!.id)
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
        const result = await generateQuizAction(topic, category, numQuestions, difficulty, parseInt(selectedEventId), selectedCategoryConfig!.id)
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

    if (isPictureRound) {
      const selectedData = pictureItems.filter((_, i) => selectedPictureIndices.has(i))
      if (selectedData.length === 0) return
      setIsSaving(true)
      try {
        await savePictureRoundAction(selectedData, parseInt(selectedEventId), category, selectedCategoryConfig!.id, topic)
        const eventName = upcomingEvents.find(e => String(e.id) === selectedEventId)?.title || 'Event'
        toast.success(`Approved ${selectedData.length} images for ${eventName}!`)
        setPictureItems([])
        setSelectedPictureIndices(new Set())
        loadEventHistory(selectedEventId)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save to database.'
        toast.error(message)
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (isMusicSnippets) {
      const selectedData = musicSnippets.filter((_, i) => selectedSnippetIndices.has(i))
      if (selectedData.length === 0) return
      setIsSaving(true)
      try {
        const result = await saveMusicSnippetsAction(
          selectedData.map(s => ({
            artist: s.artist,
            title: s.title,
            year: s.year,
            spotify_track_id: s.spotify_track_id,
            hint_year: s.hint_year,
          })),
          parseInt(selectedEventId),
          category,
          selectedCategoryConfig!.id,
          topic
        )
        const eventName = upcomingEvents.find(e => String(e.id) === selectedEventId)?.title || 'Event'
        toast.success(`Approved ${selectedData.length} songs for ${eventName}!`)
        if (result?.needsConnect) {
          toast.warning("Connect Spotify on the event page to build the playlist.")
        }
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
      await updatePastQuestionAction(id, editForm.question, editForm.answer, null, null, selectedEventId ? Number(selectedEventId) : null)
      toast.success("Question updated")
      await loadEventHistory(selectedEventId)
      setEditingQuestionId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update database.'
      toast.error(message)
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
      const message = err instanceof Error ? err.message : 'Failed to delete from database.'
      toast.error(message)
    } finally {
      setIsActionPending(false)
    }
  }

  const filteredQuestions = useMemo(() => {
    //console.log("Filtering questions with filterCategory:", filterCategory, " and questions:", questions);
    if (!filterCategory) return questions;
    return questions.filter(q => q.category.toLowerCase() === filterCategory.toLowerCase());
  }, [questions, filterCategory]);

  // --- Select all / clear toggles for each draft type ---
  const allQuestionsSelected = filteredQuestions.length > 0
    && filteredQuestions.every(q => selectedIndices.has(questions.indexOf(q)));
  const toggleSelectAllQuestions = () => {
    const targetIdx = filteredQuestions.map(q => questions.indexOf(q));
    const next = new Set(selectedIndices);
    targetIdx.forEach(i => (allQuestionsSelected ? next.delete(i) : next.add(i)));
    setSelectedIndices(next);
  };

  const allSnippetsSelected = musicSnippets.length > 0 && selectedSnippetIndices.size === musicSnippets.length;
  const toggleSelectAllSnippets = () => {
    setSelectedSnippetIndices(allSnippetsSelected ? new Set() : new Set(musicSnippets.map((_, i) => i)));
  };

  const allPicturesSelected = pictureItems.length > 0 && selectedPictureIndices.size === pictureItems.length;
  const toggleSelectAllPictures = () => {
    setSelectedPictureIndices(allPicturesSelected ? new Set() : new Set(pictureItems.map((_, i) => i)));
  };

  // Questions specifically for the viewing category detail popup
  const savedQuestionsForCategory = useMemo(() => {
    if (!viewingCategory) return [];
    return eventHistory.filter((q: PastQuestionRecord) => {
      const qCat = q.quiz_category_configs?.category_name || q.category;
      return qCat?.toLowerCase() === viewingCategory.category_name.toLowerCase();
    });
  }, [viewingCategory, eventHistory]);

  return (
    <div className="space-y-2 space-y-4 mx-auto px-2 sm:px-6 py-2 py-4 pb-32 max-w-6xl text-left animate-in duration-700 fade-in">

      {/* CATEGORY PROGRESS INDICATORS */}
      {/* <div className={styles.pillsContainer}>
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
                "flex flex-row! items-center gap-1.5 shadow-md hover:shadow-lg px-3 border border-solid rounded-lg h-9 whitespace-nowrap active:scale-[0.98] transition-all shrink-0",
                isFull
                  ? "bg-green-50"
                  : hasQuestions
                    ? "bg-amber-50"
                    : "bg-red-50",
                filterCategory === stat.category_name && "ring-2 ring-[#5C4033] ring-offset-1 z-10"
              )}
            >
              <span className={cn(
                "font-black text-[11px] uppercase leading-none tracking-tight",
                isFull ? "text-green-700" : hasQuestions ? "text-amber-700" : "text-red-700"
              )}>
                {stat.short_name || stat.category_name}:
              </span>

              {isFull ? (
                <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />
              ) : (
                <span className={cn(
                  "font-black tabular-nums text-[11px] leading-none shrink-0",
                  hasQuestions ? "text-amber-700" : "text-red-700"
                )}>
                  {stat.currentCount}/{stat.question_count}
                </span>
              )}
            </button>
          )
        })}
      </div> */}

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
          className="flex flex-col bg-[#F7F4EA] shadow-2xl p-0 border-[#E6DFC8] border-t-2 rounded-t-[2.5rem] outline-none h-[85vh]"
        >
          {viewingCategory && (
            <>
              <SheetHeader className="top-0 z-20 sticky bg-white/80 backdrop-blur-md p-6 pb-4 border-[#E6DFC8] border-b text-left shrink-0">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wide",
                        viewingCategory.isFull ? "bg-green-100 text-green-700" : "bg-[#C8956D] text-[#5C4033]"
                      )}>
                        {viewingCategory.isFull ? "Round Complete" : "Round In Progress"}
                      </span>
                    </div>
                    <SheetTitle className="font-black text-[#1F1F1A] text-2xl uppercase tracking-tighter">
                      {viewingCategory.category_name}
                    </SheetTitle>
                  </div>
                  <div className="text-right">
                    <p className="opacity-60 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">Locked Items</p>
                    <p className="font-black tabular-nums text-[#5C4033] text-lg leading-none">
                      {viewingCategory.currentCount} <span className="opacity-30 text-xs">/</span> {viewingCategory.question_count}
                    </p>
                  </div>
                </div>
                {/* <SheetDescription className="mt-2 font-bold text-[#5F624F] text-xs uppercase tracking-wider">
                  Showing questions saved for {upcomingEvents.find(e => String(e.id) === selectedEventId)?.title || 'this event'}.
                </SheetDescription> */}
              </SheetHeader>

              {/* Scrollable Container Fix: Added overflow-y-auto and min-h-0 for flex context */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 space-y-4 p-4 sm:p-6 min-h-0 overflow-y-auto overscroll-contain text-left"
              >
                {savedQuestionsForCategory.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-20 text-center">
                    <div className="flex justify-center items-center bg-white border-[#E6DFC8] border-2 border-dashed rounded-4xl w-16 h-16 text-[#E6DFC8]">
                      <Plus className="w-8 h-8" />
                    </div>
                    <p className="font-black text-[#1F1F1A] text-sm uppercase tracking-tight">No questions assigned yet</p>
                  </div>
                ) : (
                  <div className="gap-4 grid grid-cols-1 pb-6">
                    {savedQuestionsForCategory.map((record, i) => {
                      const isEditing = editingQuestionId === record.id;
                      
                      return (
                        <div key={record.id} className={cn(
                          "group relative bg-white shadow-sm p-4 border-2 rounded-2xl overflow-hidden transition-all",
                          isEditing ? "border-[#5C4033] ring-4 ring-[#5C4033]/5" : "border-[#E6DFC8]"
                        )}>
                          {isEditing ? (
                            <div className="space-y-4 animate-in duration-200 fade-in zoom-in-95">
                               <div className="space-y-1.5">
                                  <Label className="ml-1 font-black text-[#5F624F] text-[10px] uppercase">Edit Question</Label>
                                <textarea 
                                    title="Edit Question Text"
                                    value={editForm.question}
                                    onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                                    className="bg-[#F7F4EA]/30 p-3 border-[#E6DFC8] border-2 focus:border-[#5C4033] rounded-xl outline-none w-full min-h-20 font-semibold text-sm resize-none"
                                  />
                               </div>
                               <div className="space-y-1.5">
                                  <Label className="ml-1 font-black text-[#5F624F] text-[10px] uppercase">Edit Answer</Label>
                                  <Input 
                                    value={editForm.answer}
                                    onChange={(e) => setEditForm({...editForm, answer: e.target.value})}
                                    className="bg-[#5C4033]/10 border-[#5C4033]/15 border-2 focus:border-[#5C4033] rounded-xl h-11 font-black text-[#5C4033] text-sm"
                                  />
                               </div>
                               <div className="flex gap-2 pt-2">
                                  <Button 
                                    onClick={() => saveEdit(record.id)}
                                    disabled={isActionPending}
                                    className="flex-1 bg-[#5C4033] rounded-xl h-10 font-black text-[10px] text-white uppercase tracking-wide"
                                  >
                                    {isActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="mr-2 w-3.5 h-3.5" /> Save Changes</>}
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    onClick={cancelEditing}
                                    disabled={isActionPending}
                                    className="px-4 border-[#E6DFC8] border-2 rounded-xl h-10 font-bold text-[#5F624F] text-[10px] uppercase"
                                  >
                                    Cancel
                                  </Button>
                               </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-start gap-4">
                                {record.release_year ? (
                                  <span className="bg-[#5C4033] mt-0.5 px-2 py-1 rounded-lg font-black text-[10px] text-white tracking-wider shrink-0">
                                    {record.release_year}
                                  </span>
                                ) : (
                                  <span className="mt-1 font-black text-[#5C4033]/20 text-[10px] shrink-0">Q{i+1}</span>
                                )}
                                <div className="flex-1 space-y-3 min-w-0">
                                  {record.image_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={record.image_url} alt={record.answer_text} className="rounded-xl w-full h-40 object-cover" />
                                  ) : !record.spotify_track_id && record.question_text ? (
                                    <p className="font-bold text-[#1F1F1A] text-sm leading-snug">{record.question_text}</p>
                                  ) : null}
                                  <div className="flex items-center gap-2 bg-[#7A1F1F] shadow-sm px-3 py-2 rounded-xl w-fit text-white">
                                    <Target className="w-3 h-3 text-white/50" />
                                    <span className="font-black text-xs tracking-tight">{record.answer_text}</span>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-2 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEditing(record)}
                                    className="bg-[#F7F4EA] hover:bg-[#5C4033]/5 rounded-xl w-9 h-9 text-[#5F624F] hover:text-[#5C4033]"
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
                                    className="bg-red-50 hover:bg-red-100 rounded-xl w-9 h-9 text-red-600"
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

              <div className="z-20 bg-white/80 backdrop-blur-md p-6 pt-2 pb-10 border-[#E6DFC8] border-t shrink-0">
                <Button 
                  className="bg-[#5C4033] shadow-lg rounded-2xl w-full h-12 font-black text-white text-xs uppercase tracking-wide active:scale-95 transition-transform"
                  onClick={() => {
                    setFilterCategory(viewingCategory.category_name);
                    setCategory(viewingCategory.category_name);
                    setViewingCategory(null);
                    const remaining = viewingCategory.question_count - viewingCategory.currentCount;
                    setNumQuestions(remaining > 0 ? remaining : viewingCategory.question_count);
                  }}
                >
                  <Sparkles className="mr-2 w-4 h-4" /> 
                  {viewingCategory.isFull ? "Generate Extra Items" : "Generate Remaining Items"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* GENERATOR FORM */}
      <form onSubmit={handleGenerate} className="bg-white shadow-sm border border-[#E6DFC8] rounded-2xl overflow-hidden">
        {/* Collapsible header — Event & Category on same row */}
        <button
          type="button"
          onClick={() => setFormOpen(o => !o)}
          className="flex justify-between items-center bg-[#F7F4EA] hover:bg-[#F0EDE0] px-4 py-3 w-full text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Sparkles className="w-4 h-4 text-[#5C4033] shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-black text-[#5C4033] text-[11px] truncate uppercase tracking-tight">
                {category || 'Select Category'}
              </span>
              <span className="font-bold text-[#5F624F]/50 text-[10px] shrink-0">/</span>
              <span className="font-bold text-[#5F624F] text-[11px] uppercase tracking-tight shrink-0">
                {selectedEventId ? format(new Date(upcomingEvents.find(e => String(e.id) === selectedEventId)?.date || ''), "dd MMM") : '—'}
              </span>
            </div>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 text-[#5F624F] transition-transform duration-200 shrink-0",
            formOpen && "rotate-180"
          )} />
        </button>

        {/* Collapsible body */}
        {formOpen && (
          <div className="space-y-4 p-4 border-[#E6DFC8] border-t">
            {/* Topic */}
            <div className="space-y-1.5">
              <Label className="block ml-0.5 font-black text-[#5C4033] text-[10px] text-left uppercase tracking-wide">
                {isMusicSnippets ? 'Theme' : 'Topic'}
                {isPictureRound && <span className="ml-0.5 text-red-500">*</span>}
              </Label>
              <Input
                placeholder={isPictureRound ? "e.g. Dog Breeds, World Flags, Famous Landmarks..." : isMusicSnippets ? "e.g. 80s, Rock, Christmas..." : "e.g. Disney, 90s..."}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required={isPictureRound}
                disabled={currentCategoryIsFull || pictureTopicLocked}
                className={cn(
                  "px-3 border rounded-xl focus:ring-0 w-full h-11 font-bold text-xs",
                  currentCategoryIsFull || pictureTopicLocked
                    ? "bg-[#F7F4EA] border-[#E6DFC8] text-[#5F624F] placeholder:text-[#5F624F]/40"
                    : "bg-[#F7F4EA] border-[#E6DFC8] focus:border-[#5C4033]"
                )}
              />
            </div>

            {/* Difficulty — segmented buttons */}
            <div className="space-y-1.5">
              <Label className="block ml-0.5 font-black text-[#5C4033] text-[10px] text-left uppercase tracking-wide">Difficulty</Label>
              <div className="flex gap-2">
                {[{ value: 'Easy', label: 'Easy' }, { value: 'Medium', label: 'Medium' }, { value: 'Difficult', label: 'Hard' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDifficulty(opt.value)}
                    className={cn(
                      "flex-1 rounded-xl h-11 font-black text-[11px] uppercase tracking-wide transition-all",
                      difficulty === opt.value
                        ? "bg-[#5C4033] text-white shadow-sm"
                        : "bg-[#F7F4EA] border border-[#E6DFC8] text-[#5F624F] hover:bg-[#E6DFC8]/50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button — full width */}
            <Button
              type="submit"
              disabled={isLoading || categories.length === 0 || currentCategoryIsFull || (isPictureRound && !topic.trim())}
              className="bg-[#5C4033] hover:bg-[#5C4033]/90 shadow-sm rounded-xl w-full h-12 font-black text-white text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Generate
                </span>
              )}
            </Button>

            {currentCategoryStat && (
              <p className="font-black text-[11px] text-center uppercase tracking-wider">
                <span className="text-[#5F624F]">Saved </span>
                <span className={cn("tabular-nums", currentCategoryIsFull ? "text-red-600" : "text-[#5C4033]")}>
                  {currentCategoryStat.currentCount}/{currentCategoryStat.question_count}
                </span>
              </p>
            )}

            {currentCategoryIsFull && (
              <p className="slide-in-from-top-1 ml-0.5 font-black text-[10px] text-red-600 uppercase tracking-wide animate-in fade-in">
                <AlertCircle className="inline -mt-0.5 mr-0.5 w-2.5 h-2.5" />
                {category} is full for this date
              </p>
            )}
            {isMusicSnippets && !spotifyConnected && (
              <div className="flex items-center gap-2">
                <a
                  href={`/api/spotify/login?return=${encodeURIComponent(`/event-setups/quiz-generator?category=${encodeURIComponent(category)}${selectedEventId ? `&event_id=${selectedEventId}` : ''}`)}`}
                  style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
                  className="flex items-center gap-1.5 px-3 py-2 text-white text-[10px] font-bold tracking-wider bg-(--spotify-bg) rounded-xl transition-opacity uppercase hover:opacity-90"
                >
                  <Music className="w-3.5 h-3.5" />
                  Connect Spotify
                </a>
                <span className="text-[#5F624F] text-[10px]">Required to play songs</span>
              </div>
            )}
          </div>
        )}
      </form>

      {error && (
        <div className="flex items-center gap-2.5 bg-red-50 slide-in-from-top-1 p-2.5 border border-red-100 rounded-xl text-red-700 animate-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <p className="font-bold text-[10px] uppercase leading-tight">{error}</p>
        </div>
      )}

      {/* DRAFT RESULTS SECTION */}
      {questions.length > 0 && (
        <div className="slide-in-from-bottom-3 space-y-2 bg-[#F7F4EA] p-2 sm:p-3 rounded-xl animate-in duration-500 fade-in">

          {/* STICKY ACTION BAR */}
          <div className="top-16 z-20 sticky flex justify-between items-center bg-white shadow-md p-2 border border-[#E6DFC8] rounded-lg">
            <div className="flex items-center gap-2 px-0.5">
              <div className="flex justify-center items-center bg-[#5C4033] rounded-md w-6 h-6 font-black text-[10px] text-white">
                {selectedIndices.size}
              </div>
              <span className="font-black text-[#5C4033] text-[10px] uppercase leading-none tracking-wider">Draft Items</span>
              {approveExceedsCapacity(selectedIndices.size) && (
                <span className="font-black text-[10px] text-red-600 uppercase leading-none tracking-wider">
                  Over limit · {currentCategoryStat!.currentCount + selectedIndices.size}/{currentCategoryStat!.question_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSelectAllQuestions}
                className="hover:bg-[#F7F4EA] px-3 border border-[#E6DFC8] rounded-md h-8 font-black text-[#5C4033] text-[10px] uppercase tracking-wider active:scale-95 transition-transform"
              >
                {allQuestionsSelected ? "Clear" : "Select all"}
              </button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving || selectedIndices.size === 0 || approveExceedsCapacity(selectedIndices.size)}
                className="bg-[#5C4033] px-4 rounded-md h-8 font-black text-[10px] text-white uppercase tracking-wider active:scale-95 transition-transform"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Approve
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* DRAFT CARDS GRID */}
          <div className="gap-2 grid grid-cols-1 md:grid-cols-2">
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
                    "group relative flex flex-col bg-white shadow-sm rounded-lg overflow-hidden transition-all cursor-pointer select-none",
                    isSelected
                      ? "border border-[#5C4033]/60 shadow-md"
                      : "border border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
                    <div className="flex-1 space-y-2 min-w-0">
                      <p className="font-bold text-[#1F1F1A] text-sm leading-snug">
                        {q.question}
                      </p>
                      <div className="bg-[#F7F4EA] px-2.5 py-1.5 rounded-md text-center">
                        <p className="font-black text-[#5C4033] text-xs leading-tight">
                          {q.answer}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "flex justify-center items-center mt-0.5 border-2 rounded-full w-5 h-5 transition-all duration-300 shrink-0",
                      isSelected
                        ? "bg-[#5C4033] border-[#5C4033] text-white"
                        : "bg-white border-[#E6DFC8] text-[#E6DFC8]"
                    )}>
                      {isSelected ? <Check className="stroke-4 w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
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
        <div className="slide-in-from-bottom-3 space-y-2 bg-[#F7F4EA] p-2 sm:p-3 rounded-xl animate-in duration-500 fade-in">

          {/* STICKY ACTION BAR */}
          <div className="top-16 z-20 sticky flex justify-between items-center bg-white shadow-md p-2 border border-[#E6DFC8] rounded-lg">
            <div className="flex items-center gap-2 px-0.5">
              <div className="flex justify-center items-center bg-[#5C4033] rounded-md w-6 h-6 font-black text-[10px] text-white">
                {selectedSnippetIndices.size}
              </div>
              <span className="font-black text-[#5C4033] text-[10px] uppercase leading-none tracking-wider">Songs</span>
              {approveExceedsCapacity(selectedSnippetIndices.size) && (
                <span className="font-black text-[10px] text-red-600 uppercase leading-none tracking-wider">
                  Over limit · {currentCategoryStat!.currentCount + selectedSnippetIndices.size}/{currentCategoryStat!.question_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSelectAllSnippets}
                className="hover:bg-[#F7F4EA] px-3 border border-[#E6DFC8] rounded-md h-8 font-black text-[#5C4033] text-[10px] uppercase tracking-wider active:scale-95 transition-transform"
              >
                {allSnippetsSelected ? "Clear" : "Select all"}
              </button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving || selectedSnippetIndices.size === 0 || approveExceedsCapacity(selectedSnippetIndices.size)}
                className="bg-[#5C4033] px-4 rounded-md h-8 font-black text-[10px] text-white uppercase tracking-wider active:scale-95 transition-transform"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Approve
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* SONG CARDS */}
          <div className="gap-2 grid grid-cols-1">
            {musicSnippets.map((song, idx) => {
              const isSelected = selectedSnippetIndices.has(idx)
              return (
                <div
                  key={idx}
                  className={cn(
                    "group relative bg-white shadow-sm rounded-lg overflow-hidden transition-all",
                    isSelected
                      ? "border border-[#5C4033]/60 shadow-md"
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
                    <div className="flex-1 min-w-0">
                      {isHigherOrLower && song.hint_year ? (
                        <div className="space-y-2">
                          <p className="text-[#1F1F1A] text-sm leading-snug">
                            <span className="font-bold italic">{song.artist} - {song.title}</span> higher or lower than <span className="font-bold text-orange-600">{song.hint_year}</span>?
                          </p>
                          <div className="bg-[#F7F4EA] px-2.5 py-1.5 rounded-md text-center">
                            <p className="font-black text-[#5C4033] text-xs leading-tight">
                              {song.year > song.hint_year ? 'Higher' : 'Lower'} - <span className={cn(
                                "font-bold italic",
                                song.year > song.hint_year ? "text-green-600" : "text-red-600"
                              )}>{song.year}</span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-bold text-[#1F1F1A] text-sm truncate leading-tight tracking-tight">
                            [{song.year}] {song.artist} — {song.title}
                          </p>
                          <p className="mt-0.5 font-medium text-[#5F624F] text-xs line-clamp-1 leading-tight">
                            {song.intro_description}
                          </p>
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "flex justify-center items-center border-2 rounded-full w-4.5 h-4.5 transition-all duration-300 shrink-0",
                      isSelected
                        ? "bg-[#5C4033] border-[#5C4033] text-white"
                        : "bg-white border-[#E6DFC8] text-[#E6DFC8]"
                    )}>
                      {isSelected ? <Check className="stroke-4 w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                    </div>
                  </div>

                  {/* Spotify player or fallback */}
                  <div className="px-2.5 pb-2" onClick={(e) => e.stopPropagation()}>
                    {song.spotify_track_id ? (
                      <SpotifyPlayer trackId={song.spotify_track_id} title={`${song.artist} - ${song.title}`} compact />
                    ) : (
                      <div className="flex items-center gap-1.5 bg-[#F7F4EA] px-2 py-1 rounded-md">
                        <AlertCircle className="w-2.5 h-2.5 text-[#5F624F] shrink-0" />
                        <span className="font-bold text-[#5F624F] text-[10px] uppercase tracking-wider">Not on Spotify</span>
                        <a
                          href={`https://open.spotify.com/search/${encodeURIComponent(song.artist + ' ' + song.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 ml-auto font-black text-[#5C4033] text-[10px] hover:underline uppercase tracking-wider"
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

      {/* PICTURE ROUND DRAFT SECTION */}
      {pictureItems.length > 0 && (
        <div className="slide-in-from-bottom-3 space-y-2 bg-[#F7F4EA] p-2 sm:p-3 rounded-xl animate-in duration-500 fade-in">
          {/* Sticky action bar */}
          <div className="top-16 z-20 sticky flex justify-between items-center bg-white shadow-md p-2 border border-[#E6DFC8] rounded-lg">
            <div className="flex items-center gap-2 px-0.5">
              <div className="flex justify-center items-center bg-[#5C4033] rounded-md w-6 h-6 font-black text-[10px] text-white">
                {selectedPictureIndices.size}
              </div>
              <span className="font-black text-[#5C4033] text-[10px] uppercase leading-none tracking-wider">Images</span>
              {approveExceedsCapacity(selectedPictureIndices.size) && (
                <span className="font-black text-[10px] text-red-600 uppercase leading-none tracking-wider">
                  Over limit · {currentCategoryStat!.currentCount + selectedPictureIndices.size}/{currentCategoryStat!.question_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSelectAllPictures}
                className="hover:bg-[#F7F4EA] px-3 border border-[#E6DFC8] rounded-md h-8 font-black text-[#5C4033] text-[10px] uppercase tracking-wider active:scale-95 transition-transform"
              >
                {allPicturesSelected ? "Clear" : "Select all"}
              </button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving || selectedPictureIndices.size === 0 || approveExceedsCapacity(selectedPictureIndices.size)}
                className="bg-[#5C4033] px-4 rounded-md h-8 font-black text-[10px] text-white uppercase tracking-wider active:scale-95 transition-transform"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Approve
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Picture cards grid */}
          <div className="gap-2 grid grid-cols-1">
            {pictureItems.map((item, idx) => {
              const isSelected = selectedPictureIndices.has(idx)
              return (
                <div
                  key={idx}
                  onClick={() => {
                    const next = new Set(selectedPictureIndices)
                    if (next.has(idx)) next.delete(idx)
                    else next.add(idx)
                    setSelectedPictureIndices(next)
                  }}
                  className={cn(
                    "group relative bg-white shadow-sm rounded-lg overflow-hidden transition-all cursor-pointer select-none",
                    isSelected
                      ? "border border-[#5C4033]/60 shadow-md"
                      : "border border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  {item.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.imageUrl} alt={item.answer} className="w-full h-52 object-cover" />
                  ) : (
                    <div className="flex justify-center items-center bg-[#F7F4EA] w-full h-52">
                      <ImageIcon className="w-10 h-10 text-[#E6DFC8]" />
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-1.5 p-2">
                    <p className="flex-1 min-w-0 font-black text-[#5C4033] text-xs truncate uppercase leading-tight tracking-tight">
                      {item.answer}
                    </p>
                    <div className={cn(
                      "flex justify-center items-center border-2 rounded-full w-4 h-4 transition-all duration-300 shrink-0",
                      isSelected
                        ? "bg-[#5C4033] border-[#5C4033] text-white"
                        : "bg-white border-[#E6DFC8] text-[#E6DFC8]"
                    )}>
                      {isSelected ? <Check className="stroke-4 w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SAVED SNIPPETS FOR EVENT */}
      {isMusicSnippets && savedSnippets.length > 0 && musicSnippets.length === 0 && questions.length === 0 && (
        <div className="space-y-2 bg-[#F7F4EA] p-2 sm:p-3 rounded-xl animate-in duration-500 fade-in">
          <p className="ml-0.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
            Saved Songs ({savedSnippets.length})
          </p>
          <div className="gap-2 grid grid-cols-1">
            {savedSnippets.map((snippet) => (
              <div key={snippet.id} className="bg-white shadow-sm border border-[#5C4033]/20 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <span className="bg-[#5C4033] px-1.5 py-0.5 rounded font-black text-[10px] text-white tracking-wider shrink-0">
                    {snippet.release_year || '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {isHigherOrLower && snippet.hint_year && (
                      <p className="font-black text-[10px] text-amber-700 leading-tight">
                        Is {(snippet.release_year ?? 0) > snippet.hint_year ? 'higher' : 'lower'} than {snippet.hint_year}?
                      </p>
                    )}
                    <p className="font-bold text-[#1F1F1A] text-[10px] truncate tracking-tight">
                      {snippet.answer_text_ext ?? snippet.answer_text}
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
                        if (selectedCategoryConfig) {
                          getMusicSnippetsForEventAction(selectedEventId, selectedCategoryConfig.id).then(setSavedSnippets).catch(() => {})
                          syncCategoryPlaylistAction(parseInt(selectedEventId), selectedCategoryConfig.id).catch(() => {})
                        }
                      }
                    }}
                    className="bg-red-50 hover:bg-red-100 rounded-lg w-7 h-7 text-red-600 shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {snippet.spotify_track_id && (
                  <div className="px-3 pb-2">
                    <SpotifyPlayer trackId={snippet.spotify_track_id} title={snippet.answer_text_ext ?? snippet.answer_text} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && questions.length === 0 && musicSnippets.length === 0 && pictureItems.length === 0 && (
        <div className={cn(
          "flex flex-col items-center bg-white/40 py-10 border border-[#E6DFC8] border-dashed rounded-xl text-center",
          isMusicSnippets && savedSnippets.length > 0 && "hidden"
        )}>
           {isPictureRound ? (
             <ImageIcon className="mb-2 w-6 h-6 text-[#5C4033]/10" />
           ) : isMusicSnippets ? (
             <Music className="mb-2 w-6 h-6 text-[#5C4033]/10" />
           ) : (
             <BookOpen className="mb-2 w-6 h-6 text-[#5C4033]/10" />
           )}
           <p className="opacity-40 font-black text-[#5F624F] text-[10px] uppercase tracking-[0.2em]">
             {isPictureRound ? 'Enter a topic and generate picture cards' : isMusicSnippets ? 'Generate song suggestions' : 'Select parameters to draft a round'}
           </p>
        </div>
      )}
      {ConfirmDialogUI}
    </div>
  )
}