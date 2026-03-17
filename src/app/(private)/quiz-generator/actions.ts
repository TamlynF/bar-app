'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

export type PastQuestionRecord = {
  id: number;
  question_text: string;
  answer_text: string;
  category: string;
  asked_on: string;
}

/**
 * Generates a quiz using the Gemini 2.5 Flash model with Structured Outputs.
 */
export async function generateQuizAction(topic: string, category: string, numberOfQuestions: number = 10): Promise<QuizQuestion[]> {
  const supabase = await createClient()

  // 1. Fetch recent questions for exclusion to avoid repeats
  const { data: pastQuestions } = await supabase
    .from('past_quiz_questions')
    .select('question_text')
    .order('asked_on', { ascending: false })
    .limit(50);

  const pastQuestionsList = pastQuestions && pastQuestions.length > 0
    ? pastQuestions.map(q => q.question_text).join(' | ')
    : "None.";

  // 2. Setup Gemini API
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 
  //const model = "gemini-2.5-flash-preview-09-2025";
  const model = "gemini-2.5-flash";
  //const model = "gemini-3.1-flash-preview"; 
  //const model = "gemini-3.1-pro-preview";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

 const prompt = `Act as the Pub Quiz Master for "Don Fenticas". 
  Generate a creative trivia round specifically for the category: "${category}".
  ${topic ? `Focus specifically on this theme within that category: "${topic}".` : `Provide a balanced variety of questions within the "${category}" genre.`}
  
  Requirements:
  - Exactly ${numberOfQuestions} unique questions.
  - Difficulty: Mixture of easy, medium, and "bar-room debate" hard.
  - Style: Witty, engaging, and British pub culture appropriate.
  - Avoid these past questions: [${pastQuestionsList}].`;

  const payload = {
    contents: [{ 
      parts: [{ text: prompt }] 
    }],
    generationConfig: {
      temperature: 0.85,
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
          required: ["question", "answer", "category"]
        }
      }
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
      //console.error("Gemini API Error Detail:", JSON.stringify(errorData, null, 2));
      throw new Error(`The AI Quiz Master (Error ${response.status}): ${errorData.error?.message || 'Unknown Error'}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error("The Quiz Master returned an empty script.");
    }

    return JSON.parse(content) as QuizQuestion[];
    
  } catch (error: unknown) {
    console.error("AI Generation failed:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    throw new Error(message);
  }
}

/**
 * Fetches the detailed history of all past questions.
 */
export async function getFullQuestionHistoryAction(): Promise<PastQuestionRecord[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('past_quiz_questions')
    .select('*')
    .order('asked_on', { ascending: false });

  if (error) {
    console.error("Database fetch error:", error);
    return [];
  }

  return data as PastQuestionRecord[];
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
  revalidatePath('/quiz-generator/history');
  return { success: true };
}