'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

export type MusicSnippetCandidate = {
  artist: string
  title: string
  year: number
  intro_description: string
  spotify_track_id: string | null
  hint_year?: number
}

export type SavedMusicSnippet = {
  id: string
  answer_text: string
  release_year: number | null
  spotify_track_id: string | null
  hint_year: number | null
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
  release_year?: number | null;
  spotify_track_id?: string | null;
  image_url?: string | null;
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
  include_spotify: boolean;
  short_name: string;
  is_picture: boolean;
}

export type PictureRoundItem = {
  answer: string;
  imageUrl: string | null;
}

/**
 * Retrieves all configured quiz categories.
 */
export async function getQuizCategoryConfigsAction(): Promise<QuizCategoryConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_category_configs")
    .select("*")
    .eq("is_active", true)
    .order("order_no", { ascending: true });

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
  numberOfQuestions: number = 10,
  difficulty: string = 'Medium'
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
  - Difficulty: ${difficulty === 'Easy' ? 'All questions should be easy — common knowledge that most people would know.' : difficulty === 'Difficult' ? 'All questions should be challenging — obscure facts and "bar-room debate" level difficulty.' : 'Mixture of easy, medium, and "bar-room debate" hard.'}
  - Each question must be a direct, concise question only. No conversational filler, no preamble, no phrases like "Right then", "Here's one for you", "A proper head scratcher" etc. Just the question itself.
  - Answers must be short and factual — just the answer, nothing else.
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

// ─── Music Snippets ─────────────────────────────────────────────────────────

async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID || ''
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

async function searchSpotifyTrack(
  artist: string,
  title: string,
  accessToken: string
): Promise<string | null> {
  try {
    const query = encodeURIComponent(`track:${title} artist:${artist}`)
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.tracks?.items?.[0]?.id || null
  } catch {
    return null
  }
}

/**
 * Generates music snippet suggestions via Gemini, then auto-searches Spotify for each.
 */
export async function generateMusicSnippetsAction(
  numberOfSongs: number = 15,
  categoryName: string = 'Music Snippets',
  topic: string = '',
  difficulty: string = 'Medium'
): Promise<{ songs?: MusicSnippetCandidate[]; error?: string }> {
  const supabase = await createClient()

  try {
    // Fetch existing songs for this category to avoid duplicates
    const { data: pastSnippets } = await supabase
      .from('past_quiz_questions')
      .select('answer_text')
      .eq('category', categoryName)

    const existingList = pastSnippets?.length
      ? pastSnippets.map((q) => q.answer_text).join(' | ')
      : 'None.'

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
    if (!apiKey) {
      return { error: 'API Key is missing. Please check your environment variables.' }
    }

    const model = 'gemini-2.5-flash'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const isHigherOrLower = categoryName.toLowerCase().includes('higher')

    const topicLine = topic.trim()
      ? `- Focus on this theme/genre: "${topic.trim()}".`
      : '- Provide a balanced variety across genres.'

    const difficultyLine = difficulty === 'Easy'
      ? '- Song difficulty: All songs should be very well-known hits that almost everyone would recognise.'
      : difficulty === 'Difficult'
        ? '- Song difficulty: Include obscure or lesser-known tracks that only music enthusiasts would recognise.'
        : '- Song difficulty: Mix of well-known hits and some lesser-known tracks.'

    const prompt = isHigherOrLower
      ? `You are a music expert for a pub quiz "Higher or Lower" round at "Don Fenticas".
Generate exactly ${numberOfSongs} songs for a "Higher or Lower" game where teams guess if the song's release year is higher or lower than a given hint year.

Requirements:
- Songs from 1970 to present day.
- Well-known, recognizable songs that a British pub audience would know.
- For each song, provide a hint_year that is within 3 to 5 years of the actual release year. The hint_year should be randomly higher or lower than the actual year to create variety.
- The songs should have a good mix of decades.
${topicLine}
${difficultyLine}
- Avoid these previously used songs: [${existingList}]
- Return a JSON array sorted by year ascending.`
      : `You are a music expert for a pub quiz at "Don Fenticas".
Generate exactly ${numberOfSongs} songs that are famous for having distinctive instrumental intros where NO singing or vocals appear in at least the first 15 seconds.

Requirements:
- Songs from 1960 to present day, sorted chronologically by release year (ascending).
- Spread across decades — include songs from the 60s, 70s, 80s, 90s, 2000s, 2010s, and 2020s where possible.
- Well-known, recognizable songs that a British pub audience would know.
- The instrumental intro must be iconic and identifiable — think guitar riffs, piano intros, synth openings, drum patterns.
${topicLine}
${difficultyLine}
- Avoid these previously used songs: [${existingList}]
- Return a JSON array sorted by year ascending.`

    const schemaProperties: Record<string, { type: string }> = {
      artist: { type: 'STRING' },
      title: { type: 'STRING' },
      year: { type: 'INTEGER' },
      intro_description: { type: 'STRING' },
    }
    const requiredFields = ['artist', 'title', 'year', 'intro_description']

    if (isHigherOrLower) {
      schemaProperties.hint_year = { type: 'INTEGER' }
      requiredFields.push('hint_year')
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: schemaProperties,
            required: requiredFields,
          },
        },
      },
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        error: `AI Error (${response.status}): ${errorData.error?.message || 'The Music Expert is currently unavailable.'}`,
      }
    }

    const result = await response.json()
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      return { error: 'The Music Expert returned an empty response.' }
    }

    const rawSongs = JSON.parse(content) as { artist: string; title: string; year: number; intro_description: string; hint_year?: number }[]
    rawSongs.sort((a, b) => a.year - b.year)

    // Auto-search Spotify for each song
    const spotifyToken = await getSpotifyAccessToken()
    const songs: MusicSnippetCandidate[] = await Promise.all(
      rawSongs.map(async (s) => {
        let spotifyId: string | null = null
        if (spotifyToken) {
          spotifyId = await searchSpotifyTrack(s.artist, s.title, spotifyToken)
        }
        return { ...s, spotify_track_id: spotifyId, hint_year: s.hint_year }
      })
    )

    return { songs }
  } catch (error: unknown) {
    console.error('Music snippet generation failed:', error)
    return { error: 'Connection lost or request timed out. Please try again.' }
  }
}

/**
 * Saves selected music snippets to the database.
 */
export async function saveMusicSnippetsAction(
  songs: { artist: string; title: string; year: number; spotify_track_id: string | null; hint_year?: number }[],
  eventId: number,
  categoryName: string,
  categoryConfigId: number
) {
  const supabase = await createClient()

  let currentEmployeeId: number | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email) {
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()
    if (emp) currentEmployeeId = emp.id
  }

  let askedOn = new Date().toISOString().split('T')[0]
  if (eventId) {
    const { data: event } = await supabase.from('events').select('date').eq('id', eventId).single()
    if (event?.date) askedOn = event.date
  }

  const now = new Date().toISOString()
  const isHigherOrLower = categoryName.toLowerCase().includes('higher')
  const insertData = songs.map((s) => ({
    question_text: isHigherOrLower && s.hint_year
      ? `Higher or Lower than ${s.hint_year}?`
      : `[${s.year}] Name the artist and song`,
    answer_text: `${s.artist} - ${s.title}`,
    category: categoryName,
    topic: categoryName,
    release_year: s.year,
    spotify_track_id: s.spotify_track_id,
    hint_year: s.hint_year || null,
    asked_on: askedOn,
    events_id: eventId,
    quiz_category_configs_id: categoryConfigId,
    created_by: currentEmployeeId,
    created_at: now,
    updated_by: currentEmployeeId,
    updated_at: now,
  }))

  const { error } = await supabase
    .from('past_quiz_questions')
    .insert(insertData)

  if (error) {
    console.error('Database save error:', error)
    throw new Error('Failed to save music snippets.')
  }

  revalidatePath('/event-setups/quiz-generator')
  revalidatePath('/event-setups/quiz-history')
  return { success: true }
}

// ─── Picture Round ──────────────────────────────────────────────────────────

async function generateImageForAnswer(answer: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) return null
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text:
          `A clear, high-quality photograph of ${answer} for a pub quiz picture round. ` +
          `Clean background. Subject clearly visible and fills the frame. No text overlays. No watermarks.`
        }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.error(`[img-gen] ${answer}: HTTP ${res.status}`, errBody)
      return null
    }
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p.inlineData?.data)
    if (!imagePart) {
      console.error(`[img-gen] ${answer}: no inlineData in response`, JSON.stringify(data).slice(0, 300))
      return null
    }
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
  } catch (err) {
    console.error(`[img-gen] ${answer}:`, err)
    return null
  }
}

/**
 * Generates a picture round: Gemini text produces answer list,
 * then Gemini image produces a photo for each (batched 3 at a time).
 * Returns base64 data URLs for the draft stage; images are uploaded on save.
 */
export async function generatePictureRoundAction(
  numberOfItems: number = 10,
  categoryName: string = 'Pictures',
  topic: string,
  difficulty: string = 'Medium'
): Promise<{ items?: PictureRoundItem[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) return { error: 'API Key is missing.' }

  try {
    // Step 1: Gemini text → list of answers
    const model = 'gemini-2.5-flash'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const difficultyGuide = difficulty === 'Easy'
      ? 'very well-known, instantly recognisable by almost everyone'
      : difficulty === 'Difficult'
        ? 'less common or niche — a challenge for enthusiasts'
        : 'a mix of well-known and moderately challenging'

    const prompt = `Generate exactly ${numberOfItems} specific, identifiable items for a pub quiz picture round on the topic "${topic}".

Rules:
- Each item must be a specific named thing with a visually distinctive appearance (suitable for a single photograph)
- Vary across the topic — avoid repetition within subtypes (e.g. for "dog breeds" don't list 5 retrievers)
- Difficulty: ${difficultyGuide}
- Return ONLY a valid JSON array of strings. No markdown, no explanation.
Example for topic "dog breeds": ["Labrador Retriever","French Bulldog","Border Collie","Dalmatian","Dachshund"]`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: 'application/json',
          responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return { error: `AI Error (${response.status}): ${err.error?.message || 'Generation failed.'}` }
    }

    const result = await response.json()
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) return { error: 'AI returned an empty response.' }
    const answers = JSON.parse(content) as string[]

    // Step 2: Generate one image per answer, 3 at a time
    const items: PictureRoundItem[] = []
    for (let i = 0; i < answers.length; i += 3) {
      const batch = answers.slice(i, i + 3)
      const images = await Promise.all(batch.map((a) => generateImageForAnswer(a)))
      batch.forEach((answer, j) => items.push({ answer, imageUrl: images[j] }))
    }

    return { items }
  } catch (err: unknown) {
    console.error('Picture round generation failed:', err)
    return { error: 'Generation failed. Please try again.' }
  }
}

/**
 * Saves approved picture round items: uploads base64 images to Supabase Storage,
 * then inserts rows to past_quiz_questions with the public image URL.
 */
export async function savePictureRoundAction(
  items: PictureRoundItem[],
  eventId: number,
  categoryName: string,
  categoryConfigId: number
): Promise<void> {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let currentEmployeeId: number | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email) {
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()
    if (emp) currentEmployeeId = emp.id
  }

  let askedOn = new Date().toISOString().split('T')[0]
  const { data: event } = await supabase.from('events').select('date').eq('id', eventId).single()
  if (event?.date) askedOn = event.date

  const now = new Date().toISOString()

  const insertData = await Promise.all(items.map(async (item) => {
    let storedImageUrl: string | null = null

    if (item.imageUrl?.startsWith('data:')) {
      try {
        const [header, base64] = item.imageUrl.split(',')
        const mimeMatch = header.match(/data:([^;]+);/)
        const mimeType = mimeMatch?.[1] ?? 'image/png'
        const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png'
        const buffer = Buffer.from(base64, 'base64')
        const path = `quiz-pictures/${eventId}/${crypto.randomUUID()}.${ext}`

        const { data: uploadData, error: uploadError } = await adminClient.storage
          .from('gallery')
          .upload(path, buffer, { contentType: mimeType })

        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = adminClient.storage
            .from('gallery')
            .getPublicUrl(uploadData.path)
          storedImageUrl = publicUrl
        }
      } catch (err) {
        console.error('Image upload failed for', item.answer, err)
      }
    }

    return {
      question_text: '',
      answer_text: item.answer,
      category: categoryName,
      topic: categoryName,
      image_url: storedImageUrl,
      asked_on: askedOn,
      events_id: eventId,
      quiz_category_configs_id: categoryConfigId,
      created_by: currentEmployeeId,
      created_at: now,
      updated_by: currentEmployeeId,
      updated_at: now,
    }
  }))

  const { error } = await supabase.from('past_quiz_questions').insert(insertData)
  if (error) {
    console.error('Database save error:', error)
    throw new Error('Failed to save picture round.')
  }

  revalidatePath('/event-setups/quiz-generator')
  revalidatePath('/event-setups/quiz-history')
}

/**
 * Fetches existing music snippets for an event.
 */
export async function getMusicSnippetsForEventAction(
  eventId: string,
  categoryConfigId: number
): Promise<SavedMusicSnippet[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('past_quiz_questions')
    .select('id, answer_text, release_year, spotify_track_id, hint_year')
    .eq('events_id', eventId)
    .eq('quiz_category_configs_id', categoryConfigId)
    .order('release_year', { ascending: true })

  if (error) {
    console.error('Error fetching music snippets:', error)
    return []
  }

  return (data as SavedMusicSnippet[]) || []
}