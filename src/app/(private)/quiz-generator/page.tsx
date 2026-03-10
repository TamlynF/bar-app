'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Using relative import to resolve compilation and resolution issues
import { getRecentQuestionsAction, saveQuizToDatabase } from '@/app/(private)/quiz-generator/actions'
import { 
  Sparkles, 
  History, 
  CheckCircle2, 
  BrainCircuit, 
  Loader2, 
  Trophy,
  AlertCircle,
  RefreshCw,
  Check,
  Plus,
  FileCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

export default function QuizGeneratorPage() {
  const [topic, setTopic] = useState('')
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
      // 1. Fetch history from server to inform AI
      const pastQuestions = await getRecentQuestionsAction()
      const pastQuestionsList = pastQuestions.length > 0 ? pastQuestions.join(' | ') : "None."

      // 2. Call Gemini API directly on client to use injected Canvas API Key
      const apiKey = process.env.GEMINI_API_KEY || '';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const systemPrompt = `You are the Pub Quiz Master for "Don Fenticas". Generate a unique trivia round.
      CRITICAL RULE: Avoid any questions semantically similar to these previous ones: [${pastQuestionsList}]
      Output MUST be a RAW JSON array of objects with keys: "question", "answer", "category".`;

      const userQuery = `Generate ${numQuestions} unique trivia questions about "${topic || 'General Knowledge'}".`;

      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                "question": { "type": "STRING" },
                "answer": { "type": "STRING" },
                "category": { "type": "STRING" }
              },
              "required": ["question", "answer", "category"]
            }
          }
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json();
        console.error("Gemini API Error:", errJson);
        throw new Error("The Quiz Master is momentarily unavailable. Please check your connection and try again.");
      }

      const result = await response.json();
      const generated: QuizQuestion[] = JSON.parse(result.candidates[0].content.parts[0].text);
      
      setQuestions(generated)
      setSelectedIndices(new Set(generated.map((_, i) => i)))
      toast.success("Draft round generated!")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during generation.'
      setError(message)
      toast.error("Generation failed")
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
      toast.success(`${selectedData.length} questions recorded in history!`)
      setQuestions([])
      setSelectedIndices(new Set())
      setTopic('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save to database.'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-700 pb-24 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6DFC8] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-[#26300D] rounded-lg shadow-sm">
              <BrainCircuit className="w-5 h-5 text-[#FDCC4B]" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[#1F1F1A]">AI Quiz Master</h1>
          </div>
          <p className="text-sm text-[#5F624F] font-medium max-w-md">
            Draft your weekly trivia. Gemini checks your history to ensure regulars don&apos;t get duplicates.
          </p>
        </div>
      </div>

      {/* Input Card */}
      <div className="bg-white border border-[#E6DFC8] p-6 rounded-[2.5rem] shadow-sm space-y-6">
        <form onSubmit={handleGenerate} className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Topic / Theme</Label>
            <Input 
              id="topic" 
              placeholder="e.g. 80s Movies, World Capitals..." 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-12 rounded-xl border-[#E6DFC8] bg-[#F7F4EA]/30 text-base font-medium focus:ring-[#26300D]/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numQuestions" className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Quantity</Label>
            <div className="flex gap-3">
              <Input 
                id="numQuestions" 
                type="number" 
                min="1" max="25"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="h-12 rounded-xl border-[#E6DFC8] bg-[#F7F4EA]/30 w-24 text-center font-bold"
              />
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="flex-1 h-12 rounded-xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#1a2109] transition-all"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Thinking...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Items</>}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Results Deck */}
      {questions.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#26300D] p-5 rounded-[2rem] shadow-xl border border-white/5 sticky top-20 z-30">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                   <div className="bg-[#FDCC4B] text-[#26300D] w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-inner">
                      {selectedIndices.size}
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[#FDCC4B] text-[10px] font-black uppercase tracking-[0.15em] leading-none">Drafting</span>
                      <span className="text-white/40 text-[9px] font-bold uppercase mt-1">Items Selected</span>
                   </div>
                </div>
                <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block" />
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest h-8 px-4">
                   {selectedIndices.size === questions.length ? "Deselect All" : "Select All"}
                </Button>
             </div>

             <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => handleGenerate()} disabled={isLoading} className="flex-1 sm:flex-none rounded-xl h-10 border-white/20 text-white hover:bg-white/10 px-4 font-bold text-xs">
                  <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isLoading && "animate-spin")} />
                  Reroll
                </Button>
                <Button 
                  variant="default" 
                  onClick={handleSave} 
                  disabled={isSaving || selectedIndices.size === 0} 
                  className="flex-1 sm:flex-none rounded-xl h-10 bg-[#FDCC4B] text-[#26300D] px-8 font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-[#e5b843]"
                >
                  {isSaving ? "Saving..." : `Approve & Save`}
                </Button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((q, index) => {
              const isSelected = selectedIndices.has(index)
              return (
                <div 
                  key={index} 
                  onClick={() => toggleSelection(index)}
                  className={cn(
                    "group relative flex flex-col bg-white border-2 rounded-[2.25rem] p-7 transition-all cursor-pointer select-none",
                    isSelected 
                      ? "border-[#26300D] shadow-lg scale-[1.01] z-10" 
                      : "border-transparent opacity-50 grayscale hover:opacity-100 hover:grayscale-0 hover:border-[#E6DFC8]"
                  )}
                >
                  <div className={cn(
                    "absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                    isSelected ? "bg-[#26300D] rotate-0 shadow-md" : "bg-[#F7F4EA] -rotate-45"
                  )}>
                    {isSelected ? <FileCheck className="w-4 h-4 text-[#FDCC4B]" /> : <Plus className="w-4 h-4 text-[#5F624F] opacity-40" />}
                  </div>

                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-[11px] font-black text-[#5F624F]/30 uppercase tracking-[0.2em]">#{index + 1}</span>
                      <span className="text-[8px] font-black bg-[#F7F4EA] text-[#26300D] px-2.5 py-1 rounded-lg border border-[#E6DFC8] uppercase tracking-tighter">
                        {q.category}
                      </span>
                    </div>
                    
                    <p className="text-lg sm:text-xl font-black text-[#1F1F1A] mb-8 leading-[1.3] flex-grow tracking-tight pr-8">
                       {q.question}
                    </p>
                    
                    <div className={cn(
                      "p-5 rounded-2xl border transition-all duration-500",
                      isSelected ? "bg-[#26300D]/5 border-[#26300D]/10" : "bg-[#F7F4EA]/30 border-[#E6DFC8]/40"
                    )}>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-2 text-[#5F624F] opacity-50">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Official Answer
                      </div>
                      <p className="text-base font-black text-[#26300D] tracking-tight">{q.answer}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-10 flex justify-center pb-20">
            <Button 
              onClick={handleSave} 
              disabled={isSaving || selectedIndices.size === 0} 
              size="lg" 
              className="rounded-[1.5rem] h-16 px-20 bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.25em] shadow-2xl hover:scale-105 active:scale-95 transition-all"
            >
              {isSaving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Finalizing Round...</> : `Commit ${selectedIndices.size} Items to History`}
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && questions.length === 0 && (
        <div className="py-24 text-center border-2 border-dashed border-[#E6DFC8] rounded-[3.5rem] bg-white/40">
           <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-[#E6DFC8]">
              <History className="w-10 h-10 text-[#26300D]/30" />
           </div>
           <p className="font-black text-xl text-[#1F1F1A] uppercase tracking-tight">The Sheet is Blank</p>
           <p className="text-xs text-[#5F624F] mt-3 uppercase tracking-widest opacity-60 max-w-xs mx-auto leading-relaxed font-medium">
             Enter a theme above to generate a pool of trivia. You can then hand-pick the best ones to keep your rounds fresh.
           </p>
        </div>
      )}
    </div>
  )
}