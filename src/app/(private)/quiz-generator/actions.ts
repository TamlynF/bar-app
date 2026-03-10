'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

/**
 * Generates a quiz using Gemini 2.5 Flash.
 * Implements strict duplicate checking by providing historical context to the model.
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
  // Note: Leaving apiKey as empty string per instructions; the environment injects it.
  const apiKey = process.env.OPENAI_API_KEY || '';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const systemPrompt = `You are the ultimate Pub Quiz Master for "Don Fenticas". 
Generate a creative, balanced, and unique trivia quiz.

CRITICAL RULE: You MUST NOT generate any questions that are semantically similar to these previously used questions:
[${pastQuestionsList}]

Output your response as a valid JSON array of objects.`;

  const userQuery = `Generate ${numberOfQuestions} unique questions about the topic: "${topic || 'General Knowledge'}". 
Ensure the tone is fun and suitable for a local pub audience.`;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
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

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData: unknown = await response.json();
      console.error("API Error:", errorData);
      // More descriptive error for the user
      throw new Error("The AI Quiz Master is experiencing technical difficulties. Please try again in a moment.");
    }

    const result = await response.json();
    const rawContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawContent) {
      throw new Error("The Quiz Master returned an empty script.");
    }

    return JSON.parse(rawContent) as QuizQuestion[];
    
  } catch (error: unknown) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate quiz.";
    throw new Error(message);
  }
}

/**
 * Generates a quiz using Gemini 2.5 Flash.
 * Implements strict duplicate checking by passing historical questions to the model.
 */
export async function generateQuizActionPrev(topic: string, numberOfQuestions: number = 10): Promise<QuizQuestion[]> {
  const supabase = await createClient()

  // 1. Fetch past questions (e.g., from the last 6 months) to avoid duplicates
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: pastQuestions } = await supabase
    .from('past_quiz_questions')
    .select('question_text')
    .gte('asked_on', sixMonthsAgo.toISOString());

  // Format the past questions into a list for the prompt
  const pastQuestionsList = pastQuestions && pastQuestions.length > 0
    ? pastQuestions.map(q => `- ${q.question_text}`).join('\n')
    : "No previous questions.";

  // 2. Construct the AI Prompt
  const systemPrompt = `You are an expert pub quiz master. Generate a highly engaging trivia quiz.
You must return your response as a RAW JSON array of objects, with NO markdown formatting, NO backticks, and NO extra text.
Each object must have exactly these keys: "question", "answer", and "category".

CRITICAL RULE: To prevent asking the same questions to the regulars, you MUST NOT generate any questions that are semantically similar to these past questions:
${pastQuestionsList}

Please generate ${numberOfQuestions} unique questions about the topic: ${topic || 'General Knowledge'}.`;

  // 3. Call your AI Provider (Example using OpenAI - make sure OPENAI_API_KEY is in your .env)
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // or gpt-4o for better reasoning against duplicates
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
        throw new Error("Failed to fetch from AI provider");
    }

    const aiData = await response.json();
    const rawContent = aiData.choices[0].message.content;
    
    // Parse the JSON safely (assuming the AI followed instructions)
    const questions: QuizQuestion[] = JSON.parse(rawContent);
    return questions;
    
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate quiz. Please try again.");
  }
}

/**
 * Fetches the most recent questions from the database.
 * This list is passed to the AI to prevent semantic duplicates.
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
 * Saves only the selected questions to history.
 */
export async function saveQuizToDatabase(questions: { question: string; answer: string; category: string }[]) {
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