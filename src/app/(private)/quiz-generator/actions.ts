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
 * Implements strict duplicate checking by passing historical questions to the model.
 */
export async function generateQuizActionGemini(topic: string, numberOfQuestions: number = 10): Promise<QuizQuestion[]> {
  const supabase = await createClient()

  // 1. Fetch past questions to ensure uniqueness
  // We fetch the most recent 150 questions to keep the prompt context manageable but effective
  const { data: pastQuestions } = await supabase
    .from('past_quiz_questions')
    .select('question_text')
    .order('asked_on', { ascending: false })
    .limit(150);

  const pastQuestionsList = pastQuestions && pastQuestions.length > 0
    ? pastQuestions.map(q => q.question_text).join('|')
    : "None.";

  // 2. Prepare the Gemini API call
  const apiKey = ""; // Canvas provides this automatically in runtime
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const systemPrompt = `You are an elite Pub Quiz Master for "Don Fenticas". 
Your task is to generate a fun, challenging, and unique trivia quiz. 

CRITICAL CONSTRAINT: You MUST NOT generate any questions that are semantically identical or highly similar to the following list of previously used questions:
[${pastQuestionsList}]

Your output must be a valid JSON array of objects.`;

  const userQuery = `Generate ${numberOfQuestions} unique questions about the topic: "${topic || 'General Knowledge'}". 
Make sure the difficulty is balanced for a general pub audience.`;

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
      const err = await response.json();
      console.error("Gemini API Error:", err);
      throw new Error("Failed to consult the Quiz Master.");
    }

    const result = await response.json();
    const questionsJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!questionsJson) {
      throw new Error("The Quiz Master is currently silent. Try again.");
    }

    return JSON.parse(questionsJson);
    
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate quiz. Check API availability.");
  }
}
/**
 * Generates a quiz using Gemini 2.5 Flash.
 * Implements strict duplicate checking by passing historical questions to the model.
 */
export async function generateQuizAction(topic: string, numberOfQuestions: number = 10): Promise<QuizQuestion[]> {
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
 * Saves approved questions to history so they are ignored in future generations.
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
    console.error("Error saving quiz:", error);
    throw new Error("Failed to save quiz to history.");
  }

  revalidatePath('/quiz-generator');
  return { success: true };
}