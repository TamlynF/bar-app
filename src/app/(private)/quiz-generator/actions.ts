'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

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

export async function saveQuizToDatabase(questions: QuizQuestion[]) {
  const supabase = await createClient()

  // Format data for Supabase
  const insertData = questions.map(q => ({
    question_text: q.question,
    answer_text: q.answer,
    category: q.category,
    asked_on: new Date().toISOString(), // Setting it to today
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