'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Using relative import to resolve compilation and resolution issues
import { generateQuizAction, saveQuizToDatabase, type QuizQuestion } from './actions'
import { 
  Sparkles, 
  History, 
  CheckCircle2, 
  BrainCircuit, 
  Loader2, 
  Trophy,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function QuizGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isLoading) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const generated = await generateQuizAction(topic, numQuestions)
      setQuestions(generated)
      toast.success("New unique quiz generated!")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate quiz.'
      setError(message)
      toast.error("Generation failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (questions.length === 0 || isSaving) return
    setIsSaving(true)
    
    try {
      await saveQuizToDatabase(questions)
      toast.success("Quiz saved! These will be avoided in future sessions.")
      setQuestions([])
      setTopic('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save to database.'
      setError(message)
      toast.error("Save failed")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6DFC8] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-[#26300D] rounded-lg">
              <BrainCircuit className="w-5 h-5 text-[#FDCC4B]" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[#1F1F1A]">AI Quiz Master</h1>
          </div>
          <p className="text-sm text-[#5F624F] font-medium max-w-md text-left">
            Generate unique trivia for Thursday night. Gemini automatically checks your database to ensure regulars don&apos;t get the same questions twice.
          </p>
        </div>
      </div>

      {/* Generator Form */}
      <div className="bg-white border border-[#E6DFC8] p-6 rounded-[2rem] shadow-sm space-y-6">
        <form onSubmit={handleGenerate} className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 text-left">
            <Label htmlFor="topic" className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
              Quiz Theme
            </Label>
            <Input 
              id="topic" 
              placeholder="e.g. 90s Pop, British History, Sci-Fi..." 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-12 rounded-xl border-[#E6DFC8] bg-[#F7F4EA]/30 focus:ring-[#26300D]/10"
            />
          </div>
          <div className="space-y-2 text-left">
            <Label htmlFor="numQuestions" className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
              Questions Count
            </Label>
            <div className="flex gap-3">
              <Input 
                id="numQuestions" 
                type="number" 
                min="1" 
                max="30"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="h-12 rounded-xl border-[#E6DFC8] bg-[#F7F4EA]/30 w-24"
              />
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="flex-1 h-12 rounded-xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#1a2109] active:scale-[0.98] transition-all"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Thinking...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Quiz</>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Results Display */}
      {questions.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#26300D]" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#1F1F1A]">Draft Quiz</h2>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" onClick={() => handleGenerate()} disabled={isLoading} className="rounded-full h-9 border-[#E6DFC8] text-[#5F624F]">
                  <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
                  Retry
               </Button>
               <Button variant="default" onClick={handleSave} disabled={isSaving} className="rounded-full h-9 bg-[#26300D] text-[#FDCC4B] px-6 font-black uppercase text-[10px] tracking-widest shadow-md">
                {isSaving ? "Saving..." : "Approve & Save"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {questions.map((q, index) => (
              <div 
                key={index} 
                className="group relative bg-white border border-[#E6DFC8] rounded-2xl p-5 shadow-sm hover:border-[#26300D] transition-colors text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-[#5F624F] uppercase tracking-[0.2em] opacity-50">Question {index + 1}</span>
                  <span className="text-[9px] font-black bg-[#F7F4EA] text-[#26300D] px-2 py-0.5 rounded-full border border-[#E6DFC8] uppercase">
                    {q.category}
                  </span>
                </div>
                <p className="text-lg font-bold text-[#1F1F1A] mb-4 leading-tight">{q.question}</p>
                <div className="bg-[#26300D]/5 p-4 rounded-xl border border-[#26300D]/10">
                  <div className="flex items-center gap-2 text-[9px] font-black text-[#26300D] uppercase tracking-widest mb-1 opacity-60">
                    <CheckCircle2 className="w-3 h-3" />
                    Correct Answer
                  </div>
                  <p className="text-sm font-bold text-[#26300D]">{q.answer}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-center pb-12">
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              size="lg" 
              className="rounded-2xl h-14 px-12 bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              {isSaving ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Storing in History</>
              ) : (
                "Finalize This Quiz"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && questions.length === 0 && (
        <div className="py-20 text-center border-2 border-dashed border-[#E6DFC8] rounded-[3rem] bg-white/40">
           <History className="w-12 h-12 text-[#E6DFC8] mx-auto mb-4" />
           <p className="font-black text-[#1F1F1A] uppercase tracking-tight">Ready for a new round?</p>
           <p className="text-[10px] text-[#5F624F] mt-2 uppercase tracking-widest opacity-60 max-w-xs mx-auto">
             Enter a topic above to generate a unique list of trivia questions.
           </p>
        </div>
      )}
    </div>
  )
}