'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'
import {
  getUserSpotifyToken,
  getCurrentUserId,
  createPublicPlaylist,
  replacePlaylistTracks,
  SpotifyScopeError,
  SpotifyNotConnectedError,
} from '@/lib/spotify'

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
  answer_text_ext?: string | null
  release_year: number | null
  spotify_track_id: string | null
  hint_year: number | null
}

export type PastQuestionCategoryJoin = {
  category_name: string;
  order_no?: number | null;
  is_picture?: boolean | null;
  include_spotify?: boolean | null;
  is_higher_lower?: boolean | null;
}

export type PastQuestionEventJoin = {
  id: number;
  title: string | null;
  date: string;
}

export type PastQuestionRecord = {
  id: string;
  question_text: string;
  answer_text: string;
  answer_text_ext?: string | null;
  category: string;
  asked_on: string;
  topic?: string | null;
  difficulty?: string | null;
  events_id: number | null;
  quiz_category_configs_id: number | null;
  question_no: number | null;
  quiz_category_configs?: PastQuestionCategoryJoin | null;
  events?: PastQuestionEventJoin | PastQuestionEventJoin[] | null;
  release_year?: number | null;
  hint_year?: number | null;
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
  is_higher_lower: boolean;
  order_no: number | null;
}

export type PictureRoundItem = {
  answer: string;
  imageUrl: string | null;
}

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

export async function generateQuizAction(
  topic: string,
  category: string,
  numberOfQuestions: number = 10,
  difficulty: string = 'Medium',
  eventId: number,
  categoryConfigId: number
): Promise<{ questions?: QuizQuestion[], error?: string }> {
  const supabase = await createClient()

  try {
  const [{ data: approved }, { data: generated }] = await Promise.all([
    supabase
      .from('past_quiz_questions')
      .select('question_text')
      .eq('quiz_category_configs_id', categoryConfigId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('generated_quiz_questions')
      .select('content_text')
      .eq('events_id', eventId)
      .eq('quiz_category_configs_id', categoryConfigId),
  ]);

  const combinedExclusions = [
    ...(approved?.map(q => q.question_text) ?? []),
    ...(generated?.map(g => g.content_text) ?? []),
  ];
  const pastQuestionsList = combinedExclusions.length
    ? combinedExclusions.join(' | ')
    : "None.";

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 
    if (!apiKey) {
      return { error: "API Key is missing. Please check your environment variables." };
    }
  const model = "gemini-2.5-flash";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;


 const prompt = `Act as the Pub Quiz Master for "Don Fenticas". 
  Generate a round for the category: "${category}".
  ${topic ? `Focus specifically on this theme within that category: "${topic}".` : `Provide a balanced variety of questions within the "${category}" genre.`}
  
  Requirements:
  - Exactly ${numberOfQuestions} unique questions.
  - Difficulty: ${difficulty === 'Easy' ? 'All questions should be easy - common knowledge that most people would know.' : difficulty === 'Hard' ? 'All questions should be challenging - obscure facts and "bar-room debate" level difficulty.' : 'Mixture of easy, medium, and "bar-room debate" hard.'}
  - Each question must be a direct, concise question only. No conversational filler, no preamble, no phrases like "Right then", "Here's one for you", "A proper head scratcher" etc. Just the question itself.
  - Answers must be short and factual - just the answer, nothing else.
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

    if (questions.length) {
      const { error: logError } = await supabase
        .from('generated_quiz_questions')
        .insert(questions.map(q => ({
          events_id: eventId,
          quiz_category_configs_id: categoryConfigId,
          content_text: q.question,
        })));
      if (logError) console.error("Failed to log generated questions:", logError);
    }

    return { questions };

  } catch (error: unknown) {
    console.error("AI Generation failed:", error);
    return { error: "Connection lost or request timed out. Please try again." };
  }
}

export async function cleanupGeneratedQuestionsForInactiveEventAction(eventId: number) {
  const supabase = await createClient()
  const { data: ev } = await supabase
    .from('events')
    .select('is_active')
    .eq('id', eventId)
    .single()
  if (ev && ev.is_active === false) {
    await supabase.from('generated_quiz_questions').delete().eq('events_id', eventId)
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getMaxQuestionNo(
  supabase: SupabaseClient,
  eventId: number,
  configId: number
): Promise<number> {
  const { data } = await supabase
    .from('past_quiz_questions')
    .select('question_no')
    .eq('events_id', eventId)
    .eq('quiz_category_configs_id', configId)
    .order('question_no', { ascending: false })
    .limit(1)
  return data?.[0]?.question_no ?? 0
}

export async function getFullQuestionHistoryAction(eventIdFilter?: string): Promise<PastQuestionRecord[]> {
  const supabase = await createClient()

  let query = supabase
    .from('past_quiz_questions')
    .select('*, quiz_category_configs(category_name, order_no, is_picture, include_spotify, is_higher_lower), events(id, title, date)')
    .order('asked_on', { ascending: false })
    .order('quiz_category_configs_id', { ascending: true })
    .order('question_no', { ascending: true, nullsFirst: false });

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

export async function updatePastQuestionAction(
  id: string,
  question: string | null,
  answer: string,
  imageData?: { base64: string; mimeType: string; oldImageUrl: string | null } | null,
  newQuestionNo?: number | null,
  eventId?: number | null
): Promise<{ success: true; image_url?: string | null }> {
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

  let newImageUrl: string | null | undefined = undefined;
  let swapBack: { id: string; questionNo: number } | null = null;

  if (imageData) {
    const adminClient = createAdminClient()
    if (imageData.oldImageUrl) {
      try {
        const url = new URL(imageData.oldImageUrl)
        const parts = url.pathname.split('/storage/v1/object/public/')
        if (parts[1]) {
          const [bucket, ...rest] = parts[1].split('/')
          await adminClient.storage.from(bucket).remove([rest.join('/')])
        }
      } catch (err) {
        console.error('Old image delete failed', err)
      }
    }
    try {
      const ext = imageData.mimeType === 'image/jpeg' ? 'jpg' : 'png'
      const folder = eventId ? `quiz-pictures/${eventId}` : 'quiz-pictures'
      const path = `${folder}/${crypto.randomUUID()}.${ext}`
      const buffer = Buffer.from(imageData.base64, 'base64')
      const { data: uploadData, error: uploadError } = await adminClient.storage
        .from('gallery')
        .upload(path, buffer, { contentType: imageData.mimeType })
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = adminClient.storage
          .from('gallery')
          .getPublicUrl(uploadData.path)
        newImageUrl = publicUrl
      }
    } catch (err) {
      console.error('New image upload failed', err)
    }
  }

  const updateFields: Record<string, unknown> = {
    answer_text: answer,
    updated_by: currentEmployeeId,
    updated_at: new Date().toISOString(),
  }
  if (question !== null) updateFields.question_text = question
  if (newImageUrl !== undefined) updateFields.image_url = newImageUrl

  if (newQuestionNo != null) {
    const { data: currentQ } = await supabase
      .from('past_quiz_questions')
      .select('events_id, quiz_category_configs_id, question_no')
      .eq('id', id)
      .single()

    const evId = currentQ?.events_id
    const cfgId = currentQ?.quiz_category_configs_id

    if (evId && cfgId && currentQ.question_no !== newQuestionNo) {
      const { data: allQs } = await supabase
        .from('past_quiz_questions')
        .select('id, question_no')
        .eq('events_id', evId)
        .eq('quiz_category_configs_id', cfgId)
        .order('question_no', { ascending: true, nullsFirst: false })

      if (allQs && allQs.length > 0) {
        const clamped = Math.max(1, Math.min(newQuestionNo, allQs.length))
        const occupant = allQs.find(q => q.id !== id && q.question_no === clamped)

        if (occupant) {
          /* Park the occupant, then hand it this question's old number - a swap,
             so the category keeps exactly one question per number. */
          await supabase.from('past_quiz_questions').update({ question_no: null }).eq('id', occupant.id)
          swapBack = { id: occupant.id, questionNo: currentQ.question_no ?? clamped }
        }
        updateFields.question_no = clamped
      }
    }
  }

  const { error } = await supabase
    .from('past_quiz_questions')
    .update(updateFields)
    .eq('id', id);

  if (error) {
    console.error("Update error:", error);
    throw new Error("Failed to update question.");
  }

  if (swapBack) {
    await supabase
      .from('past_quiz_questions')
      .update({ question_no: swapBack.questionNo })
      .eq('id', swapBack.id);
  }

  revalidatePath('/event-setups/events/[id]', 'page');
  return { success: true, image_url: newImageUrl };
}

export async function deletePastQuestionAction(id: string) {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('past_quiz_questions')
    .select('image_url, events_id, quiz_category_configs_id')
    .eq('id', id)
    .single()

  if (row?.image_url) {
    try {
      const adminClient = createAdminClient()
      const url = new URL(row.image_url)
      const parts = url.pathname.split('/storage/v1/object/public/')
      if (parts[1]) {
        const [bucket, ...rest] = parts[1].split('/')
        const storagePath = rest.join('/')
        await adminClient.storage.from(bucket).remove([storagePath])
      }
    } catch (err) {
      console.error('Storage delete failed for question', id, err)
    }
  }

  const { error } = await supabase
    .from('past_quiz_questions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Delete error:", error);
    throw new Error("Failed to delete question.");
  }

  await renumberCategoryQuestions(supabase, row?.events_id, row?.quiz_category_configs_id);

  revalidatePath('/event-setups/events/[id]', 'page');
  return { success: true };
}

/* Keeps a category's question numbers contiguous from 1 after a delete. */
async function renumberCategoryQuestions(
  supabase: SupabaseClient,
  eventsId: number | null | undefined,
  categoryConfigId: number | null | undefined
) {
  if (eventsId == null || categoryConfigId == null) return;

  const { data: remaining } = await supabase
    .from('past_quiz_questions')
    .select('id, question_no')
    .eq('events_id', eventsId)
    .eq('quiz_category_configs_id', categoryConfigId)
    .order('question_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (!remaining) return;

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].question_no !== i + 1) {
      await supabase
        .from('past_quiz_questions')
        .update({ question_no: i + 1 })
        .eq('id', remaining[i].id);
    }
  }
}

/* A music round is played oldest-first, so its question numbers follow release
   year rather than the order the batches happened to be added in. */
async function renumberSongsChronologically(
  supabase: SupabaseClient,
  eventsId: number,
  categoryConfigId: number
) {
  const { data: rows } = await supabase
    .from('past_quiz_questions')
    .select('id, question_no, release_year')
    .eq('events_id', eventsId)
    .eq('quiz_category_configs_id', categoryConfigId)
    .order('release_year', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (!rows?.length) return;

  const moving = rows
    .map((r, i) => ({ id: r.id, questionNo: i + 1, current: r.question_no }))
    .filter((r) => r.current !== r.questionNo);

  if (!moving.length) return;

  /* (events_id, quiz_category_configs_id, question_no) is unique, so park every
     mover on null before handing out the final numbers. */
  await Promise.all(moving.map((r) =>
    supabase.from('past_quiz_questions').update({ question_no: null }).eq('id', r.id)
  ));
  await Promise.all(moving.map((r) =>
    supabase.from('past_quiz_questions').update({ question_no: r.questionNo }).eq('id', r.id)
  ));
}

export async function getQuizEventsAction(): Promise<QuizEventSummary[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('events')
      .select('id, title, date, event_subtypes!inner(behavior)')
      .eq('event_subtypes.behavior', 'quiz')
      .order('date', { ascending: false });
  
    if (error) {
      console.error("Error fetching quiz events:", error);
      return [];
    }
    return (data as unknown as QuizEventSummary[]) || [];
}

export async function getUpcomingQuizzesAction(): Promise<QuizEventSummary[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('id, title, date, event_subtypes!inner(behavior)')
    .eq('event_subtypes.behavior', 'quiz')
    .gte('date', today)
    .order('date', { ascending: true });

  if (error) {
    console.error("Error fetching upcoming quizzes:", error);
    return [];
  }

  return (data as unknown as QuizEventSummary[]) || [];
}

export async function saveQuizToDatabase(
  questions: QuizQuestion[],
  eventId: number | null,
  topic: string,
  difficulty: string = ''
) {
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

  const configIds = [...new Set(
    questions.map(q => configMap.get(q.category.toLowerCase())).filter((id): id is number => !!id)
  )]
  const maxNos = new Map<number, number>()
  if (eventId) {
    await Promise.all(configIds.map(async (cid) => {
      maxNos.set(cid, await getMaxQuestionNo(supabase, eventId, cid))
    }))
  }
  const batchCounters = new Map<number, number>()

  const insertData = questions.map(q => {
    const cid = configMap.get(q.category.toLowerCase()) || null
    let question_no: number | undefined
    if (cid && eventId) {
      const count = batchCounters.get(cid) ?? 0
      batchCounters.set(cid, count + 1)
      question_no = (maxNos.get(cid) ?? 0) + count + 1
    }
    return {
      question_text: q.question,
      answer_text: q.answer,
      category: q.category,
      topic: topic.trim() || null,
      difficulty: difficulty.trim() || null,
      asked_on: askedOn,
      events_id: eventId,
      quiz_category_configs_id: cid,
      question_no: question_no ?? null,
      created_by: currentEmployeeId,
      created_at: new Date().toISOString(),
      updated_by: currentEmployeeId,
      updated_at: new Date().toISOString(),
    }
  });

  const { error } = await supabase
    .from('past_quiz_questions')
    .insert(insertData);

  if (error) {
    console.error("Database save error:", error);
    throw new Error("Failed to record questions in history.");
  }

  revalidatePath('/event-setups/quiz-generator');
  revalidatePath('/event-setups/quiz-history');
  revalidatePath('/event-setups/events/[id]', 'page');
  if (eventId) revalidatePath(`/event-setups/events/${eventId}`);
  return { success: true };
}


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

export async function generateMusicSnippetsAction(
  numberOfSongs: number = 10,
  topic: string = '',
  difficulty: string = 'Medium',
  eventId: number,
  categoryConfigId: number
): Promise<{ songs?: MusicSnippetCandidate[]; error?: string }> {
  const supabase = await createClient()

  try {
    const [{ data: approved }, { data: generated }, { data: config }] = await Promise.all([
      supabase
        .from('past_quiz_questions')
        .select('answer_text, answer_text_ext')
        .eq('quiz_category_configs_id', categoryConfigId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('generated_quiz_questions')
        .select('content_text')
        .eq('events_id', eventId)
        .eq('quiz_category_configs_id', categoryConfigId),
      supabase
        .from('quiz_category_configs')
        .select('is_higher_lower')
        .eq('id', categoryConfigId)
        .maybeSingle(),
    ])

    const isHigherOrLower = config?.is_higher_lower ?? false

    const combinedExclusions = [
      ...(approved?.map((q) => (isHigherOrLower ? q.answer_text_ext : q.answer_text)) ?? []),
      ...(generated?.map((g) => g.content_text) ?? []),
    ].filter((v): v is string => !!v)
    const existingList = combinedExclusions.length
      ? combinedExclusions.join(' | ')
      : 'None.'

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
    if (!apiKey) {
      return { error: 'API Key is missing. Please check your environment variables.' }
    }

    const model = 'gemini-2.5-flash'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const topicLine = topic.trim()
      ? `- Focus on this theme/genre: "${topic.trim()}".`
      : '- Provide a balanced variety across genres.'

    const difficultyLine = difficulty === 'Easy'
      ? '- Song difficulty: All songs should be very well-known hits that almost everyone would recognise.'
      : difficulty === 'Hard'
        ? '- Song difficulty: Include obscure or lesser-known tracks that only music enthusiasts would recognise.'
        : '- Song difficulty: Mix of well-known hits and some lesser-known tracks.'

    const prompt = isHigherOrLower
      ? `You are a music expert for a pub quiz "Higher or Lower" round at "Don Fenticas".
Generate exactly ${numberOfSongs} songs for an alternating "Higher or Lower" round. Each question states ONE true direction in the form "{artist} - {title} is higher than {hint_year}?" or "{artist} - {title} is lower than {hint_year}?", and the correct answers alternate Higher, Lower, Higher, Lower across the round.

Requirements:
- Songs from 1970 to present day.
- Well-known, recognizable songs that a British pub audience would know.
- For each song, provide a hint_year that is within 3 to 5 years of the actual release year. It must NEVER equal the release year.
- Pick songs that work well as an alternating round (a good mix of decades).
${topicLine}
${difficultyLine}
- Avoid these previously used songs: [${existingList}]
- Return a JSON array sorted by year ascending.`
      : `You are a music expert for a pub quiz at "Don Fenticas".
Generate exactly ${numberOfSongs} songs that are famous for having distinctive instrumental intros where NO singing or vocals appear in at least the first 15 seconds.

Requirements:
- Songs from 1960 to present day, sorted chronologically by release year (ascending).
- Spread across decades - include songs from the 60s, 70s, 80s, 90s, 2000s, 2010s, and 2020s where possible.
- Well-known, recognizable songs that a British pub audience would know.
- The instrumental intro must be iconic and identifiable - think guitar riffs, piano intros, synth openings, drum patterns.
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

    if (isHigherOrLower) {
      rawSongs.forEach((s, i) => {
        const wantHigher = i % 2 === 0 // even → answer "Higher" (release > hint)
        const aiGap = s.hint_year != null ? Math.abs(s.year - s.hint_year) : 0
        const offset = Math.min(Math.max(aiGap || (3 + Math.floor(Math.random() * 3)), 3), 5)
        s.hint_year = wantHigher ? s.year - offset : s.year + offset
      })
    }

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

    if (songs.length) {
      const { error: logError } = await supabase
        .from('generated_quiz_questions')
        .insert(songs.map((s) => ({
          events_id: eventId,
          quiz_category_configs_id: categoryConfigId,
          content_text: `${s.artist} - ${s.title}`,
        })))
      if (logError) console.error('Failed to log generated songs:', logError)
    }

    return { songs }
  } catch (error: unknown) {
    console.error('Music snippet generation failed:', error)
    return { error: 'Connection lost or request timed out. Please try again.' }
  }
}

export async function saveMusicSnippetsAction(
  songs: { artist: string; title: string; year: number; spotify_track_id: string | null; hint_year?: number }[],
  eventId: number,
  categoryName: string,
  categoryConfigId: number,
  topic: string = '',
  difficulty: string = ''
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
  const { data: config } = await supabase
    .from('quiz_category_configs')
    .select('is_higher_lower')
    .eq('id', categoryConfigId)
    .maybeSingle()
  const isHigherOrLower = config?.is_higher_lower ?? false
  const baseNo = await getMaxQuestionNo(supabase, eventId, categoryConfigId)
  const orderedSongs = [...songs].sort((a, b) => a.year - b.year)
  const insertData = orderedSongs.map((s, i) => {
    const songIdentity = `${s.artist} - ${s.title}`
    if (isHigherOrLower && s.hint_year) {
      const dir = s.year > s.hint_year ? 'higher' : 'lower'
      return {
        question_text: `${songIdentity} is higher or lower than ${s.hint_year}?`,
        answer_text: dir === 'higher' ? 'Higher' : 'Lower',
        answer_text_ext: songIdentity,
        category: categoryName,
        topic: topic.trim() || null,
        difficulty: difficulty.trim() || null,
        release_year: s.year,
        spotify_track_id: s.spotify_track_id,
        hint_year: s.hint_year,
        asked_on: askedOn,
        events_id: eventId,
        quiz_category_configs_id: categoryConfigId,
        question_no: baseNo + i + 1,
        created_by: currentEmployeeId,
        created_at: now,
        updated_by: currentEmployeeId,
        updated_at: now,
      }
    }
    return {
      question_text: `[${s.year}] Name the artist and song`,
      answer_text: songIdentity,
      answer_text_ext: null,
      category: categoryName,
      topic: topic.trim() || null,
      difficulty: difficulty.trim() || null,
      release_year: s.year,
      spotify_track_id: s.spotify_track_id,
      hint_year: s.hint_year || null,
      asked_on: askedOn,
      events_id: eventId,
      quiz_category_configs_id: categoryConfigId,
      question_no: baseNo + i + 1,
      created_by: currentEmployeeId,
      created_at: now,
      updated_by: currentEmployeeId,
      updated_at: now,
    }
  })

  const { error } = await supabase
    .from('past_quiz_questions')
    .insert(insertData)

  if (error) {
    console.error('Database save error:', error)
    throw new Error('Failed to save music snippets.')
  }

  await renumberSongsChronologically(supabase, eventId, categoryConfigId)

  revalidatePath('/event-setups/quiz-generator')
  revalidatePath('/event-setups/quiz-history')
  revalidatePath(`/event-setups/events/${eventId}`)

  const playlist = await syncCategoryPlaylistAction(eventId, categoryConfigId)
  return { success: true, ...playlist }
}

export type PlaylistSyncResult = {
  ok: boolean
  playlistUrl?: string
  needsConnect?: boolean
  error?: string
}

export async function syncCategoryPlaylistAction(
  eventId: number,
  categoryConfigId: number
): Promise<PlaylistSyncResult> {
  try {
    const token = await getUserSpotifyToken()
    if (!token) return { ok: false, needsConnect: true }

    const supabase = await createClient()

    const [{ data: event }, { data: config }, { data: snippets }] = await Promise.all([
      supabase.from('events').select('date').eq('id', eventId).single(),
      supabase.from('quiz_category_configs').select('order_no, category_name').eq('id', categoryConfigId).single(),
      supabase
        .from('past_quiz_questions')
        .select('spotify_track_id, question_no')
        .eq('events_id', eventId)
        .eq('quiz_category_configs_id', categoryConfigId)
        .order('question_no', { ascending: true, nullsFirst: false }),
    ])

    if (!config) return { ok: false, error: 'category_not_found' }

    const { data: existing } = await supabase
      .from('event_category_playlists')
      .select('playlist_id, playlist_url')
      .eq('events_id', eventId)
      .eq('quiz_category_configs_id', categoryConfigId)
      .maybeSingle()

    let playlistId = existing?.playlist_id ?? null
    let playlistUrl = existing?.playlist_url ?? null

    if (!playlistId) {
      const datePart = event?.date ? format(new Date(event.date + 'T00:00:00'), 'd MMMM') : ''
      const orderPart = config.order_no != null ? `${config.order_no}. ` : ''
      const title = `${datePart} / ${orderPart}${(config.category_name ?? '').toUpperCase()}`.trim()

      const userId = await getCurrentUserId()
      const created = await createPublicPlaylist(userId, title)
      playlistId = created.id
      playlistUrl = created.url

      await supabase.from('event_category_playlists').upsert(
        {
          events_id: eventId,
          quiz_category_configs_id: categoryConfigId,
          playlist_id: playlistId,
          playlist_url: playlistUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'events_id,quiz_category_configs_id' }
      )
    }

    const uris = (snippets ?? [])
      .map((s) => s.spotify_track_id)
      .filter((id): id is string => !!id)
      .map((id) => `spotify:track:${id}`)

    await replacePlaylistTracks(playlistId, uris)

    revalidatePath('/event-setups/events/[id]', 'page')
    return { ok: true, playlistUrl: playlistUrl ?? undefined }
  } catch (err) {
    if (err instanceof SpotifyScopeError) return { ok: false, needsConnect: true, error: 'reconnect' }
    if (err instanceof SpotifyNotConnectedError) return { ok: false, needsConnect: true }
    console.error('Playlist sync failed:', err)
    return { ok: false, error: 'sync_failed' }
  }
}


async function generateImageForAnswer(answer: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) return null
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`
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

export async function generatePictureRoundAction(
  numberOfItems: number = 10,
  topic: string,
  difficulty: string = 'Medium',
  eventId?: number,
  categoryConfigId?: number,
  excludeAnswers?: string[]
): Promise<{ items?: PictureRoundItem[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) return { error: 'API Key is missing.' }

  try {
    const supabase = await createClient()
    let existingAnswers: string[] = []
    if (eventId && categoryConfigId) {
      const [{ data: approved }, { data: generated }] = await Promise.all([
        supabase
          .from('past_quiz_questions')
          .select('answer_text')
          .eq('events_id', eventId)
          .eq('quiz_category_configs_id', categoryConfigId),
        supabase
          .from('generated_quiz_questions')
          .select('content_text')
          .eq('events_id', eventId)
          .eq('quiz_category_configs_id', categoryConfigId),
      ])
      existingAnswers = [
        ...(approved?.map(q => q.answer_text) ?? []),
        ...(generated?.map(g => g.content_text) ?? []),
      ]
    }
    if (excludeAnswers?.length) {
      existingAnswers = [...existingAnswers, ...excludeAnswers]
    }
    const model = 'gemini-2.5-flash'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const difficultyGuide = difficulty === 'Easy'
      ? 'very well-known, instantly recognisable by almost everyone'
      : difficulty === 'Hard'
        ? 'less common or niche - a challenge for enthusiasts'
        : 'a mix of well-known and moderately challenging'

    const excludeRule = existingAnswers.length > 0
      ? `\n- Do NOT include any of these already-used answers: ${JSON.stringify(existingAnswers)}`
      : ''

    const prompt = `Generate exactly ${numberOfItems} specific, identifiable items for a pub quiz picture round on the topic "${topic}".

Rules:
- Each item must be a specific named thing with a visually distinctive appearance (suitable for a single photograph)
- Vary across the topic - avoid repetition within subtypes (e.g. for "dog breeds" don't list 5 retrievers)
- Difficulty: ${difficultyGuide}${excludeRule}
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

    const items: PictureRoundItem[] = []
    for (let i = 0; i < answers.length; i += 3) {
      const batch = answers.slice(i, i + 3)
      const images = await Promise.all(batch.map((a) => generateImageForAnswer(a)))
      batch.forEach((answer, j) => items.push({ answer, imageUrl: images[j] }))
    }

    if (eventId && categoryConfigId && items.length) {
      const { error: logError } = await supabase
        .from('generated_quiz_questions')
        .insert(items.map(it => ({
          events_id: eventId,
          quiz_category_configs_id: categoryConfigId,
          content_text: it.answer,
        })))
      if (logError) console.error('Failed to log generated picture answers:', logError)
    }

    return { items }
  } catch (err: unknown) {
    console.error('Picture round generation failed:', err)
    return { error: 'Generation failed. Please try again.' }
  }
}

export async function savePictureRoundAction(
  items: PictureRoundItem[],
  eventId: number,
  categoryName: string,
  categoryConfigId: number,
  questionText: string,
  difficulty: string = ''
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
  const baseNo = await getMaxQuestionNo(supabase, eventId, categoryConfigId)

  const insertData = await Promise.all(items.map(async (item, i) => {
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
      question_text: questionText,
      answer_text: item.answer,
      category: categoryName,
      topic: questionText,
      difficulty: difficulty.trim() || null,
      image_url: storedImageUrl,
      asked_on: askedOn,
      events_id: eventId,
      quiz_category_configs_id: categoryConfigId,
      question_no: baseNo + i + 1,
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
  revalidatePath(`/event-setups/events/${eventId}`)
}

export async function getMusicSnippetsForEventAction(
  eventId: string,
  categoryConfigId: number
): Promise<SavedMusicSnippet[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('past_quiz_questions')
    .select('id, answer_text, answer_text_ext, release_year, spotify_track_id, hint_year')
    .eq('events_id', eventId)
    .eq('quiz_category_configs_id', categoryConfigId)
    .order('release_year', { ascending: true })

  if (error) {
    console.error('Error fetching music snippets:', error)
    return []
  }

  return (data as SavedMusicSnippet[]) || []
}