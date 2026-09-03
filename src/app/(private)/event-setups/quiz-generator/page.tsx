'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

import { uploadPictureDrafts } from '@/lib/quiz/picture-upload'

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
  Target,
  Edit2,
  Trash2,
  Save,
  Music,
  ExternalLink,
  ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpotifyPlayer, isSpotifyConnected } from '@/components/spotify-player'
import { aiOrigin } from '@/lib/quiz/question-origin'
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
  const router = useRouter()
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
  
  const [viewingCategory, setViewingCategory] = useState<CategoryStat | null>(null)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ question: '', answer: '' })
  const [isActionPending, setIsActionPending] = useState(false)

  const [musicSnippets, setMusicSnippets] = useState<MusicSnippetCandidate[]>([])
  const [selectedSnippetIndices, setSelectedSnippetIndices] = useState<Set<number>>(new Set())
  const [savedSnippets, setSavedSnippets] = useState<SavedMusicSnippet[]>([])
  const [spotifyConnected, setSpotifyConnected] = useState(false)

  const [pictureItems, setPictureItems] = useState<PictureRoundItem[]>([])
  const [selectedPictureIndices, setSelectedPictureIndices] = useState<Set<number>>(new Set())
  const [pictureTopicLocked, setPictureTopicLocked] = useState(false)
  const [previousPictureAnswers, setPreviousPictureAnswers] = useState<string[]>([])
  // The model that produced the drafts on screen, so what gets saved records
  // that rather than whatever the settings say by the time Save is pressed.
  const [draftModel, setDraftModel] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(true)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (isSpotifyConnected() || urlParams.get('spotify_connected') === 'true') {
      setSpotifyConnected(true)
    }
  }, [])
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [events, categoryConfigs] = await Promise.all([
          getUpcomingQuizzesAction(),
          getQuizCategoryConfigsAction()
        ]);

        setUpcomingEvents(events);
        setCategories(categoryConfigs);

        const targetEventId = presetEventId && events.some(e => String(e.id) === presetEventId)
          ? presetEventId
          : events.length > 0 ? String(events[0].id) : '';
        if (targetEventId) {
          setSelectedEventId(targetEventId);
          loadEventHistory(targetEventId);
        }

        const targetCategory = presetCategory && categoryConfigs.some(c => c.category_name === presetCategory)
          ? presetCategory
          : categoryConfigs.length > 0 ? categoryConfigs[0].category_name : '';
        if (targetCategory) {
          setCategory(targetCategory);
        }
      } catch (err) {
        console.error("Failed to load setup data:", err);
        toast.error("Could not load categories or events from database");
      }
    }
    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const selectedEvent = upcomingEvents.find(event => String(event.id) === selectedEventId);

  const currentCategoryIsFull = currentCategoryStat?.isFull ?? false;
  const remainingQuestions = currentCategoryStat
    ? Math.max(currentCategoryStat.question_count - currentCategoryStat.currentCount, 0)
    : 0;
  const suggestedQuestionCount = remainingQuestions > 0
    ? Math.min(remainingQuestions + 2, 10)
    : 0;

  useEffect(() => {
    const hasDrafts = questions.length > 0 || musicSnippets.length > 0 || pictureItems.length > 0;
    if (!hasDrafts && suggestedQuestionCount > 0) {
      setNumQuestions(suggestedQuestionCount);
    }
  }, [category, selectedEventId, suggestedQuestionCount, questions.length, musicSnippets.length, pictureItems.length]);

  const approveExceedsCapacity = (selectedCount: number) => {
    if (!currentCategoryStat) return false;
    return currentCategoryStat.currentCount + selectedCount > currentCategoryStat.question_count;
  };

  const selectedDraftIndices = (total: number) =>
    new Set(Array.from({ length: Math.min(total, remainingQuestions) }, (_, index) => index));

  const canSelectAnother = (selectedCount: number) => {
    if (selectedCount < remainingQuestions) return true;
    toast.info(`${category} only needs ${remainingQuestions} more question${remainingQuestions === 1 ? '' : 's'}.`);
    return false;
  };

  const selectedCategoryConfig = useMemo(() => {
    return categories.find(c => c.category_name === category) || null
  }, [categories, category])

  const isMusicSnippets = selectedCategoryConfig?.include_spotify ?? false
  const isHigherOrLower = isMusicSnippets && (selectedCategoryConfig?.is_higher_lower ?? false)
  const isPictureRound = selectedCategoryConfig?.is_picture ?? false

  useEffect(() => {
    if (selectedEventId && selectedCategoryConfig?.include_spotify) {
      getMusicSnippetsForEventAction(selectedEventId, selectedCategoryConfig.id).then(setSavedSnippets).catch(() => {});
    } else {
      setSavedSnippets([])
    }
  }, [selectedEventId, selectedCategoryConfig])

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
          setDraftModel(result.model ?? null)
          setSelectedPictureIndices(selectedDraftIndices(result.items.length))
          setQuestions([])
          setMusicSnippets([])
          setFormOpen(false)
          toast.success("Picture suggestions are ready to review")
        }
      } else if (isMusicSnippets) {
        const result = await generateMusicSnippetsAction(numQuestions, topic, difficulty, parseInt(selectedEventId), selectedCategoryConfig!.id)
        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else if (result.songs) {
          setMusicSnippets(result.songs)
          setDraftModel(result.model ?? null)
          setSelectedSnippetIndices(selectedDraftIndices(result.songs.length))
          setQuestions([])
          setFormOpen(false)
          toast.success("Song suggestions are ready to review")
        }
      } else {
        const result = await generateQuizAction(topic, category, numQuestions, difficulty, parseInt(selectedEventId), selectedCategoryConfig!.id)
        if (result && 'error' in result && result.error) {
          setError(result.error)
          toast.error(result.error)
        } else if (result && 'questions' in result && result.questions) {
          setQuestions(result.questions)
          setDraftModel(result.model ?? null)
          setSelectedIndices(selectedDraftIndices(result.questions.length))
          setMusicSnippets([])
          setFormOpen(false)
          toast.success("Question suggestions are ready to review")
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

  const finishApproval = async (approvedCount: number) => {
    const target = currentCategoryStat?.question_count ?? approvedCount;
    const savedAfterApproval = (currentCategoryStat?.currentCount ?? 0) + approvedCount;
    const remainingAfterApproval = Math.max(target - savedAfterApproval, 0);

    await loadEventHistory(selectedEventId);

    if (remainingAfterApproval === 0) {
      const nextCategory = categoryStats.find(
        (stat) => stat.category_name !== category && !stat.isFull,
      )?.category_name;
      toast.success(`${category} is complete`);
      const focusCategory = nextCategory ?? category;
      router.push(`/event-setups/events/${selectedEventId}?category=${encodeURIComponent(focusCategory)}&completed=${encodeURIComponent(category)}`);
      router.refresh();
      return;
    }

    toast.success(`${approvedCount} added to ${category}. ${remainingAfterApproval} still needed.`);
    setNumQuestions(Math.min(remainingAfterApproval + 2, 10));
    setFormOpen(true);
  };

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
        const storedPictures = await uploadPictureDrafts(selectedData, parseInt(selectedEventId))
        await savePictureRoundAction(storedPictures, parseInt(selectedEventId), category, selectedCategoryConfig!.id, topic, difficulty, aiOrigin(draftModel ?? ""))
        setPictureItems([])
        setSelectedPictureIndices(new Set())
        await finishApproval(selectedData.length)
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
          })),
          parseInt(selectedEventId),
          category,
          selectedCategoryConfig!.id,
          topic,
          difficulty,
          undefined,
          aiOrigin(draftModel ?? "")
        )
        if (result?.needsConnect) {
          toast.warning("Connect Spotify on the event page to build the playlist.")
        }
        setMusicSnippets([])
        setSelectedSnippetIndices(new Set())
        await finishApproval(selectedData.length)
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
      await saveQuizToDatabase(
        selectedData.map(q => ({ ...q, category })),
        parseInt(selectedEventId),
        topic,
        difficulty,
        aiOrigin(draftModel ?? "")
      )
      setQuestions([])
      setSelectedIndices(new Set())
      await finishApproval(selectedData.length)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save to database.'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }


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
    if (!filterCategory) return questions;
    return questions.filter(q => q.category.toLowerCase() === filterCategory.toLowerCase());
  }, [questions, filterCategory]);

  const allQuestionsSelected = selectedIndices.size > 0
    && selectedIndices.size === Math.min(filteredQuestions.length, remainingQuestions);
  const toggleSelectAllQuestions = () => {
    const targetIdx = filteredQuestions.map(q => questions.indexOf(q));
    if (allQuestionsSelected) {
      setSelectedIndices(new Set());
      return;
    }
    setSelectedIndices(new Set(targetIdx.slice(0, remainingQuestions)));
  };

  const allSnippetsSelected = selectedSnippetIndices.size > 0
    && selectedSnippetIndices.size === Math.min(musicSnippets.length, remainingQuestions);
  const toggleSelectAllSnippets = () => {
    setSelectedSnippetIndices(
      allSnippetsSelected
        ? new Set()
        : new Set(musicSnippets.slice(0, remainingQuestions).map((_, i) => i))
    );
  };

  const allPicturesSelected = selectedPictureIndices.size > 0
    && selectedPictureIndices.size === Math.min(pictureItems.length, remainingQuestions);
  const toggleSelectAllPictures = () => {
    setSelectedPictureIndices(
      allPicturesSelected
        ? new Set()
        : new Set(pictureItems.slice(0, remainingQuestions).map((_, i) => i))
    );
  };

  const savedQuestionsForCategory = useMemo(() => {
    if (!viewingCategory) return [];
    return eventHistory.filter((q: PastQuestionRecord) => {
      const qCat = q.quiz_category_configs?.category_name || q.category;
      return qCat?.toLowerCase() === viewingCategory.category_name.toLowerCase();
    });
  }, [viewingCategory, eventHistory]);

  return (
    <div className="mx-auto max-w-6xl animate-in space-y-2 px-2 py-2 pb-32 text-left duration-700 fade-in sm:space-y-4 sm:px-6 sm:py-4">


      <Sheet open={!!viewingCategory} onOpenChange={(open) => {
        if(!open) {
          setViewingCategory(null)
          cancelEditing()
        }
      }}>
        <SheetContent 
          side="bottom" 
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-admin-line bg-admin-bg p-0 shadow-2xl outline-none"
        >
          {viewingCategory && (
            <>
              <SheetHeader className="sticky top-0 z-20 shrink-0 border-b border-admin-line bg-white/80 p-6 pb-4 text-left backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 font-bold text-[12px]",
                        viewingCategory.isFull ? "bg-admin-success-bg text-admin-success" : "bg-admin-warning-bg text-admin-warning"
                      )}>
                        {viewingCategory.isFull ? "Round complete" : "Round in progress"}
                      </span>
                    </div>
                    <SheetTitle className="font-bold text-2xl tracking-tighter text-admin-ink">
                      {viewingCategory.category_name}
                    </SheetTitle>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[12px] text-admin-muted opacity-60">Saved</p>
                    <p className="font-bold text-lg leading-none text-admin-primary tabular-nums">
                      {viewingCategory.currentCount} <span className="text-xs opacity-30">/</span> {viewingCategory.question_count}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div 
                ref={scrollContainerRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 text-left sm:p-6"
              >
                {savedQuestionsForCategory.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-4xl border-2 border-dashed border-admin-line bg-white text-admin-line">
                      <Plus className="h-8 w-8" />
                    </div>
                    <p className="font-bold text-sm tracking-tight text-admin-ink">No questions assigned yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 pb-6">
                    {savedQuestionsForCategory.map((record, i) => {
                      const isEditing = editingQuestionId === record.id;
                      
                      return (
                        <div key={record.id} className={cn(
                          "group relative overflow-hidden rounded-2xl border-2 bg-white p-4 shadow-sm transition-all",
                          isEditing ? "border-admin-primary ring-4 ring-admin-primary/5" : "border-admin-line"
                        )}>
                          {isEditing ? (
                            <div className="animate-in space-y-4 duration-200 zoom-in-95 fade-in">
                               <div className="space-y-1.5">
                                  <Label className="ml-1 font-bold text-[12px] text-admin-muted">Edit question</Label>
                                <textarea 
                                    title="Edit Question Text"
                                    value={editForm.question}
                                    onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                                    className="min-h-20 w-full resize-none rounded-xl border-2 border-admin-line bg-admin-bg/30 p-3 text-sm font-semibold outline-none focus:border-admin-primary"
                                  />
                               </div>
                               <div className="space-y-1.5">
                                  <Label className="ml-1 font-bold text-[12px] text-admin-muted">Edit answer</Label>
                                  <Input 
                                    value={editForm.answer}
                                    onChange={(e) => setEditForm({...editForm, answer: e.target.value})}
                                    className="h-11 rounded-xl border-2 border-admin-primary/15 bg-admin-primary/10 font-semibold text-sm text-admin-primary focus:border-admin-primary"
                                  />
                               </div>
                               <div className="flex gap-2 pt-2">
                                  <Button 
                                    onClick={() => saveEdit(record.id)}
                                    disabled={isActionPending}
                                    className="h-10 flex-1 rounded-xl bg-admin-primary font-semibold text-[12px] tracking-wide text-white"
                                  >
                                    {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-3.5 w-3.5" /> Save changes</>}
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    onClick={cancelEditing}
                                    disabled={isActionPending}
                                    className="h-10 rounded-xl border-2 border-admin-line px-4 text-[12px] font-bold text-admin-muted"
                                  >
                                    Cancel
                                  </Button>
                               </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-start gap-4">
                                {record.release_year ? (
                                  <span className="mt-0.5 shrink-0 rounded-lg bg-admin-primary px-2 py-1 font-semibold text-[12px] tracking-wider text-white">
                                    {record.release_year}
                                  </span>
                                ) : (
                                  <span className="mt-1 shrink-0 font-bold text-[12px] text-admin-primary/20">Q{i+1}</span>
                                )}
                                <div className="min-w-0 flex-1 space-y-3">
                                  {record.image_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={record.image_url} alt={record.answer_text} className="h-40 w-full rounded-xl object-cover" />
                                  ) : !record.spotify_track_id && record.question_text ? (
                                    <p className="text-sm leading-snug font-bold text-admin-ink">{record.question_text}</p>
                                  ) : null}
                                  <div className="flex w-fit items-center gap-2 rounded-xl bg-admin-primary px-3 py-2 text-white shadow-sm">
                                    <Target className="h-3 w-3 text-white/50" />
                                    <span className="font-bold text-xs tracking-tight">{record.answer_text}</span>
                                  </div>
                                </div>

                                <div className="flex shrink-0 flex-col gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEditing(record)}
                                    className="h-9 w-9 rounded-xl bg-admin-bg text-admin-muted hover:bg-admin-primary/5 hover:text-admin-primary"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      const ok = await confirm({ title: "Delete question", description: "Delete this question? This cannot be undone.", confirmLabel: "Delete", variant: "destructive" })
                                      if (ok) deleteQuestion(record.id)
                                    }}
                                    className="h-9 w-9 rounded-xl bg-red-50 text-admin-error hover:bg-red-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
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

              <div className="z-20 shrink-0 border-t border-admin-line bg-white/80 p-6 pt-2 pb-10 backdrop-blur-md">
                <Button 
                  className="h-12 w-full rounded-2xl bg-admin-primary font-semibold text-xs tracking-wide text-white shadow-lg transition-transform active:scale-95"
                  onClick={() => {
                    setFilterCategory(viewingCategory.category_name);
                    setCategory(viewingCategory.category_name);
                    setViewingCategory(null);
                    const remaining = viewingCategory.question_count - viewingCategory.currentCount;
                    setNumQuestions(remaining > 0 ? remaining : viewingCategory.question_count);
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> 
                  {viewingCategory.isFull ? "Generate extra items" : "Generate remaining items"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <form onSubmit={handleGenerate} className="overflow-hidden rounded-2xl border border-admin-line bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setFormOpen(o => !o)}
          className="flex w-full items-center justify-between bg-admin-bg px-4 py-3 text-left transition-colors hover:bg-admin-surface"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-admin-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-admin-primary">
                {category || 'Select a category'}
              </p>
              <p className="truncate text-[12px] font-medium text-admin-muted">
                {selectedEvent?.title || 'Quiz event'} · {selectedEvent?.date ? format(new Date(`${selectedEvent.date}T00:00:00`), "d MMM") : '-'}
              </p>
            </div>
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200",
            formOpen && "rotate-180"
          )} />
        </button>

        {formOpen && (
          <div className="space-y-4 border-t border-admin-line p-4">
            <div className="space-y-1.5">
              <Label className="ml-0.5 block text-left text-[13px] font-semibold text-admin-ink">
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
                  "h-11 w-full rounded-xl border px-3 text-xs font-bold focus:ring-0",
                  currentCategoryIsFull || pictureTopicLocked
                    ? "border-admin-line bg-admin-bg text-admin-muted placeholder:text-admin-muted/40"
                    : "border-admin-line bg-admin-bg focus:border-admin-primary"
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="ml-0.5 block text-left text-[13px] font-semibold text-admin-ink">Difficulty</Label>
              <div className="flex gap-2">
                {['Easy', 'Medium', 'Hard'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDifficulty(opt)}
                    className={cn(
                      "h-11 flex-1 rounded-xl text-[13px] font-semibold transition-all",
                      difficulty === opt
                        ? "bg-admin-primary text-white shadow-sm"
                        : "border border-admin-line bg-admin-bg text-admin-muted hover:bg-admin-line/50"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || categories.length === 0 || currentCategoryIsFull || (isPictureRound && !topic.trim())}
              className="h-12 w-full rounded-xl bg-admin-primary text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-admin-primary-hover active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate {numQuestions} suggestion{numQuestions === 1 ? '' : 's'}
                </span>
              )}
            </Button>

            {currentCategoryStat && (
              <p className="text-center text-[13px] font-medium text-admin-muted">
                <span className="font-semibold text-admin-primary tabular-nums">{currentCategoryStat.currentCount} of {currentCategoryStat.question_count}</span> saved
                {!currentCategoryIsFull && <> · {remainingQuestions} still needed</>}
              </p>
            )}

            {currentCategoryIsFull && (
              <p className="ml-0.5 animate-in text-[12px] font-semibold text-admin-success fade-in slide-in-from-top-1">
                <AlertCircle className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
                {category} is complete for this quiz
              </p>
            )}
            {isMusicSnippets && !spotifyConnected && (
              <div className="flex items-center gap-2">
                <a
                  href={`/api/spotify/login?return=${encodeURIComponent(`/event-setups/quiz-generator?category=${encodeURIComponent(category)}${selectedEventId ? `&event_id=${selectedEventId}` : ''}`)}`}
                  style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
                  className="flex items-center gap-1.5 rounded-xl bg-(--spotify-bg) px-3 py-2 text-[12px] font-bold tracking-wider text-white transition-opacity hover:opacity-90"
                >
                  <Music className="h-3.5 w-3.5" />
                  Connect Spotify
                </a>
                <span className="text-[12px] text-admin-muted">Required to play songs</span>
              </div>
            )}
          </div>
        )}
      </form>

      {error && (
        <div className="flex animate-in items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-700 slide-in-from-top-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <p className="text-[12px] leading-tight font-bold">{error}</p>
        </div>
      )}

      {questions.length > 0 && (
        <div className="animate-in space-y-2 rounded-xl bg-admin-bg p-2 duration-500 fade-in slide-in-from-bottom-3 sm:p-3">

          <div className="sticky top-16 z-20 flex items-center justify-between rounded-lg border border-admin-line bg-white p-2 shadow-md">
            <div className="flex items-center gap-2 px-0.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-admin-primary font-semibold text-[12px] text-white">
                {selectedIndices.size}
              </div>
              <span className="text-[12px] leading-none font-semibold text-admin-primary">
                {selectedIndices.size} selected · {remainingQuestions} needed
              </span>
              {approveExceedsCapacity(selectedIndices.size) && (
                <span className="font-bold text-[12px] leading-none text-admin-error">
                  Over limit · {currentCategoryStat!.currentCount + selectedIndices.size}/{currentCategoryStat!.question_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSelectAllQuestions}
                className="h-9 rounded-lg border border-admin-line px-3 text-[12px] font-semibold text-admin-primary transition-colors hover:bg-admin-surface"
              >
                {allQuestionsSelected ? "Clear" : "Select recommended"}
              </button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving || selectedIndices.size === 0 || approveExceedsCapacity(selectedIndices.size)}
                className="h-9 rounded-lg bg-admin-primary px-4 text-[12px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Add {selectedIndices.size}<span className="hidden sm:inline"> to {category}</span>
                  </span>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {filteredQuestions.map((q, idx) => {
              const originalIndex = questions.indexOf(q);
              const isSelected = selectedIndices.has(originalIndex);
              return (
                <div
                  key={idx}
                  onClick={() => {
                    const next = new Set(selectedIndices);
                    if (next.has(originalIndex)) {
                      next.delete(originalIndex);
                    } else {
                      if (!canSelectAnother(next.size)) return;
                      next.add(originalIndex);
                    }
                    setSelectedIndices(next);
                  }}
                  className={cn(
                    "group relative flex cursor-pointer flex-col overflow-hidden rounded-lg bg-white shadow-sm transition-all select-none",
                    isSelected
                      ? "border border-admin-primary/60 shadow-md"
                      : "border border-admin-line hover:border-admin-primary/40"
                  )}
                >
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm leading-snug font-bold text-admin-ink">
                        {q.question}
                      </p>
                      <div className="rounded-md bg-admin-bg px-2.5 py-1.5 text-center">
                        <p className="font-bold text-xs leading-tight text-admin-primary">
                          {q.answer}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                      isSelected
                        ? "border-admin-primary bg-admin-primary text-white"
                        : "border-admin-line bg-white text-admin-line"
                    )}>
                      {isSelected ? <Check className="h-2.5 w-2.5 stroke-4" /> : <Plus className="h-2.5 w-2.5" />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {musicSnippets.length > 0 && (
        <div className="animate-in space-y-2 rounded-xl bg-admin-bg p-2 duration-500 fade-in slide-in-from-bottom-3 sm:p-3">

          <div className="sticky top-16 z-20 flex items-center justify-between rounded-lg border border-admin-line bg-white p-2 shadow-md">
            <div className="flex items-center gap-2 px-0.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-admin-primary font-semibold text-[12px] text-white">
                {selectedSnippetIndices.size}
              </div>
              <span className="text-[12px] leading-none font-semibold text-admin-primary">
                {selectedSnippetIndices.size} selected · {remainingQuestions} needed
              </span>
              {approveExceedsCapacity(selectedSnippetIndices.size) && (
                <span className="font-bold text-[12px] leading-none text-admin-error">
                  Over limit · {currentCategoryStat!.currentCount + selectedSnippetIndices.size}/{currentCategoryStat!.question_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSelectAllSnippets}
                className="h-9 rounded-lg border border-admin-line px-3 text-[12px] font-semibold text-admin-primary transition-colors hover:bg-admin-surface"
              >
                {allSnippetsSelected ? "Clear" : "Select recommended"}
              </button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving || selectedSnippetIndices.size === 0 || approveExceedsCapacity(selectedSnippetIndices.size)}
                className="h-9 rounded-lg bg-admin-primary px-4 text-[12px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Add {selectedSnippetIndices.size}<span className="hidden sm:inline"> to {category}</span>
                  </span>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {musicSnippets.map((song, idx) => {
              const isSelected = selectedSnippetIndices.has(idx)
              return (
                <div
                  key={idx}
                  className={cn(
                    "group relative overflow-hidden rounded-lg bg-white shadow-sm transition-all",
                    isSelected
                      ? "border border-admin-primary/60 shadow-md"
                      : "border border-admin-line hover:border-admin-primary/40"
                  )}
                >
                  <div
                    className="flex cursor-pointer items-center gap-2 px-2.5 py-2 select-none"
                    onClick={() => {
                      const next = new Set(selectedSnippetIndices)
                      if (next.has(idx)) {
                        next.delete(idx)
                      } else {
                        if (!canSelectAnother(next.size)) return
                        next.add(idx)
                      }
                      setSelectedSnippetIndices(next)
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      {isHigherOrLower ? (
                        <div className="space-y-2">
                          <p className="truncate text-sm leading-tight font-bold tracking-tight text-admin-ink">
                            {song.artist} - {song.title}
                          </p>
                          {/* The year each song is compared against comes from the
                              song before it, so it is only settled on save. */}
                          <p className="mt-0.5 text-xs leading-tight font-medium text-admin-muted">
                            Released {song.year} - compared against whichever song comes before it.
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="truncate text-sm leading-tight font-bold tracking-tight text-admin-ink">
                            [{song.year}] {song.artist} - {song.title}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs leading-tight font-medium text-admin-muted">
                            {song.intro_description}
                          </p>
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                      isSelected
                        ? "border-admin-primary bg-admin-primary text-white"
                        : "border-admin-line bg-white text-admin-line"
                    )}>
                      {isSelected ? <Check className="h-2.5 w-2.5 stroke-4" /> : <Plus className="h-2.5 w-2.5" />}
                    </div>
                  </div>

                  <div className="px-2.5 pb-2" onClick={(e) => e.stopPropagation()}>
                    {song.spotify_track_id ? (
                      <SpotifyPlayer trackId={song.spotify_track_id} title={`${song.artist} - ${song.title}`} compact />
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-md bg-admin-bg px-2 py-1">
                        <AlertCircle className="h-2.5 w-2.5 shrink-0 text-admin-muted" />
                        <span className="text-[12px] font-bold text-admin-muted">Not on Spotify</span>
                        <a
                          href={`https://open.spotify.com/search/${encodeURIComponent(song.artist + ' ' + song.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-0.5 font-bold text-[12px] text-admin-primary hover:underline"
                        >
                          Search <ExternalLink className="h-2.5 w-2.5" />
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

      {pictureItems.length > 0 && (
        <div className="animate-in space-y-2 rounded-xl bg-admin-bg p-2 duration-500 fade-in slide-in-from-bottom-3 sm:p-3">
          <div className="sticky top-16 z-20 flex items-center justify-between rounded-lg border border-admin-line bg-white p-2 shadow-md">
            <div className="flex items-center gap-2 px-0.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-admin-primary font-semibold text-[12px] text-white">
                {selectedPictureIndices.size}
              </div>
              <span className="text-[12px] leading-none font-semibold text-admin-primary">
                {selectedPictureIndices.size} selected · {remainingQuestions} needed
              </span>
              {approveExceedsCapacity(selectedPictureIndices.size) && (
                <span className="font-bold text-[12px] leading-none text-admin-error">
                  Over limit · {currentCategoryStat!.currentCount + selectedPictureIndices.size}/{currentCategoryStat!.question_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSelectAllPictures}
                className="h-9 rounded-lg border border-admin-line px-3 text-[12px] font-semibold text-admin-primary transition-colors hover:bg-admin-surface"
              >
                {allPicturesSelected ? "Clear" : "Select recommended"}
              </button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving || selectedPictureIndices.size === 0 || approveExceedsCapacity(selectedPictureIndices.size)}
                className="h-9 rounded-lg bg-admin-primary px-4 text-[12px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Add {selectedPictureIndices.size}<span className="hidden sm:inline"> to {category}</span>
                  </span>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {pictureItems.map((item, idx) => {
              const isSelected = selectedPictureIndices.has(idx)
              return (
                <div
                  key={idx}
                  onClick={() => {
                    const next = new Set(selectedPictureIndices)
                    if (next.has(idx)) {
                      next.delete(idx)
                    } else {
                      if (!canSelectAnother(next.size)) return
                      next.add(idx)
                    }
                    setSelectedPictureIndices(next)
                  }}
                  className={cn(
                    "group relative cursor-pointer overflow-hidden rounded-lg bg-white shadow-sm transition-all select-none",
                    isSelected
                      ? "border border-admin-primary/60 shadow-md"
                      : "border border-admin-line hover:border-admin-primary/40"
                  )}
                >
                  {item.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.imageUrl} alt={item.answer} className="h-52 w-full object-cover" />
                  ) : (
                    <div className="flex h-52 w-full items-center justify-center bg-admin-bg">
                      <ImageIcon className="h-10 w-10 text-admin-line" />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1.5 p-2">
                    <p className="min-w-0 flex-1 truncate font-bold text-xs leading-tight tracking-tight text-admin-primary">
                      {item.answer}
                    </p>
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                      isSelected
                        ? "border-admin-primary bg-admin-primary text-white"
                        : "border-admin-line bg-white text-admin-line"
                    )}>
                      {isSelected ? <Check className="h-2.5 w-2.5 stroke-4" /> : <Plus className="h-2.5 w-2.5" />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isMusicSnippets && savedSnippets.length > 0 && musicSnippets.length === 0 && questions.length === 0 && (
        <div className="animate-in space-y-2 rounded-xl bg-admin-bg p-2 duration-500 fade-in sm:p-3">
          <p className="ml-0.5 font-bold text-[12px] text-admin-muted">
            Saved songs ({savedSnippets.length})
          </p>
          <div className="grid grid-cols-1 gap-2">
            {savedSnippets.map((snippet) => (
              <div key={snippet.id} className="overflow-hidden rounded-lg border border-admin-primary/20 bg-white shadow-sm">
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <span className="shrink-0 rounded bg-admin-primary px-1.5 py-0.5 font-semibold text-[12px] tracking-wider text-white">
                    {snippet.release_year || '-'}
                  </span>
                  <div className="min-w-0 flex-1">
                    {isHigherOrLower && snippet.hint_year && (
                      <p className="font-bold text-[12px] leading-tight text-amber-700">
                        Is {(snippet.release_year ?? 0) > snippet.hint_year ? 'higher' : 'lower'} than {snippet.hint_year}?
                      </p>
                    )}
                    <p className="truncate text-[12px] font-bold tracking-tight text-admin-ink">
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
                    className="h-7 w-7 shrink-0 rounded-lg bg-red-50 text-admin-error hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" />
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

      {!isLoading && questions.length === 0 && musicSnippets.length === 0 && pictureItems.length === 0 && (
        <div className={cn(
          "flex flex-col items-center rounded-xl border border-dashed border-admin-line bg-white/40 py-10 text-center",
          isMusicSnippets && savedSnippets.length > 0 && "hidden"
        )}>
           {isPictureRound ? (
             <ImageIcon className="mb-2 h-6 w-6 text-admin-primary/10" />
           ) : isMusicSnippets ? (
             <Music className="mb-2 h-6 w-6 text-admin-primary/10" />
           ) : (
             <BookOpen className="mb-2 h-6 w-6 text-admin-primary/10" />
           )}
           <p className="font-bold text-[12px] text-admin-muted opacity-40">
             {isPictureRound ? 'Enter a topic and generate picture cards' : isMusicSnippets ? 'Generate song suggestions' : 'Select parameters to draft a round'}
           </p>
        </div>
      )}
      {ConfirmDialogUI}
    </div>
  )
}
