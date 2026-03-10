'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

/**
 * Generates a quiz using the Gemini 1.5 Flash model.
 * Uses a highly compatible payload structure to prevent 404/400 errors across different environments.
 */
export async function generateQuizAction(topic: string, numberOfQuestions: number = 10): Promise<QuizQuestion[]> {
  const supabase = await createClient()

  // 1. Fetch recent questions from the database for semantic exclusion
  const { data: pastQuestions, error: dbError } = await supabase
    .from('past_quiz_questions')
    .select('question_text')
    .order('asked_on', { ascending: false })
    .limit(100);

  if (dbError) {
    console.error("Database fetch error:", dbError);
  }

  const pastQuestionsList = pastQuestions && pastQuestions.length > 0
    ? pastQuestions.map(q => q.question_text).join(' | ')
    : "None.";

  // 2. Prepare the Gemini API call
  // We use the stable v1beta endpoint and gemini-1.5-flash
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Combined prompt to maximize compatibility with all API versions
  const combinedPrompt = `Act as the Pub Quiz Master for "Don Fenticas". Generate a creative trivia round.

  TOPIC: ${topic || 'General Knowledge'}
  QUANTITY: ${numberOfQuestions} unique questions
  
  CRITICAL RULES:
  1. DO NOT repeat or use questions similar to these previously used ones: [${pastQuestionsList}]
  2. The tone must be fun and suitable for a local pub audience.
  3. Output the result ONLY as a RAW JSON array of objects.
  4. Each object MUST have keys: "question", "answer", "category".
  5. DO NOT include markdown formatting like \`\`\`json or any conversational text.`;

  const payload = {
    contents: [{ 
      parts: [{ text: combinedPrompt }] 
    }],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 4096,
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error Detail:", JSON.stringify(errorData, null, 2));
      
      if (response.status === 403) {
        throw new Error("API Key Permission Denied. Please ensure GEMINI_API_KEY is set in your .env file.");
      }
      
      throw new Error(`The AI Quiz Master encountered an error (${response.status}). Please try again.`);
    }

    const result = await response.json();
    const rawContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawContent) {
      throw new Error("The Quiz Master returned an empty script.");
    }

    // 3. Clean and Parse JSON
    // Some models include markdown backticks even when told not to; we strip them here.
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    const cleanedContent = jsonMatch ? jsonMatch[0] : rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(cleanedContent);
      return parsed as QuizQuestion[];
    } catch (parseErr) {
      console.error("Failed to parse AI JSON. Raw content:", rawContent);
      throw new Error("The AI response was not in a valid JSON format. Please try again.");
    }
    
  } catch (error: unknown) {
    console.error("AI Generation failed:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    throw new Error(message);
  }
}

/**
 * Fetches the most recent questions from the database.
 */
export async function getRecentQuestionsAction() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('past_quiz_questions')
    .select('question_text')
    .order('asked_on', { ascending: false })
    .limit(100);

  if (error) {
    console.error("Database fetch error:", error);
    return [];
  }

  return data.map(q => q.question_text);
}

/**
 * Saves selected questions to history.
 */
export async function saveQuizToDatabase(questions: QuizQuestion[]) {
  const supabase = await createClient()

  const insertData = questions.map(q => ({
    question_text: q.question,
    answer_text: q.answer,
    category: q.category,
    asked_on: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('past_quiz_questions')
    .insert(insertData);

  if (error) {
    console.error("Database save error:", error);
    throw new Error("Failed to record questions in history.");
  }

  revalidatePath('/quiz-generator');
  return { success: true };
}