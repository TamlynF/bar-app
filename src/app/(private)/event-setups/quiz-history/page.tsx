import {
  getFullQuestionHistoryAction,
  getQuizEventsAction,
  type PastQuestionRecord,
  type QuizEventSummary,
} from '@/app/(private)/event-setups/quiz-generator/actions'
import QuizHistoryList, { type HistoryQuestion } from './_components/quiz-history-list'

export const dynamic = 'force-dynamic'

function toHistoryQuestion(record: PastQuestionRecord): HistoryQuestion {
  const config = record.quiz_category_configs
  const event = Array.isArray(record.events) ? record.events[0] : record.events

  return {
    id: record.id,
    questionNo: record.question_no ?? null,
    questionText: record.question_text ?? '',
    answerText: record.answer_text,
    answerTextExt: record.answer_text_ext ?? null,
    imageUrl: record.image_url ?? null,
    spotifyTrackId: record.spotify_track_id ?? null,
    hintYear: record.hint_year ?? null,
    releaseYear: record.release_year ?? null,
    topic: record.topic?.trim() || null,
    difficulty: record.difficulty?.trim() || null,
    categoryName: config?.category_name || record.category || 'General Knowledge',
    categoryOrder: config?.order_no ?? null,
    isPicture: !!config?.is_picture,
    includeSpotify: !!config?.include_spotify,
    isHigherLower: !!config?.is_higher_lower,
    eventId: event?.id ?? record.events_id ?? null,
    eventTitle: event?.title ?? null,
    eventDate: event?.date ?? record.asked_on ?? null,
  }
}

export default async function QuizArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const params = await searchParams
  const eventFilter = params.event || 'all'

  const [history, quizEvents] = await Promise.all([
    getFullQuestionHistoryAction(eventFilter),
    getQuizEventsAction(),
  ])

  const questions = (history ?? []).map(toHistoryQuestion)

  return (
    <div className="mx-auto max-w-6xl animate-in space-y-4 px-1 pt-4 pb-32 duration-300 fade-in sm:px-6 sm:pt-0">
      <QuizHistoryList
        questions={questions}
        quizEvents={quizEvents as QuizEventSummary[]}
        currentFilter={eventFilter}
      />
    </div>
  )
}
