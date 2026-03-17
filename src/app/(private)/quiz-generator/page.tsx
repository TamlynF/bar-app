'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateQuizAction, saveQuizToDatabase } from '@/app/(private)/quiz-generator/actions'
import { 
  Sparkles, 
  CheckCircle2, 
  BrainCircuit, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  FileCheck,
  Check,
  X,
  MessageSquareQuote,
  BookOpen,
  ChevronDown,
  Film,
  Music,
  Trophy,
  LayoutGrid
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

const CATEGORY_OPTIONS = [
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'general', label: 'General', icon: LayoutGrid },
]

export default function QuizGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [category, setCategory] = useState('movies')
  const [numQuestions, setNumQuestions] = useState(10)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isLoading) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const generated = await generateQuizAction(topic, category, numQuestions)
      setQuestions(generated)
      setSelectedIndices(new Set(generated.map((_, i) => i)))
      toast.success("Draft round generated!")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed.'
      setError(message)
      toast.error("AI Master is unavailable")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSelection = (index: number) => {
    const next = new Set(selectedIndices)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelectedIndices(next)
  }

  const toggleAll = () => {
    if (selectedIndices.size === questions.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(questions.map((_, i) => i)))
    }
  }

  const handleSave = async () => {
    const selectedData = questions.filter((_, i) => selectedIndices.has(i))
    if (selectedData.length === 0 || isSaving) return

    setIsSaving(true)
    
    try {
      await saveQuizToDatabase(selectedData)
      toast.success(`Approved ${selectedData.length} items!`)
      setQuestions([])
      setSelectedIndices(new Set())
      setTopic('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save to database.'
      toast.error("Failed to archive round.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-700 pb-32 text-left">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#26300D] rounded-lg shadow-md shrink-0">
            <BrainCircuit className="w-5 h-5 text-[#FDCC4B]" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[#1F1F1A] leading-none">AI Quiz Master</h1>
            <p className="text-[10px] text-[#5F624F] font-bold uppercase tracking-wider mt-1 opacity-60">Generate & Curate Trivia</p>
          </div>
        </div>
      </div>

      {/* Input Configuration Card */}
      <div className="bg-white border-2 border-[#E6DFC8] p-5 sm:p-6 rounded-[2rem] shadow-sm relative overflow-hidden">
        <form onSubmit={handleGenerate} className="space-y-4 relative z-10">
          
          {/* Row 1: Category (2/5) and Theme (3/5) */}
          <div className="flex flex-row gap-4 items-end w-full">
            <div className="w-2/5 shrink-0 space-y-1.5">
              <Label htmlFor="category" className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5F624F] ml-1">Category</Label>
              <div className="relative group">
                <select 
                  id="category"
                  title="Select quiz category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 rounded-xl border-2 border-[#E6DFC8] bg-[#F7F4EA]/20 px-3 py-2 text-sm font-bold appearance-none focus:ring-2 focus:ring-[#26300D]/10 focus:border-[#26300D] outline-none transition-all cursor-pointer"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F] pointer-events-none opacity-40" />
              </div>
            </div>

            <div className="w-full sm:flex-1 space-y-1.5">
              <Label htmlFor="topic" className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5F624F] ml-1">Specific Theme (Optional)</Label>
              <Input 
                id="topic" 
                placeholder="e.g. 90s Britpop, Disney, Olympics..." 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full h-11 rounded-xl border-2 border-[#E6DFC8] bg-[#F7F4EA]/20 text-sm font-bold focus:ring-[#26300D]/10 focus:border-[#26300D] transition-all"
              />
            </div>
          </div>

          {/* Row 2: Quantity (1/6) and Action Button (5/6) */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 items-end">
            <div className="sm:col-span-1 space-y-1.5">
              <Label htmlFor="numQuestions" className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5F624F] ml-1">Qty</Label>
              <Input 
                id="numQuestions" 
                type="number" 
                min="1" max="25"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="h-11 rounded-xl border-2 border-[#E6DFC8] bg-[#F7F4EA]/20 text-center font-black text-base text-[#26300D]"
              />
            </div>
            
            <div className="sm:col-span-5">
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full h-11 rounded-xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-[#1a2109] transition-all active:scale-[0.98] group"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing round...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" /> Draft New Round</>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-center gap-4 text-red-700 animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-bold leading-tight">{error}</p>
        </div>
      )}

      {/* Questions Deck */}
      {questions.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          {/* Batch Sticky Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#26300D] p-4 rounded-[2rem] shadow-2xl border border-white/5 sticky top-20 z-30">
             <div className="flex items-center gap-4 px-2">
                <div className="flex items-center gap-4">
                   <div className="bg-[#FDCC4B] text-[#26300D] w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-inner">
                      {selectedIndices.size}
                   </div>
                   <div className="flex flex-col text-left">
                      <span className="text-[#FDCC4B] text-[10px] font-black uppercase tracking-[0.2em] leading-none">Draft Batch</span>
                      <span className="text-white/40 text-[8px] font-bold uppercase mt-1 tracking-wider">Keep vs Skip</span>
                   </div>
                </div>
                <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block" />
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-white/60 hover:text-white text-[9px] font-black uppercase tracking-widest h-9 px-4 rounded-xl">
                   {selectedIndices.size === questions.length ? "Clear All" : "Keep All"}
                </Button>
             </div>

             <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => handleGenerate()} disabled={isLoading} className="flex-1 sm:flex-none rounded-xl h-10 border-white/20 text-white hover:bg-white/10 px-5 font-bold text-[10px] uppercase tracking-wider">
                  <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isLoading && "animate-spin")} />
                  Reroll
                </Button>
                <Button 
                  variant="default" 
                  onClick={handleSave} 
                  disabled={isSaving || selectedIndices.size === 0} 
                  className="flex-1 sm:flex-none rounded-xl h-10 bg-[#FDCC4B] text-[#26300D] px-7 font-black uppercase text-[10px] tracking-[0.15em] shadow-lg hover:bg-[#e5b843] active:scale-95 transition-transform"
                >
                  {isSaving ? "Saving..." : `Approve Round`}
                </Button>
             </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {questions.map((q, index) => {
              const isSelected = selectedIndices.has(index)
              return (
                <div 
                  key={index} 
                  onClick={() => toggleSelection(index)}
                  className={cn(
                    "group relative flex flex-col bg-white border-2 rounded-[2.25rem] transition-all cursor-pointer select-none overflow-hidden",
                    isSelected 
                      ? "border-[#26300D] shadow-lg translate-y-[-4px]" 
                      : "border-transparent border-dashed border-[#E6DFC8] opacity-60 hover:opacity-100 hover:border-solid hover:translate-y-[-2px]"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-between px-6 py-3.5 border-b-2 transition-colors",
                    isSelected ? "bg-[#26300D]/5 border-[#26300D]/10" : "bg-muted/10 border-[#E6DFC8]/40"
                  )}>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-[#26300D]/30 uppercase tracking-[0.25em]">Q{index + 1}</span>
                      <div className="px-2.5 py-0.5 rounded-lg bg-white border border-[#E6DFC8] text-[8px] font-black uppercase tracking-wider text-[#5F624F] shadow-xs">
                        {q.category}
                      </div>
                    </div>
                    
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-300 shadow-xs",
                      isSelected ? "bg-[#26300D] text-[#FDCC4B]" : "bg-white text-[#5F624F]/50 border border-[#E6DFC8]"
                    )}>
                      {isSelected ? <Check className="w-2.5 h-2.5 stroke-[4]" /> : <X className="w-2.5 h-2.5 stroke-[4]" />}
                      <span className="text-[8px] font-black uppercase tracking-widest">{isSelected ? "Keep" : "Skip"}</span>
                    </div>
                  </div>

                  <div className="px-8 py-7 flex-grow flex flex-col justify-between">
                    <div className="flex gap-4">
                       <MessageSquareQuote className="w-5 h-5 text-[#26300D] shrink-0 opacity-10" />
                       <p className="text-lg font-black text-[#1F1F1A] leading-[1.3] tracking-tight">
                         {q.question}
                       </p>
                    </div>
                    
                    <div className={cn(
                      "mt-6 p-5 rounded-2xl border-2 transition-all duration-500",
                      isSelected 
                        ? "bg-[#FDCC4B]/10 border-[#FDCC4B] shadow-inner" 
                        : "bg-[#F7F4EA]/40 border-transparent italic"
                    )}>
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] mb-2 text-[#26300D]/40">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        The Answer
                      </div>
                      <p className={cn(
                        "text-base font-black tracking-tight",
                        isSelected ? "text-[#26300D]" : "text-[#5F624F]/60"
                      )}>
                        {q.answer}
                      </p>
                    </div>
                  </div>
                  {/* Subtle Hover Glow */}
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#26300D]/20 rounded-[2.25rem] pointer-events-none transition-colors" />
                </div>
              )
            })}
          </div>

          <div className="pt-8 flex flex-col items-center gap-4 pb-24 text-center">
            <Button 
              onClick={handleSave} 
              disabled={isSaving || selectedIndices.size === 0} 
              size="lg" 
              className="rounded-full h-16 px-16 bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.3em] text-xs shadow-[0_15px_40px_rgba(38,48,13,0.3)] hover:scale-105 active:scale-95 transition-all group border-4 border-[#FDCC4B]/20"
            >
              {isSaving ? (
                <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Recording...</>
              ) : (
                <>Commit To History <FileCheck className="w-5 h-5 ml-3 group-hover:rotate-12 transition-transform" /></>
              )}
            </Button>
            <p className="text-[9px] font-bold text-[#5F624F] uppercase tracking-widest opacity-40">
              Only items marked &quot;Keep&quot; will be stored in your trivia database
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
        {!isLoading && questions.length === 0 && (
        <div className="py-24 text-center border-4 border-dashed border-[#E6DFC8] rounded-[3.5rem] bg-white/40 flex flex-col items-center">
           <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border-2 border-[#E6DFC8]">
              <BookOpen className="w-10 h-10 text-[#26300D]/20" />
           </div>
           <h2 className="font-black text-xl text-[#1F1F1A] uppercase tracking-tight">The Script is Blank</h2>
           <p className="text-xs text-[#5F624F] mt-3 uppercase tracking-[0.15em] opacity-60 max-w-xs leading-relaxed font-bold">
             Select your category and theme above to generate a fresh round of trivia for your next event.
           </p>
        </div>
      )}
    </div>
  )
}