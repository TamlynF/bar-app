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
  getPlaylistOwner,
  clearSpotifyTokens,
  SpotifyScopeError,
  SpotifyNotConnectedError,
} from '@/lib/spotify'
import {
  isValidStep,
  DEFAULT_START_YEAR,
  DEFAULT_YEAR_RANGE,
  type YearRange,
} from '@/lib/quiz/higher-lower'
import { parseTopicYearWindow, withinTopicYears } from '@/lib/quiz/topic-years'
import { getCurrentEmployeeId } from '@/lib/current-employee'
import { playlistOwnerName, type CategoryPlaylistRow } from '@/lib/quiz/category-playlist'

export type QuizQuestion = {
  question: string;
  answer: string;
  category: string;
}

/* A draft carries no comparison year. In a Higher-or-Lower round the year a song
   is measured against comes from the song picked before it, so it only exists
   once the round has an order - see @/lib/quiz/higher-lower. */
export type MusicSnippetCandidate = {
  artist: string
  title: string
  year: number
  intro_description: string
  spotify_track_id: string | null
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
  number_by_release_year: boolean;
  min_years: number;
  max_years: number;
  order_no: number | null;
}

export type PictureRoundItem = {
  answer: string;
  imageUrl: string | null;
}

/* Without a deadline a stalled Gemini call hangs until the platform kills the
   whole request, which reaches the sheet as a rejected action rather than a
   message it can show. */
const AI_TIMEOUT_MS = 45_000

const isTimeout = (error: unknown) =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')

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
  try {
  const supabase = await createClient()
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
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS)
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
    return {
      error: isTimeout(error)
        ? "The Quiz Master took too long. Try a smaller batch."
        : "Connection lost or request timed out. Please try again.",
    };
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
  eventId?: number | null,
  spotifyTrackId?: string | null,
  /* undefined leaves the year alone; null clears it. On a Higher-or-Lower round
     the year is what the whole chain is measured against, so changing one here
     re-chains everything after it. */
  releaseYear?: number | null
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
  /* undefined leaves the track alone; null clears it. */
  if (spotifyTrackId !== undefined) updateFields.spotify_track_id = spotifyTrackId
  if (releaseYear !== undefined) updateFields.release_year = releaseYear

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

  if (newQuestionNo != null || releaseYear !== undefined) {
    const { data: moved } = await supabase
      .from('past_quiz_questions')
      .select('events_id, quiz_category_configs_id')
      .eq('id', id)
      .maybeSingle();
    await rechainHigherLowerQuestions(supabase, moved?.events_id, moved?.quiz_category_configs_id);
  }

  revalidatePath('/event-setups/events/[id]', 'page');
  return { success: true, image_url: newImageUrl };
}

/* Drag-and-drop hands back the whole round in its new order. Anything the client
   doesn't name keeps its place at the end, so a stale list can shuffle a round but
   never drop a question out of it. */
export async function reorderCategoryQuestionsAction(
  eventId: number,
  categoryConfigId: number,
  orderedIds: string[]
): Promise<{
  success: boolean
  order: { id: string; questionNo: number }[]
  playlist?: PlaylistReorderResult
}> {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('past_quiz_questions')
    .select('id, question_no')
    .eq('events_id', eventId)
    .eq('quiz_category_configs_id', categoryConfigId)
    .order('question_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (!rows?.length) return { success: true, order: [] }

  const known = new Set(rows.map((r) => r.id))
  const requested = orderedIds.filter((id) => known.has(id))
  const untouched = rows.map((r) => r.id).filter((id) => !requested.includes(id))
  const finalOrder = [...requested, ...untouched]

  const currentNo = new Map(rows.map((r) => [r.id, r.question_no]))
  const order = finalOrder.map((id, i) => ({ id, questionNo: i + 1 }))
  const moving = order.filter((r) => currentNo.get(r.id) !== r.questionNo)

  if (moving.length) {
    /* (events_id, quiz_category_configs_id, question_no) is unique, so park every
       mover on null before handing out the final numbers. */
    await Promise.all(moving.map((r) =>
      supabase.from('past_quiz_questions').update({ question_no: null }).eq('id', r.id)
    ))
    const results = await Promise.all(moving.map((r) =>
      supabase.from('past_quiz_questions').update({ question_no: r.questionNo }).eq('id', r.id)
    ))
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      console.error('Reorder error:', failed.error)
      throw new Error('Failed to reorder the questions.')
    }
  }

  await rechainHigherLowerQuestions(supabase, eventId, categoryConfigId)

  const playlist = await resyncPlaylistOrder(supabase, eventId, categoryConfigId, moving.length > 0)

  revalidatePath('/event-setups/events/[id]', 'page')
  return { success: true, order, playlist }
}

export type PlaylistReorderResult =
  | { status: 'not_a_music_round' | 'no_playlist' | 'unchanged' | 'synced' | 'needs_connect' | 'failed' }
  | { status: 'not_owner'; ownerName?: string }

/* The playlist is what gets played on the night, so its track order has to follow
   the question numbers rather than the order the songs were added in. The sync
   already reads the round in question_no order, so replaying it is enough.

   Only an existing playlist is touched - reordering a round is no reason to
   conjure one up, and it must never create one for a round with no songs. */
async function resyncPlaylistOrder(
  supabase: SupabaseClient,
  eventId: number,
  categoryConfigId: number,
  anythingMoved: boolean
): Promise<PlaylistReorderResult> {
  const { data: config } = await supabase
    .from('quiz_category_configs')
    .select('include_spotify')
    .eq('id', categoryConfigId)
    .maybeSingle()

  if (!config?.include_spotify) return { status: 'not_a_music_round' }
  if (!anythingMoved) return { status: 'unchanged' }

  const { count } = await supabase
    .from('event_category_playlists')
    .select('playlist_id', { count: 'exact', head: true })
    .eq('events_id', eventId)
    .eq('quiz_category_configs_id', categoryConfigId)

  if (!count) return { status: 'no_playlist' }

  const result = await syncCategoryPlaylistAction(eventId, categoryConfigId)
  if (result.ok) return { status: 'synced' }
  if (result.error === 'not_owner') return { status: 'not_owner', ownerName: result.ownerName }
  return { status: result.needsConnect ? 'needs_connect' : 'failed' }
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
  await rechainHigherLowerQuestions(supabase, row?.events_id, row?.quiz_category_configs_id);

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

/* A music round set to number by release year is played oldest-first, so its
   question numbers follow that year rather than the order the batches happened
   to be added in. */
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

/* The year the next song in a Higher-or-Lower round gets measured against. */
async function lastChainYear(
  supabase: SupabaseClient,
  eventsId: number,
  categoryConfigId: number
): Promise<number | null> {
  const { data } = await supabase
    .from('past_quiz_questions')
    .select('release_year')
    .eq('events_id', eventsId)
    .eq('quiz_category_configs_id', categoryConfigId)
    .order('question_no', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return data?.release_year ?? null;
}

/* Deleting or reordering a question mid-round leaves everything after it
   comparing against a year that is no longer its predecessor. Question 1 keeps
   its hint year - that is the year the host set - and the rest follow on again.

   This cannot conjure up a replacement song, so a repaired chain may now fall
   outside the round's min/max range. The event page flags those rather than
   quietly bending the numbers to fit. */
async function rechainHigherLowerQuestions(
  supabase: SupabaseClient,
  eventsId: number | null | undefined,
  categoryConfigId: number | null | undefined
) {
  if (eventsId == null || categoryConfigId == null) return;

  const { data: config } = await supabase
    .from('quiz_category_configs')
    .select('include_spotify, is_higher_lower')
    .eq('id', categoryConfigId)
    .maybeSingle();

  if (!config?.include_spotify || !config?.is_higher_lower) return;

  const { data: rows } = await supabase
    .from('past_quiz_questions')
    .select('id, question_no, release_year, hint_year, answer_text, answer_text_ext')
    .eq('events_id', eventsId)
    .eq('quiz_category_configs_id', categoryConfigId)
    .order('question_no', { ascending: true, nullsFirst: false });

  if (!rows?.length) return;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const hintYear = rows[i - 1].release_year;
    const answerText = row.release_year == null ? row.answer_text : String(row.release_year);

    if (row.hint_year === hintYear && row.answer_text === answerText) continue;

    const updates: Record<string, unknown> = { hint_year: hintYear, answer_text: answerText };
    if (row.answer_text_ext) {
      updates.question_text = `${row.answer_text_ext} is higher or lower than ${hintYear}?`;
    }

    await supabase
      .from('past_quiz_questions')
      .update(updates)
      .eq('id', row.id);
  }
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

export type SpotifyTrackLookup = {
  trackId: string
  artist: string
  title: string
  year: number | null
}

type SpotifyTrackResponse = {
  id?: string
  name?: string
  artists?: { name: string }[]
  album?: { release_date?: string }
}

/* Track links arrive in several shapes - a share link with a tracking query, a
   localised /intl-xx/ link, the spotify:track: URI, or the bare id. */
function parseSpotifyTrackId(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const uri = trimmed.match(/^spotify:track:([A-Za-z0-9]+)$/)
  if (uri) return uri[1]

  const url = trimmed.match(/open\.spotify\.com\/(?:[a-z-]+\/)?track\/([A-Za-z0-9]+)/)
  if (url) return url[1]

  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed
  return null
}

function trackDetailsFrom(data: SpotifyTrackResponse | undefined): SpotifyTrackLookup | null {
  if (!data?.id) return null
  const year = parseInt(String(data.album?.release_date ?? '').slice(0, 4), 10)
  return {
    trackId: data.id,
    artist: (data.artists ?? []).map((a) => a.name).join(', '),
    title: data.name ?? '',
    year: Number.isFinite(year) ? year : null,
  }
}

export async function lookupSpotifyTrackAction(input: {
  url?: string
  artist?: string
  title?: string
}): Promise<{ track?: SpotifyTrackLookup; error?: string }> {
  const token = await getSpotifyAccessToken()
  if (!token) return { error: 'Spotify search is unavailable right now.' }

  const pastedId = input.url?.trim() ? parseSpotifyTrackId(input.url) : null
  if (input.url?.trim() && !pastedId) {
    return { error: "That doesn't look like a Spotify track link." }
  }

  try {
    if (pastedId) {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${pastedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { error: 'Spotify has no track behind that link.' }
      const track = trackDetailsFrom(await res.json())
      return track ? { track } : { error: 'Spotify has no track behind that link.' }
    }

    const title = (input.title ?? '').trim()
    if (!title) return { error: 'Type a title, or paste a Spotify link.' }

    const artist = (input.artist ?? '').trim()
    const query = artist ? `track:${title} artist:${artist}` : title
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return { error: 'Spotify search failed. Try again.' }

    const data = await res.json()
    const track = trackDetailsFrom(data?.tracks?.items?.[0])
    return track
      ? { track }
      : { error: 'No match on Spotify - try the full title, or paste a link.' }
  } catch {
    return { error: 'Could not reach Spotify.' }
  }
}

function configYearRange(
  config: { min_years?: number | null; max_years?: number | null } | null | undefined
): YearRange {
  return {
    minYears: config?.min_years ?? DEFAULT_YEAR_RANGE.minYears,
    maxYears: config?.max_years ?? DEFAULT_YEAR_RANGE.maxYears,
  }
}

export async function generateMusicSnippetsAction(
  numberOfSongs: number = 10,
  topic: string = '',
  difficulty: string = 'Medium',
  eventId: number,
  categoryConfigId: number,
  seedYear?: number
): Promise<{ songs?: MusicSnippetCandidate[]; error?: string }> {
  try {
    const supabase = await createClient()
    const [{ data: approved }, { data: generated }, { data: config }, lastYear] = await Promise.all([
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
        .select('is_higher_lower, min_years, max_years')
        .eq('id', categoryConfigId)
        .maybeSingle(),
      lastChainYear(supabase, eventId, categoryConfigId),
    ])

    const isHigherOrLower = config?.is_higher_lower ?? false
    const range = configYearRange(config)
    /* A part-built round continues from the last song's year, whatever the sheet
       sent - the chain, not the caller, decides where the pool should sit. */
    const chainYear = lastYear ?? seedYear ?? DEFAULT_START_YEAR

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

    const snippetTopicLine = topic.trim()
      ? `- Every song must fit the topic "${topic.trim()}", and this is binding. Where the topic names a decade, a year or a year range, every release year must fall inside it - a song from outside that period is wrong however iconic its intro is. Return fewer than ${numberOfSongs} songs rather than including one that sits outside the topic.`
      : '- Songs from 1960 to present day, spread across decades - include songs from the 60s, 70s, 80s, 90s, 2000s, 2010s, and 2020s where possible.'

    const difficultyLine = difficulty === 'Easy'
      ? '- Song difficulty: All songs should be very well-known hits that almost everyone would recognise.'
      : difficulty === 'Hard'
        ? '- Song difficulty: Include obscure or lesser-known tracks that only music enthusiasts would recognise.'
        : '- Song difficulty: Mix of well-known hits and some lesser-known tracks.'

    const currentYear = new Date().getFullYear()
    const windowFrom = Math.max(1960, chainYear - range.maxYears * 3)
    const windowTo = Math.min(currentYear, chainYear + range.maxYears * 3)

    const prompt = isHigherOrLower
      ? `You are a music expert for a pub quiz "Higher or Lower" round at "Don Fenticas".
The round is a chain: the host reads out a year, the teams say whether the next song was released higher or lower than it, and that song's release year becomes the year the following song is measured against. It starts from ${chainYear}.
Generate ${numberOfSongs} candidate songs to build that chain from.

Requirements:
- Release years between ${windowFrom} and ${windowTo}, spread evenly both above and below ${chainYear}.
- Every release year must be different from every other, and none may be ${chainYear}.
- Consecutive songs get compared to each other, so near-identical years are useless - aim for gaps of ${range.minYears} to ${range.maxYears} years between the years you pick.
- Well-known, recognizable songs that a British pub audience would know.
${topicLine}
${difficultyLine}
- Avoid these previously used songs: [${existingList}]
- Return a JSON array.`
      : `You are a music expert for a pub quiz at "Don Fenticas".
Generate exactly ${numberOfSongs} songs whose studio recording opens with a purely instrumental intro.

The intro rule is absolute and overrides every other requirement below:
- The first 8 seconds must contain NO lead vocals, NO backing vocals, NO spoken word and NO wordless singing (no "ooh", "ahh", chanting or humming).
- Judge the standard studio album or single version, timed from 0:00.
- If you are not certain a song clears a full 8 seconds, leave it out and choose another. A famous intro whose singing starts at 0:05 does not qualify - "Good Vibrations" by The Beach Boys is exactly the kind of song to exclude.
- Begin intro_description with the length of the instrumental intro, e.g. "0:12 - rising organ line before the vocal".

Requirements:
${snippetTopicLine}
- Well-known, recognizable songs that a British pub audience would know.
- The instrumental intro must be iconic and identifiable - think guitar riffs, piano intros, synth openings, drum patterns.
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
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
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

    const rawSongs = JSON.parse(content) as { artist: string; title: string; year: number; intro_description: string }[]

    /* A Higher-or-Lower round needs years either side of the chain, so a period
       topic is only binding on a name-that-tune round. */
    const topicWindow = isHigherOrLower ? null : parseTopicYearWindow(topic)
    const candidates = topicWindow
      ? rawSongs.filter((s) => withinTopicYears(s.year, topicWindow))
      : rawSongs

    if (topicWindow && !candidates.length) {
      return {
        error: `Every suggestion fell outside ${topicWindow.from}-${topicWindow.to}. Try again, or widen the topic.`,
      }
    }

    /* A name-that-tune round plays oldest-first. A Higher-or-Lower round must not
       be sorted - ascending years would make every answer after the first
       "Higher", and the chain order is set by the picking anyway. */
    if (!isHigherOrLower) candidates.sort((a, b) => a.year - b.year)

    const spotifyToken = await getSpotifyAccessToken()
    const songs: MusicSnippetCandidate[] = await Promise.all(
      candidates.map(async (s) => {
        let spotifyId: string | null = null
        if (spotifyToken) {
          spotifyId = await searchSpotifyTrack(s.artist, s.title, spotifyToken)
        }
        return { ...s, spotify_track_id: spotifyId }
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
    return {
      error: isTimeout(error)
        ? 'The Music Expert took too long. Try a smaller batch.'
        : 'Connection lost or request timed out. Please try again.',
    }
  }
}

export async function saveMusicSnippetsAction(
  songs: { artist: string; title: string; year: number; spotify_track_id: string | null }[],
  eventId: number,
  categoryName: string,
  categoryConfigId: number,
  topic: string = '',
  difficulty: string = '',
  startYear?: number
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
    .select('is_higher_lower, min_years, max_years, number_by_release_year')
    .eq('id', categoryConfigId)
    .maybeSingle()
  const isHigherOrLower = config?.is_higher_lower ?? false
  const range = configYearRange(config)
  const baseNo = await getMaxQuestionNo(supabase, eventId, categoryConfigId)

  /* A round set to release year plays oldest-first, so it is sorted before
     insert and renumbered afterwards. Everything else keeps the order it was
     picked in - and a Higher-or-Lower round has no say, because that order is
     the chain. */
  const byReleaseYear = !isHigherOrLower && (config?.number_by_release_year ?? true)
  const orderedSongs = byReleaseYear ? [...songs].sort((a, b) => a.year - b.year) : songs

  let comparisonYear = isHigherOrLower
    ? (await lastChainYear(supabase, eventId, categoryConfigId)) ?? startYear ?? DEFAULT_START_YEAR
    : 0
  let skipped = 0

  const insertData: Record<string, unknown>[] = []

  orderedSongs.forEach((s) => {
    const songIdentity = `${s.artist} - ${s.title}`
    const shared = {
      category: categoryName,
      topic: topic.trim() || null,
      difficulty: difficulty.trim() || null,
      release_year: s.year,
      spotify_track_id: s.spotify_track_id,
      asked_on: askedOn,
      events_id: eventId,
      quiz_category_configs_id: categoryConfigId,
      question_no: baseNo + insertData.length + 1,
      created_by: currentEmployeeId,
      created_at: now,
      updated_by: currentEmployeeId,
      updated_at: now,
    }

    if (isHigherOrLower) {
      /* The client keeps the chain valid as songs are ticked; this is the last
         word on it, so a bad step is dropped rather than written. */
      if (!isValidStep(s.year, comparisonYear, range)) {
        skipped++
        return
      }
      insertData.push({
        ...shared,
        question_text: `${songIdentity} is higher or lower than ${comparisonYear}?`,
        answer_text: String(s.year),
        answer_text_ext: songIdentity,
        hint_year: comparisonYear,
      })
      comparisonYear = s.year
      return
    }

    insertData.push({
      ...shared,
      question_text: `[${s.year}] Name the artist and song`,
      answer_text: songIdentity,
      answer_text_ext: null,
      hint_year: null,
    })
  })

  if (insertData.length) {
    const { error } = await supabase
      .from('past_quiz_questions')
      .insert(insertData)

    if (error) {
      console.error('Database save error:', error)
      throw new Error('Failed to save music snippets.')
    }
  }

  if (byReleaseYear) {
    await renumberSongsChronologically(supabase, eventId, categoryConfigId)
  }

  revalidatePath('/event-setups/quiz-generator')
  revalidatePath('/event-setups/quiz-history')
  revalidatePath(`/event-setups/events/${eventId}`)

  const playlist = await syncCategoryPlaylistAction(eventId, categoryConfigId)
  return { success: true, skipped, ...playlist }
}

export type PlaylistSyncResult = {
  ok: boolean
  playlistUrl?: string
  needsConnect?: boolean
  error?: string
  /* Set when the playlist belongs to a different Spotify account - reconnecting
     will never help, so the UI has to say whose it is instead. */
  ownerName?: string
}

/* Drops this app's Spotify tokens so the next connect can pick a different
   account. Nothing that has already been saved is touched - playlists stay on
   whichever account made them. */
export async function disconnectSpotifyAction(): Promise<{ ok: true }> {
  await clearSpotifyTokens()
  revalidatePath('/event-setups/events/[id]', 'page')
  return { ok: true }
}

export type PlaylistCopyResult = {
  ok: boolean
  playlistUrl?: string
  needsConnect?: boolean
  error?: string
}

async function loadCategoryPlaylists(
  supabase: SupabaseClient,
  eventId: number,
  categoryConfigId: number
): Promise<CategoryPlaylistRow[]> {
  const { data } = await supabase
    .from('event_category_playlists')
    .select('playlist_id, playlist_url, employee_id, employees(full_name)')
    .eq('events_id', eventId)
    .eq('quiz_category_configs_id', categoryConfigId)
  return (data as CategoryPlaylistRow[] | null) ?? []
}

const QUIZ_PLAYLIST_DESCRIPTION = 'Quiz Nights at Don Fenticas'

function playlistTitle(
  eventDate: string | null | undefined,
  config: { order_no?: number | null; category_name?: string | null }
): string {
  const datePart = eventDate ? format(new Date(eventDate + 'T00:00:00'), 'd MMMM') : ''
  const orderPart = config.order_no != null ? `${config.order_no}. ` : ''
  return `${datePart} / ${orderPart}${(config.category_name ?? '').toUpperCase()}`.trim()
}

async function roundTrackUris(
  supabase: SupabaseClient,
  eventId: number,
  categoryConfigId: number
): Promise<string[]> {
  const { data } = await supabase
    .from('past_quiz_questions')
    .select('spotify_track_id, question_no')
    .eq('events_id', eventId)
    .eq('quiz_category_configs_id', categoryConfigId)
    .order('question_no', { ascending: true, nullsFirst: false })

  return (data ?? [])
    .map((s) => s.spotify_track_id)
    .filter((id): id is string => !!id)
    .map((id) => `spotify:track:${id}`)
}

async function upsertMyPlaylistRow(
  supabase: SupabaseClient,
  eventId: number,
  categoryConfigId: number,
  employeeId: number | null,
  playlist: { id: string; url: string }
) {
  await supabase.from('event_category_playlists').upsert(
    {
      events_id: eventId,
      quiz_category_configs_id: categoryConfigId,
      employee_id: employeeId,
      playlist_id: playlist.id,
      playlist_url: playlist.url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'events_id,quiz_category_configs_id,employee_id' }
  )
}

/* Copies the round onto the signed-in account as a playlist of your own. Nobody
   else's row is touched - theirs stays exactly where it was, and from here on
   each of you syncs your own. */
export async function copyCategoryPlaylistAction(
  eventId: number,
  categoryConfigId: number
): Promise<PlaylistCopyResult> {
  try {
    if (!(await getUserSpotifyToken())) return { ok: false, needsConnect: true }

    const supabase = await createClient()

    const [{ data: event }, { data: config }, uris, employeeId] = await Promise.all([
      supabase.from('events').select('date').eq('id', eventId).single(),
      supabase.from('quiz_category_configs').select('order_no, category_name').eq('id', categoryConfigId).single(),
      roundTrackUris(supabase, eventId, categoryConfigId),
      getCurrentEmployeeId(supabase),
    ])

    if (!config) return { ok: false, error: 'category_not_found' }
    if (!uris.length) return { ok: false, error: 'no_songs' }
    if (employeeId == null) return { ok: false, error: 'no_employee_record' }

    const userId = await getCurrentUserId()
    const created = await createPublicPlaylist(
      userId,
      playlistTitle(event?.date, config),
      QUIZ_PLAYLIST_DESCRIPTION
    )
    await replacePlaylistTracks(created.id, uris)

    await upsertMyPlaylistRow(supabase, eventId, categoryConfigId, employeeId, created)

    revalidatePath('/event-setups/events/[id]', 'page')
    return { ok: true, playlistUrl: created.url }
  } catch (err) {
    if (err instanceof SpotifyScopeError) return { ok: false, needsConnect: true, error: 'reconnect' }
    if (err instanceof SpotifyNotConnectedError) return { ok: false, needsConnect: true }
    console.error('Playlist copy failed:', err)
    return { ok: false, error: 'copy_failed' }
  }
}

export async function syncCategoryPlaylistAction(
  eventId: number,
  categoryConfigId: number
): Promise<PlaylistSyncResult> {
  try {
    const token = await getUserSpotifyToken()
    if (!token) return { ok: false, needsConnect: true }

    const supabase = await createClient()

    const [{ data: event }, { data: config }, uris, employeeId, rows] = await Promise.all([
      supabase.from('events').select('date').eq('id', eventId).single(),
      supabase.from('quiz_category_configs').select('order_no, category_name').eq('id', categoryConfigId).single(),
      roundTrackUris(supabase, eventId, categoryConfigId),
      getCurrentEmployeeId(supabase),
      loadCategoryPlaylists(supabase, eventId, categoryConfigId),
    ])

    if (!config) return { ok: false, error: 'category_not_found' }

    const mine = employeeId != null ? rows.find((r) => r.employee_id === employeeId) : undefined
    const legacy = rows.find((r) => r.employee_id == null)

    let playlistId = mine?.playlist_id ?? null
    let playlistUrl = mine?.playlist_url ?? null
    let claimedLegacy = false

    /* A round built before per-user playlists has an ownerless row. If it turns
       out to be on this account, claim it rather than making a second copy of a
       playlist this person already owns. */
    if (!playlistId && legacy && employeeId != null) {
      const [owner, me] = await Promise.all([
        getPlaylistOwner(legacy.playlist_id).catch(() => null),
        getCurrentUserId().catch(() => null),
      ])
      if (owner && me && owner.id === me) {
        playlistId = legacy.playlist_id
        playlistUrl = legacy.playlist_url
        claimedLegacy = true
      } else if (owner && me) {
        return {
          ok: false,
          error: 'not_owner',
          ownerName: playlistOwnerName(legacy) ?? owner.name,
          playlistUrl: legacy.playlist_url,
        }
      }
    }

    if (!playlistId) {
      const userId = await getCurrentUserId()
      const created = await createPublicPlaylist(
        userId,
        playlistTitle(event?.date, config),
        QUIZ_PLAYLIST_DESCRIPTION
      )
      playlistId = created.id
      playlistUrl = created.url
      await upsertMyPlaylistRow(supabase, eventId, categoryConfigId, employeeId, created)
    } else if (claimedLegacy && employeeId != null) {
      await supabase
        .from('event_category_playlists')
        .update({ employee_id: employeeId, updated_at: new Date().toISOString() })
        .eq('events_id', eventId)
        .eq('quiz_category_configs_id', categoryConfigId)
        .is('employee_id', null)
    }

    try {
      await replacePlaylistTracks(playlistId, uris)
    } catch (err) {
      /* Your own row can still go read-only if you reconnect as a different
         Spotify account, so name the owner rather than send this person round
         the reconnect loop forever. */
      if (err instanceof SpotifyScopeError) {
        const [owner, me] = await Promise.all([
          getPlaylistOwner(playlistId).catch(() => null),
          getCurrentUserId().catch(() => null),
        ])
        if (owner && me && owner.id !== me) {
          return {
            ok: false,
            error: 'not_owner',
            ownerName: owner.name,
            playlistUrl: playlistUrl ?? undefined,
          }
        }
      }
      throw err
    }

    revalidatePath('/event-setups/events/[id]', 'page')
    return { ok: true, playlistUrl: playlistUrl ?? undefined }
  } catch (err) {
    if (err instanceof SpotifyScopeError) return { ok: false, needsConnect: true, error: 'reconnect' }
    if (err instanceof SpotifyNotConnectedError) return { ok: false, needsConnect: true }
    console.error('Playlist sync failed:', err)
    return { ok: false, error: 'sync_failed' }
  }
}


const IMAGE_ATTEMPTS = 2
const IMAGE_RETRY_MS = 700
const IMAGE_BATCH_SIZE = 3
const IMAGE_BATCH_PAUSE_MS = 400
/* Shorter than the text deadline because a picture round makes this call ten
   times over, and a miss is retried rather than fatal. */
const IMAGE_TIMEOUT_MS = 30_000

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* The operator's notes never reach question_text, so they steer the picture
   without ever reaching the printed sheet the guests answer on. */
function pictureImagePrompt(answer: string, topic?: string, imageNotes?: string): string {
  const round = topic?.trim() ? ` on the topic "${topic.trim()}"` : ''
  const notes = imageNotes?.trim() ? `\n${imageNotes.trim()}` : ''
  return (
    `A clear, high-quality image of ${answer} for a pub quiz picture round${round}. ` +
    `Clean background. Subject clearly visible and fills the frame. No text overlays. No watermarks.` +
    notes
  )
}

async function requestImage(prompt: string, label: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) return null
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.error(`[img-gen] ${label}: HTTP ${res.status}`, errBody)
      return null
    }
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p.inlineData?.data)
    if (!imagePart) {
      console.error(`[img-gen] ${label}: no inlineData in response`, JSON.stringify(data).slice(0, 300))
      return null
    }
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
  } catch (err) {
    console.error(`[img-gen] ${label}:`, err)
    return null
  }
}

/* A single miss is usually a rate limit or a one-off refusal rather than a
   subject the model cannot draw, so one card failing is worth a second ask. */
async function generateImageForAnswer(
  answer: string,
  topic?: string,
  imageNotes?: string
): Promise<string | null> {
  const prompt = pictureImagePrompt(answer, topic, imageNotes)
  for (let attempt = 1; attempt <= IMAGE_ATTEMPTS; attempt++) {
    const image = await requestImage(prompt, answer)
    if (image) return image
    if (attempt < IMAGE_ATTEMPTS) await wait(IMAGE_RETRY_MS)
  }
  return null
}

export async function regeneratePictureImageAction(
  answer: string,
  topic?: string,
  imageNotes?: string
): Promise<{ imageUrl: string | null }> {
  return { imageUrl: await generateImageForAnswer(answer, topic, imageNotes) }
}

export async function generatePictureRoundAction(
  numberOfItems: number = 10,
  topic: string,
  difficulty: string = 'Medium',
  eventId?: number,
  categoryConfigId?: number,
  excludeAnswers?: string[],
  imageNotes?: string
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

    // The notes are written to steer the picture, but guidance like "UK artists
    // only" belongs to the subject list too, so both prompts see them.
    const notesRule = imageNotes?.trim()
      ? `\n- Additional guidance from the quiz host: ${imageNotes.trim()}`
      : ''

    const prompt = `Generate exactly ${numberOfItems} specific, identifiable items for a pub quiz picture round on the topic "${topic}".

Rules:
- Each item must be a specific named thing with a visually distinctive appearance (suitable for a single photograph)
- Vary across the topic - avoid repetition within subtypes (e.g. for "dog breeds" don't list 5 retrievers)
- Difficulty: ${difficultyGuide}${excludeRule}${notesRule}
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
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
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
    for (let i = 0; i < answers.length; i += IMAGE_BATCH_SIZE) {
      if (i > 0) await wait(IMAGE_BATCH_PAUSE_MS)
      const batch = answers.slice(i, i + IMAGE_BATCH_SIZE)
      const images = await Promise.all(batch.map((a) => generateImageForAnswer(a, topic, imageNotes)))
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
    return {
      error: isTimeout(err)
        ? 'The picture round took too long. Try a smaller batch.'
        : 'Generation failed. Please try again.',
    }
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
    } else if (item.imageUrl) {
      storedImageUrl = item.imageUrl
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