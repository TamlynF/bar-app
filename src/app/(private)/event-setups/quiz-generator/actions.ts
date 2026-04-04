'use server'

import { createClient } from '@/lib/supabase/server'
import { create } from 'domain';
import { revalidatePath } from 'next/cache'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

export type PastQuestionRecord = {
  id: string; 
  question_text: string;
  answer_text: string;
  category: string;
  asked_on: string;
  events_id: number | null; 
  quiz_category_configs_id: number | null;
  quiz_category_configs?: {
    category_name: string;
  } | null;
}

export type QuizEventSummary = {
  id: number;
  title: string | null;
  date: string;
}

export type QuizCategoryConfig = {
  id: number;
  category_name: string;
  question_count: number;
  points_per_question: number;
}

/**
 * Retrieves all configured quiz categories.
 */
export async function getQuizCategoryConfigsAction(): Promise<QuizCategoryConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_category_configs")
    .select("*")
    .order("category_name", { ascending: true });

  if (error) {
    console.error("Error fetching quiz category configs:", error);
    return [];
  }
  return (data as QuizCategoryConfig[]) || [];
}

/**
 * Generates trivia using AI.
 */
export async function generateQuizAction(
  topic: string, 
  category: string, 
  numberOfQuestions: number = 10
): Promise<{ questions?: QuizQuestion[], error?: string }> {
  const supabase = await createClient()

  try {
    // 1. Fetch recent questions for exclusion to avoid duplicates
  const { data: pastQuestions } = await supabase
    .from('past_quiz_questions')
    .select('question_text')
    .order('asked_on', { ascending: false })
    .limit(50);

  const pastQuestionsList = pastQuestions?.length 
    ? pastQuestions.map(q => q.question_text).join(' | ')
    : "None.";

  // 2. Setup Gemini API
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 
    if (!apiKey) {
      return { error: "API Key is missing. Please check your environment variables." };
    }
  //const model = "gemini-2.5-flash-preview-09-2025";
  //const model = "gemini-1.5-flash";
  const model = "gemini-2.5-flash";
  //const model = "gemini-3.1-flash-preview"; 
  //const model = "gemini-3.1-pro-preview";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  //const prompt = `Act as the Pub Quiz Master. Generate a round for category: "${category}". ${topic ? `Theme: "${topic}"` : ""} Requirements: Exactly ${numberOfQuestions} unique questions. Format: JSON array.`;

 const prompt = `Act as the Pub Quiz Master for "Don Fenticas". 
  Generate a round for the category: "${category}".
  ${topic ? `Focus specifically on this theme within that category: "${topic}".` : `Provide a balanced variety of questions within the "${category}" genre.`}
  
  Requirements:
  - Exactly ${numberOfQuestions} unique questions.
  - Difficulty: Mixture of easy, medium, and "bar-room debate" hard.
  - Style: Easy to understand, simple, and British pub culture appropriate.
  - Avoid these past questions: [${pastQuestionsList}].
  - Format: JSON array.`;

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

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: `AI Error (${response.status}): ${errorData.error?.message || 'The Quiz Master is currently unavailable.'}` };
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      return { error: "The Quiz Master returned an empty script." };
    }

    const questions = JSON.parse(content) as QuizQuestion[];
    return { questions };
    
  } catch (error: unknown) {
    console.error("AI Generation failed:", error);
    return { error: "Connection lost or request timed out. Please try again." };
  }
}

/**
 * Fetches question history with category joins and event filtering.
 */
export async function getFullQuestionHistoryAction(eventIdFilter?: string): Promise<PastQuestionRecord[]> {
  const supabase = await createClient()

  let query = supabase
    .from('past_quiz_questions')
    .select('*, quiz_category_configs(category_name)')
    .order('asked_on', { ascending: false });

  if (eventIdFilter && eventIdFilter !== 'all') {
    query = query.eq('events_id', eventIdFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Database fetch error:", error);
    return [];
  }

  return data as unknown as PastQuestionRecord[];
}

/**
 * Updates an existing question.
 */
export async function updatePastQuestionAction(id: string, question: string, answer: string) {
  const supabase = await createClient()
    let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();

    if (user?.email) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (emp) currentEmployeeId = emp.id;
  }
  
  const { error } = await supabase
    .from('past_quiz_questions')
    .update({ 
      question_text: question, 
      answer_text: answer,
      updated_by: currentEmployeeId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error("Update error:", error);
    throw new Error("Failed to update question.");
  }
  return { success: true };
}

/**
 * Deletes a question from history.
 */
export async function deletePastQuestionAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('past_quiz_questions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Delete error:", error);
    throw new Error("Failed to delete question.");
  }
  return { success: true };
}

/**
 * Fetches events filtered by game/quiz types.
 */
export async function getQuizEventsAction(): Promise<QuizEventSummary[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('events')
      .select('id, title, date, event_types!inner(type, sub_type)')
      .eq('event_types.type', 'games')
      .eq('event_types.sub_type', 'quiz')
      .order('date', { ascending: false });
  
    if (error) {
      console.error("Error fetching quiz events:", error);
      return [];
    }
    return (data as unknown as QuizEventSummary[]) || [];
}

/**
 * Retrieves upcoming quiz events.
 */
export async function getUpcomingQuizzesAction(): Promise<QuizEventSummary[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('id, title, date, event_types!inner(type, sub_type)')
    .eq('event_types.type', 'games')
    .eq('event_types.sub_type', 'quiz')
    .gte('date', today)
    .order('date', { ascending: true });

  if (error) {
    console.error("Error fetching upcoming quizzes:", error);
    return [];
  }

  return (data as unknown as QuizEventSummary[]) || [];
}

/**
 * Saves quiz to database, automatically resolving category config IDs.
 * Now includes the 'topic' field for better historical tracking.
 */
export async function saveQuizToDatabase(questions: QuizQuestion[], eventId: number | null, topic: string) {
  const supabase = await createClient()

  let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();

    if (user?.email) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (emp) currentEmployeeId = emp.id;
  }


  const { data: configs } = await supabase.from('quiz_category_configs').select('id, category_name');
  const configMap = new Map(configs?.map(c => [c.category_name.toLowerCase(), c.id]));

  let askedOn = new Date().toISOString().split('T')[0];
  if (eventId) {
    const { data: event } = await supabase.from('events').select('date').eq('id', eventId).single();
    if (event?.date) askedOn = event.date;
  }

  const insertData = questions.map(q => ({
    question_text: q.question,
    answer_text: q.answer,
    category: q.category,
    topic: topic.trim() || null,
    asked_on: askedOn,
    events_id: eventId,
    quiz_category_configs_id: configMap.get(q.category.toLowerCase()) || null,
    created_by: currentEmployeeId,
    created_at: new Date().toISOString(),
    updated_by: currentEmployeeId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('past_quiz_questions')
    .insert(insertData);

  if (error) {
    console.error("Database save error:", error);
    throw new Error("Failed to record questions in history.");
  }

  revalidatePath('/event-setups/quiz-generator');
  revalidatePath('/event-setups/quiz-history');
  return { success: true };
}