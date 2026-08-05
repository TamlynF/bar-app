import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen, Brain, CheckCircle2 } from "lucide-react";
import CategorySection from "./category-section";
import JumpToTopButton from "@/components/admin/jump-to-top-button";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Category = {
  id: number;
  category_name: string;
  question_count: number;
  order_no: number;
  include_spotify: boolean;
  is_picture: boolean;
  is_higher_lower: boolean;
};

type Question = {
  id: string;
  question_text: string;
  answer_text: string;
  answer_text_ext?: string | null;
  quiz_category_configs_id: number | null;
  question_no?: number | null;
  spotify_track_id: string | null;
  hint_year?: number | null;
  release_year?: number | null;
  image_url?: string | null;
  difficulty?: string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", id)
    .single();
  return {
    title: event?.title
      ? `${event.title} - Quiz Questions | Don Fenticas`
      : "Quiz Questions | Don Fenticas",
  };
}

export default async function EventQuizQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string; completed?: string; open?: string; back?: string }>;
}) {
  const { id } = await params;
  const {
    category: focusCategory,
    completed: completedCategory,
    open: openParam,
    back: backParam,
  } = await searchParams;
  const supabase = await createClient();

  const [
    { data: event, error: eventError },
    { data: categories },
    { data: questions },
    { data: playlists },
  ] = await Promise.all([
    supabase.from("events").select("id, title, date").eq("id", id).single(),
    supabase
      .from("quiz_category_configs")
      .select("id, category_name, question_count, order_no, include_spotify, is_picture, is_higher_lower")
      .eq("is_active", true)
      .order("order_no", { ascending: true }),
    supabase
      .from("past_quiz_questions")
      .select("id, question_text, answer_text, answer_text_ext, quiz_category_configs_id, question_no, spotify_track_id, hint_year, release_year, image_url, difficulty")
      .eq("events_id", id)
      .order("question_no", { ascending: true, nullsFirst: false })
      .order("created_at"),
    supabase
      .from("event_category_playlists")
      .select("quiz_category_configs_id, playlist_url")
      .eq("events_id", id),
  ]);

  if (eventError || !event) notFound();

  const cats: Category[] = categories ?? [];
  const qs: Question[] = questions ?? [];
  const playlistByCategory = new Map<number, string>(
    (playlists ?? []).map((p) => [p.quiz_category_configs_id, p.playlist_url])
  );

  const byCategory = cats.map((cat) => ({
    ...cat,
    questions: qs.filter((q) => q.quiz_category_configs_id === cat.id),
  }));

  const totalQuestions = qs.length;
  const targetQuestions = cats.reduce((s, c) => s + c.question_count, 0);
  const completedRounds = byCategory.filter((cat) => cat.questions.length >= cat.question_count).length;
  const firstIncompleteCategory = byCategory.find((cat) => cat.questions.length < cat.question_count);
  const quizIsComplete = byCategory.length > 0 && completedRounds === byCategory.length;
  const remainingQuestions = byCategory.reduce(
    (total, cat) => total + Math.max(cat.question_count - cat.questions.length, 0),
    0
  );
  const progress = targetQuestions > 0 ? Math.min(100, Math.round((totalQuestions / targetQuestions) * 100)) : 0;

  // Every round type now builds in place, so continuing opens the first
  // unfinished round's sheet on this page rather than navigating away.
  const backSuffix =
    backParam && backParam.startsWith("/") && !backParam.startsWith("//")
      ? `&back=${encodeURIComponent(backParam)}`
      : "";
  const continueHref = firstIncompleteCategory
    ? `/event-setups/events/${event.id}?category=${encodeURIComponent(firstIncompleteCategory.category_name)}&open=1${backSuffix}`
    : null;

  // The next round after each one that still needs questions. Drives the round
  // sheet's footer so approving hands you onward rather than dead-ending.
  // Recomputed every render, so it stays correct as rounds fill up.
  const withNext = byCategory.map((cat, i) => {
    const following = byCategory
      .slice(i + 1)
      .find((c) => c.questions.length < c.question_count);

    return {
      ...cat,
      nextRound: following
        ? {
            categoryName: following.category_name,
            savedCount: following.questions.length,
            targetCount: following.question_count,
          }
        : null,
    };
  });

  return (
    <div className="mx-auto animate-in space-y-4 p-2 text-left duration-700 fade-in sm:max-w-2xl sm:p-6 md:max-w-7xl lg:max-w-7xl">

      {completedCategory && (
        <div className="flex items-start gap-3 rounded-2xl border border-admin-success/25 bg-admin-success-bg px-4 py-3 text-admin-success">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">{completedCategory} is complete</p>
            {firstIncompleteCategory ? (
              <p className="mt-0.5 text-[13px] font-medium">
                Next, add {firstIncompleteCategory.question_count - firstIncompleteCategory.questions.length} question{firstIncompleteCategory.question_count - firstIncompleteCategory.questions.length === 1 ? "" : "s"} to {firstIncompleteCategory.category_name}.
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] font-medium">Every round now has its required questions.</p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-admin-line bg-admin-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-admin-primary/20 bg-admin-primary-soft">
            <Brain className="h-5 w-5 text-admin-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-tight font-bold tracking-tight text-admin-ink sm:text-xl">
              {event.title ?? "Untitled event"}
            </h1>
            <p className="mt-1 text-[13px] font-medium text-admin-muted">
              {formatDate(event.date)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg leading-none font-bold text-admin-primary tabular-nums">
              {totalQuestions}
              <span className="text-[13px] font-semibold text-admin-muted"> of {targetQuestions}</span>
            </p>
            <p className="mt-1 text-[12px] font-semibold text-admin-muted">questions saved</p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-admin-surface">
          <div
            className="h-full w-(--quiz-progress) rounded-full bg-admin-primary transition-[width] duration-300"
            style={{ "--quiz-progress": `${progress}%` } as React.CSSProperties}
          />
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] font-medium text-admin-muted">
            {quizIsComplete
              ? `${completedRounds} of ${byCategory.length} rounds complete. Your quiz is ready to review.`
              : `${completedRounds} of ${byCategory.length} rounds complete. ${remainingQuestions} question${remainingQuestions === 1 ? "" : "s"} still needed.`}
          </p>
          {continueHref && (
            <Link
              href={continueHref}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              {totalQuestions === 0 ? "Start building quiz" : "Continue building quiz"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {withNext.map((cat) => (
          <CategorySection
            key={cat.id}
            eventId={event.id}
            eventDate={event.date}
            categoryConfigId={cat.id}
            category_name={cat.category_name}
            question_count={cat.question_count}
            questions={cat.questions}
            orderNo={cat.order_no}
            includeSpotify={cat.include_spotify}
            isPicture={cat.is_picture}
            isHigherLower={cat.is_higher_lower}
            playlistUrl={playlistByCategory.get(cat.id) ?? null}
            autoOpen={focusCategory === cat.category_name}
            openSheet={openParam === "1" && focusCategory === cat.category_name}
            nextRound={cat.nextRound}
          />
        ))}

        {withNext.length > 0 && <JumpToTopButton />}

        {withNext.length === 0 && (
          <div className="rounded-2xl border border-dashed border-admin-line py-14 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-admin-muted opacity-20" />
            <p className="text-[15px] font-bold text-admin-ink">No quiz categories configured</p>
            <p className="mt-1 text-[13px] font-normal text-admin-muted">
              Add categories in{" "}
              <Link href="/event-setups/quiz-categories" className="underline">
                Quiz categories
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
