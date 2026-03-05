'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateQuizAction, saveQuizToDatabase, type QuizQuestion } from './actions'

export default function QuizGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setQuestions([])

    try {
      const generated = await generateQuizAction(topic, numQuestions)
      setQuestions(generated)
    } catch (err) {
      setError('Failed to generate quiz. Check your AI API key and limits.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (questions.length === 0) return
    setIsSaving(true)
    
    try {
      await saveQuizToDatabase(questions)
      alert('Quiz saved successfully! These questions will now be avoided in future generations.')
      // Optionally clear the screen or print the quiz here
    } catch (err) {
      setError('Failed to save to database.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Quiz Night Generator</h1>
        <p className="text-muted-foreground mt-2">
          Generate unique trivia questions for Thursday night. The AI automatically checks the database to ensure these haven&apos;t been asked recently.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="bg-white/5 border p-6 rounded-xl space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="topic">Quiz Topic / Theme</Label>
            <Input 
              id="topic" 
              placeholder="e.g. 80s Movies, General Knowledge, Geography..." 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numQuestions">Number of Questions</Label>
            <Input 
              id="numQuestions" 
              type="number" 
              min="1" 
              max="50"
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
            />
          </div>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
          {isLoading ? "Consulting the Quiz Master..." : "Generate Unique Quiz"}
        </Button>
      </form>

      {error && <p className="text-red-500 font-medium">{error}</p>}

      {questions.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Your Generated Quiz</h2>
            <Button variant="default" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Approve & Save to History"}
            </Button>
          </div>

          <div className="grid gap-4">
            {questions.map((q, index) => (
              <div key={index} className="p-5 rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Question {index + 1}</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{q.category}</span>
                </div>
                <p className="text-lg font-medium mb-4">{q.question}</p>
                <div className="bg-muted p-3 rounded text-sm">
                  <span className="font-bold mr-2">Answer:</span> 
                  {q.answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}