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
  describeStep,
  isValidStep,
  legalYearWindows,
  stepAnswerText,
  DEFAULT_START_YEAR,
  DEFAULT_YEAR_RANGE,
  type YearRange,
} from '@/lib/quiz/higher-lower'
import { parseTopicYearWindow, withinTopicYears } from '@/lib/quiz/topic-years'
import { promptSubject } from '@/lib/quiz/prompt-subject'
import {
  originColumns,
  QUIZ_TEXT_MODEL,
  QUIZ_IMAGE_MODEL,
  type QuestionOrigin,
} from '@/lib/quiz/question-origin'
import { topicSearchTokens, topicsOverlap } from '@/lib/quiz/topic-match'
import { getCurrentEmployeeId } from '@/lib/current-employee'
import { playlistOwnerName, type CategoryPlaylistRow } from '@/lib/quiz/category-playlist'
import { anagramBrief, scrambleAnswer, wantsAnagram } from '@/lib/quiz/anagram'
import { renderPrompt, resolvePrompt } from '@/lib/quiz/prompt-templates'

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
  creation_method?: string | null;
  ai_model?: string | null;
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
  ai_prompt: string | null;
}

export type PictureRoundItem = {
  answer: string;
  imageUrl: string | null;
  description?: string;
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
  const [{ data: approved }, { data: generated }, { data: config }] = await Promise.all([
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
    supabase
      .from('quiz_category_configs')
      .select('ai_prompt')
      .eq('id', categoryConfigId)
      .maybeSingle(),
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
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${QUIZ_TEXT_MODEL}:generateContent?key=${apiKey}`;


  const subject = promptSubject(category);

  const { text: prompt } = renderPrompt(resolvePrompt('question', config?.ai_prompt).template, {
    quiz_category_name: subject,
    topic_line: topic
      ? `Focus specifically on this theme within that category: "${topic}".`
      : `Provide a balanced variety of questions within the "${subject}" genre.`,
    count: numberOfQuestions,
    difficulty_line:
      difficulty === 'Easy'
        ? 'All questions should be easy - common knowledge that most people would know.'
        : difficulty === 'Hard'
          ? 'All questions should be challenging - obscure facts and "bar-room debate" level difficulty.'
          : 'Mixture of easy, medium, and "bar-room debate" hard.',
    exclusions: pastQuestionsList,
  });

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
  releaseYear?: number | null,
  imageDescription?: string | null
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
    await removeStoredImage(adminClient, imageData.oldImageUrl)
    newImageUrl = await storePictureImage(
      adminClient,
      Buffer.from(imageData.base64, 'base64'),
      imageData.mimeType,
      eventId ?? null
    )
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
  if (imageDescription !== undefined) updateFields.image_description = imageDescription?.trim() || null

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

async function removeStoredImage(adminClient: SupabaseClient, imageUrl: string | null | undefined) {
  if (!imageUrl) return
  try {
    const parts = new URL(imageUrl).pathname.split('/storage/v1/object/public/')
    if (!parts[1]) return
    const [bucket, ...rest] = parts[1].split('/')
    await adminClient.storage.from(bucket).remove([rest.join('/')])
  } catch (err) {
    console.error('Old image delete failed', err)
  }
}

async function storePictureImage(
  adminClient: SupabaseClient,
  buffer: Buffer,
  mimeType: string,
  eventId: number | null
): Promise<string | null> {
  try {
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png'
    const folder = eventId ? `quiz-pictures/${eventId}` : 'quiz-pictures'
    const path = `${folder}/${crypto.randomUUID()}.${ext}`
    const { data, error } = await adminClient.storage
      .from('gallery')
      .upload(path, buffer, { contentType: mimeType })
    if (error || !data) return null
    return adminClient.storage.from('gallery').getPublicUrl(data.path).data.publicUrl
  } catch (err) {
    console.error('New image upload failed', err)
    return null
  }
}

function dataUrlToImage(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const [header, base64] = dataUrl.split(',')
  const mimeType = header.match(/data:([^;]+);/)?.[1] ?? 'image/png'
  return { buffer: Buffer.from(base64, 'base64'), mimeType }
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
    const answerText =
      row.release_year == null || hintYear == null
        ? row.answer_text
        : stepAnswerText(row.release_year, hintYear);

    if (row.hint_year === hintYear && row.answer_text === answerText) continue;

    const updates: Record<string, unknown> = {
      hint_year: hintYear,
      answer_text: answerText,
      question_text: `Higher or lower than ${hintYear}?`,
    };

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
  difficulty: string = '',
  origin: QuestionOrigin
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
      ...originColumns(origin),
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
  seedYear?: number,
  /* On a Higher-or-Lower round the host names the year the next song comes
     from; every candidate is then a song released in exactly that year. Left
     out, the model picks years across the gap either side of the chain instead. */
  releaseYear?: number
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
        .select('is_higher_lower, min_years, max_years, ai_prompt')
        .eq('id', categoryConfigId)
        .maybeSingle(),
      lastChainYear(supabase, eventId, categoryConfigId),
    ])

    const isHigherOrLower = config?.is_higher_lower ?? false
    const range = configYearRange(config)
    /* A part-built round continues from the last song's year, whatever the sheet
       sent - the chain, not the caller, decides where the pool should sit. */
    const chainYear = lastYear ?? seedYear ?? DEFAULT_START_YEAR
    const pickedYear = isHigherOrLower && Number.isFinite(releaseYear) ? (releaseYear as number) : null

    if (pickedYear != null) {
      const reason = describeStep(pickedYear, chainYear, range)
      if (reason) return { error: reason }
    }

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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${QUIZ_TEXT_MODEL}:generateContent?key=${apiKey}`

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
    /* Only one of these songs is going to be picked, and whichever it is gets
       compared against ${chainYear}. So every candidate has to be a legal step
       on its own - the two windows the gap allows, one either side. */
    const windows = legalYearWindows(chainYear, range, currentYear)
    const allowedYearsLine = windows.higher
      ? `between ${windows.lower.from} and ${windows.lower.to}, or between ${windows.higher.from} and ${windows.higher.to}`
      : `between ${windows.lower.from} and ${windows.lower.to}`

    const { text: prompt } = isHigherOrLower
      ? renderPrompt(resolvePrompt('higher_lower', config?.ai_prompt).template, {
          chain_year: chainYear,
          brief: pickedYear != null
            ? `The host has decided this question's song comes from ${pickedYear}.\nGenerate ${numberOfSongs} candidate songs, every one of them originally released in ${pickedYear}. Exactly one of them will be picked.`
            : `Generate ${numberOfSongs} candidate songs. Exactly one of them will be picked, so every single one must be a legal answer on its own.`,
          year_rules: pickedYear != null
            ? `- The original release year MUST be ${pickedYear}. Judge the song's first release as a single or on an album - not a re-issue, remaster, live recording or cover version. A song first released in any other year is wrong however well it fits everything else.`
            : [
                `- The release year MUST be ${allowedYearsLine}. This is absolute: a song released outside ${windows.higher ? 'both of those ranges' : 'that range'} is wrong however well it fits everything else.`,
                `- That means the release year is between ${range.minYears} and ${range.maxYears} years away from ${chainYear}, in either direction. Never ${chainYear} itself.`,
                `- Offer a mix: some released before ${chainYear} and some after, so the answer is not obvious.`,
                '- Every release year must be different from every other.',
                '- Give the year the song was originally released, not a re-issue or remaster.',
              ].join('\n'),
          topic_line: topicLine,
          difficulty_line: difficultyLine,
          exclusions: existingList,
          return_rule: pickedYear != null
            ? `- Return fewer than ${numberOfSongs} songs rather than including one not first released in ${pickedYear}.`
            : `- Return fewer than ${numberOfSongs} songs rather than including one outside the allowed years.`,
        })
      : renderPrompt(resolvePrompt('song', config?.ai_prompt).template, {
          count: numberOfSongs,
          topic_line: snippetTopicLine,
          difficulty_line: difficultyLine,
          exclusions: existingList,
        })

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
    let candidates = topicWindow
      ? rawSongs.filter((s) => withinTopicYears(s.year, topicWindow))
      : rawSongs

    if (topicWindow && !candidates.length) {
      return {
        error: `Every suggestion fell outside ${topicWindow.from}-${topicWindow.to}. Try again, or widen the topic.`,
      }
    }

    /* The model is told the year or the window; this is what makes it true. A
       song that is not a legal step would only be offered to be refused. */
    if (pickedYear != null) {
      candidates = candidates.filter((s) => s.year === pickedYear)
      if (!candidates.length) {
        return { error: `Nothing came back that was released in ${pickedYear}. Try again, or try a different topic.` }
      }
    } else if (isHigherOrLower) {
      candidates = candidates.filter((s) => isValidStep(s.year, chainYear, range))
      if (!candidates.length) {
        return {
          error: `Nothing came back that is ${range.minYears}-${range.maxYears} years from ${chainYear}. Try again, or widen the year gap.`,
        }
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
  startYear: number | undefined,
  origin: QuestionOrigin
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
      ...originColumns(origin),
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
      /* What the host reads out is the year alone - naming the song would give
         the game away. The song is on the answer side, with the direction and
         the year it turned on. */
      insertData.push({
        ...shared,
        question_text: `Higher or lower than ${comparisonYear}?`,
        answer_text: stepAnswerText(s.year, comparisonYear),
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
   without ever reaching the printed sheet the guests answer on.

   The answer alone is not enough: "Snowball" on a famous-pets round drew a
   real white cat, not the Simpsons one. The description says which Snowball,
   what it is and where it is from, so the image is of that subject and not a
   plausible look-alike. */
function pictureImagePrompt(
  answer: string,
  topic?: string,
  imageNotes?: string,
  description?: string
): string {
  const round = topic?.trim() ? ` on the topic "${topic.trim()}"` : ''
  const about = description?.trim() ? `${description.trim()} ` : ''
  const notes = imageNotes?.trim()

  /* With instructions, the host - not the answer - decides what the picture
     is. "Only show the text of the anagram" has to beat the default of
     drawing the band, or every card comes back as a photo of the band with
     the letters mangled across it. "Pets with a mustache" must still draw
     the right pet, and neither may caption the card with the answer. */
  if (notes) {
    return (
      `Create one picture for a pub quiz picture round${round}. The answer guests write down for this card is "${answer}", ` +
      `and it must not appear anywhere in the picture. ` +
      `The quiz host's instructions for every picture in this round: "${notes}". ` +
      `What this card must show, written to follow those instructions: ${about}` +
      `Follow that brief exactly. If it calls for text instead of the subject, render that text and nothing else - large, clear, black capital letters ` +
      `centred on a plain white background, reproduced letter for letter exactly as given, never corrected, unscrambled, completed or translated. ` +
      `Otherwise depict exactly that subject as it is known, in its original art style if it is a cartoon or fictional character, ` +
      `not a generic look-alike, with the host's change applied, clearly visible on a clean background. ` +
      `No captions, no labels, no text naming the answer. No watermarks.`
    )
  }

  return (
    `A clear, high-quality image of ${answer} for a pub quiz picture round${round}. ` +
    about +
    `Depict this exact subject as it is known, in its original art style if it is a cartoon or fictional character, ` +
    `not a generic look-alike. ` +
    `Clean background. Subject clearly visible and fills the frame. No text overlays. No watermarks.`
  )
}

/* The rule the subject writer follows for "description" once the host has
   said what the pictures should be. Shared by the batch prompt and the
   single-answer describer so a hand-typed answer gets the same treatment as
   a generated one.

   Anagrams are deliberately not spelled out here: given the recipe, the model
   turned one card in every "pets with a mustache" batch into an anagram.
   Rounds that ask for them get their scramble built in code instead. */
function hostPictureBrief(imageNotes: string): string {
  return (
    `The quiz host's instructions for every picture in this round: "${imageNotes}". ` +
    `Decide once, from those instructions alone, which of two kinds they are, and write every description the same way. ` +
    `If they replace the picture with something else, such as text (a clue, a lyric, a definition), ` +
    `the description gives exactly what to show instead of the subject, letter for letter, as plain black text on a white background and nothing else. ` +
    `If they change how the subject is shown - a prop, a costume, a style, a setting, a colour - ` +
    `the description names exactly which subject it is and where it is from (show, film, book, brand, real life), ` +
    `what it looks like and its original art style if it is a cartoon or fictional character, so it stays recognisable as that exact one, ` +
    `and then applies the host's change to it. ` +
    `The picture never carries the answer or any caption.`
  )
}

/* A hand-typed answer arrives without the description the generator writes
   alongside its own subjects, so the text model supplies one before the
   picture is drawn. A miss here is not fatal - the image is still attempted
   from the answer alone. */
async function describePictureSubject(answer: string, topic?: string, imageNotes?: string): Promise<string | undefined> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) return undefined
  const round = topic?.trim() ? ` in a pub quiz picture round on the topic "${topic.trim()}"` : ''
  const notes = imageNotes?.trim()
  if (notes && wantsAnagram(notes)) return anagramBrief(answer, scrambleAnswer(answer))
  const prompt = notes
    ? `"${answer}" is the answer${round}. ${hostPictureBrief(notes)} Return only the description.`
    : `"${answer}" is the answer${round}. In one sentence, say what it is, where it is from (show, film, book, brand, real life) and what it looks like, so an artist could draw exactly the right one. Return only the sentence.`
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${QUIZ_TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      }
    )
    if (!res.ok) return undefined
    const data = await res.json()
    const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : undefined
  } catch (err) {
    console.error(`[img-gen] describe ${answer}:`, err)
    return undefined
  }
}

async function requestImage(prompt: string, label: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  if (!apiKey) return null
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${QUIZ_IMAGE_MODEL}:generateContent?key=${apiKey}`
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
  imageNotes?: string,
  description?: string
): Promise<string | null> {
  const prompt = pictureImagePrompt(answer, topic, imageNotes, description)
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
  imageNotes?: string,
  description?: string
): Promise<{ imageUrl: string | null; description?: string }> {
  const about = description?.trim() || (await describePictureSubject(answer, topic, imageNotes))
  return { imageUrl: await generateImageForAnswer(answer, topic, imageNotes, about), description: about }
}

/* A saved picture is redrawn from what the row already knows: the answer, the
   round's topic and notes, and the description written when it was created. A
   row saved without one gets described first, and keeps that description so
   the next redraw and the printed sheet agree on what the picture shows. */
export async function redrawPictureQuestionAction(
  id: string
): Promise<{ imageUrl: string | null; description: string | null }> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('past_quiz_questions')
    .select('answer_text, image_url, image_description, image_notes, topic, events_id')
    .eq('id', id)
    .single()
  if (error || !row) throw new Error('That question could not be found.')

  const description =
    row.image_description?.trim() ||
    (await describePictureSubject(row.answer_text, row.topic ?? undefined, row.image_notes ?? undefined)) ||
    null
  const dataUrl = await generateImageForAnswer(
    row.answer_text,
    row.topic ?? undefined,
    row.image_notes ?? undefined,
    description ?? undefined
  )
  if (!dataUrl) return { imageUrl: null, description }

  const adminClient = createAdminClient()
  const { buffer, mimeType } = dataUrlToImage(dataUrl)
  const imageUrl = await storePictureImage(adminClient, buffer, mimeType, row.events_id ?? null)
  if (!imageUrl) throw new Error('The new picture could not be stored.')
  await removeStoredImage(adminClient, row.image_url)

  let currentEmployeeId: number | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email) {
    const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).maybeSingle()
    if (emp) currentEmployeeId = emp.id
  }

  const { error: updateError } = await supabase
    .from('past_quiz_questions')
    .update({
      image_url: imageUrl,
      image_description: description,
      updated_by: currentEmployeeId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updateError) {
    console.error('Redraw update error:', updateError)
    throw new Error('The new picture could not be saved.')
  }

  revalidatePath('/event-setups/events/[id]', 'page')
  return { imageUrl, description }
}

export type PictureTopicUse = {
  eventId: number
  title: string | null
  date: string | null
  topic: string
}

type TopicRow = {
  events_id: number
  topic: string | null
  events: { title: string | null; date: string | null } | { title: string | null; date: string | null }[] | null
}

/* A picture round is its topic, so running the same one twice is a repeat night
   rather than a repeat question. Only rows with a picture count - the topic
   column is filled in on other round types too, where it means the steer given
   to the generator rather than what the guests were asked.

   The database narrows on any one word of the topic; whether two topics are
   really the same round is decided here, so "Famous dog breeds" finds "Dog
   breeds" without a full-text index to maintain. */
export async function pictureTopicUsageAction(
  topic: string,
  eventId: number
): Promise<PictureTopicUse[]> {
  const words = topicSearchTokens(topic)
  if (words.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('past_quiz_questions')
    .select('events_id, topic, events(title, date)')
    .or(words.map((word) => `topic.ilike.*${word}*`).join(','))
    .not('image_url', 'is', null)
    .neq('events_id', eventId)
    .limit(500)

  if (error || !data) return []

  const byEvent = new Map<number, PictureTopicUse>()
  for (const row of data as unknown as TopicRow[]) {
    if (row.events_id == null || byEvent.has(row.events_id)) continue
    if (!row.topic || !topicsOverlap(topic, row.topic)) continue
    const ev = Array.isArray(row.events) ? row.events[0] : row.events
    byEvent.set(row.events_id, {
      eventId: row.events_id,
      title: ev?.title ?? null,
      date: ev?.date ?? null,
      topic: row.topic,
    })
  }

  return [...byEvent.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

type PictureSubject = { answer: string; description?: string }

/* The schema asks for objects, but a bare string per item is still accepted so
   a model that ignores the shape degrades to the old answer-only picture. */
function parsePictureSubjects(content: string): PictureSubject[] {
  const raw: unknown = JSON.parse(content)
  if (!Array.isArray(raw)) return []
  const subjects: PictureSubject[] = []
  for (const entry of raw) {
    if (typeof entry === 'string' && entry.trim()) {
      subjects.push({ answer: entry.trim() })
    } else if (entry && typeof entry === 'object' && typeof (entry as PictureSubject).answer === 'string') {
      const { answer, description } = entry as PictureSubject
      if (!answer.trim()) continue
      subjects.push({
        answer: answer.trim(),
        description: typeof description === 'string' && description.trim() ? description.trim() : undefined,
      })
    }
  }
  return subjects
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
    let storedPrompt: string | null = null
    if (eventId && categoryConfigId) {
      const [{ data: approved }, { data: generated }, { data: config }] = await Promise.all([
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
        supabase
          .from('quiz_category_configs')
          .select('ai_prompt')
          .eq('id', categoryConfigId)
          .maybeSingle(),
      ])
      existingAnswers = [
        ...(approved?.map(q => q.answer_text) ?? []),
        ...(generated?.map(g => g.content_text) ?? []),
      ]
      storedPrompt = config?.ai_prompt ?? null
    }
    if (excludeAnswers?.length) {
      existingAnswers = [...existingAnswers, ...excludeAnswers]
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${QUIZ_TEXT_MODEL}:generateContent?key=${apiKey}`

    const difficultyGuide = difficulty === 'Easy'
      ? 'very well-known, instantly recognisable by almost everyone'
      : difficulty === 'Hard'
        ? 'less common or niche - a challenge for enthusiasts'
        : 'a mix of well-known and moderately challenging'

    const excludeRule = existingAnswers.length > 0
      ? `\n- Do NOT include any of these already-used answers: ${JSON.stringify(existingAnswers)}`
      : ''

    // The notes are written to steer the picture, but they also decide what
    // "description" means: with none it describes the subject to draw, with
    // some it is the brief the host asked for. The example shows only the
    // "change the subject" kind - an anagram example alongside it turned
    // "pets with a mustache" cards into anagrams, and anagram rounds get
    // their scramble built below regardless of what the model writes.
    const notes = imageNotes?.trim()
    const descriptionRule = notes
      ? `- "description" is the brief for the artist, never shown to guests. ${hostPictureBrief(notes)}`
      : `- "description" is one sentence for the artist, never shown to guests: what it is, where it is from (show, film, book, brand, real life) and what it looks like, so the picture is of exactly that one and not a look-alike. Name the species, colours and art style where they matter`
    const example = notes
      ? `Example for topic "famous pets" with host instructions "show pets with a mustache": [{"answer":"Snoopy","description":"Snoopy, the white beagle with black ears from the Peanuts comic strip, drawn in Charles Schulz's flat cartoon style, lying on top of his red doghouse, wearing a bushy black handlebar mustache."},{"answer":"Grumpy Cat","description":"Grumpy Cat, the real internet-famous cat with a permanently downturned mouth, blue eyes and a white-and-brown tabby coat, shown as a photograph, wearing a thin curled black mustache."}]`
      : `Example for topic "famous pets": [{"answer":"Snowball II","description":"The Simpson family's black cat with yellow eyes from the animated TV series The Simpsons, drawn in the show's flat cartoon style."},{"answer":"Hachiko","description":"The real cream-coloured Akita dog famous in Japan for waiting at Shibuya station for his late owner, shown as a photograph."}]`

    const { text: prompt } = renderPrompt(resolvePrompt('picture', storedPrompt).template, {
      count: numberOfItems,
      topic,
      description_rule: descriptionRule,
      difficulty_guide: difficultyGuide,
      exclude_rule: excludeRule,
      example,
    })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                answer: { type: 'STRING' },
                description: { type: 'STRING' },
              },
              required: ['answer', 'description'],
            },
          },
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
    const parsed = parsePictureSubjects(content)
    if (parsed.length === 0) return { error: 'AI returned an empty response.' }
    // The model picks the answers; the scramble is built here so every card is
    // a true anagram, which the model cannot be trusted with on long names.
    const subjects = wantsAnagram(notes)
      ? parsed.map((s) => ({ ...s, description: anagramBrief(s.answer, scrambleAnswer(s.answer)) }))
      : parsed

    const items: PictureRoundItem[] = []
    for (let i = 0; i < subjects.length; i += IMAGE_BATCH_SIZE) {
      if (i > 0) await wait(IMAGE_BATCH_PAUSE_MS)
      const batch = subjects.slice(i, i + IMAGE_BATCH_SIZE)
      const images = await Promise.all(
        batch.map((s) => generateImageForAnswer(s.answer, topic, imageNotes, s.description))
      )
      batch.forEach((subject, j) => items.push({ ...subject, imageUrl: images[j] }))
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
  difficulty: string = '',
  origin: QuestionOrigin,
  imageNotes: string = ''
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
      image_notes: imageNotes.trim() || null,
      image_description: item.description?.trim() || null,
      image_url: storedImageUrl,
      asked_on: askedOn,
      events_id: eventId,
      quiz_category_configs_id: categoryConfigId,
      question_no: baseNo + i + 1,
      ...originColumns(origin),
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