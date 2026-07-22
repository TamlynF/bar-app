import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Brain, BookOpen } from "lucide-react";
import CategorySection from "./category-section";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
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
      ? `${event.title} — Quiz Questions | Don Fenticas`
      : "Quiz Questions | Don Fenticas",
  };
}

export default async function EventQuizQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category: focusCategory } = await searchParams;
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
      .select("id, question_text, answer_text, answer_text_ext, quiz_category_configs_id, question_no, spotify_track_id, hint_year, release_year, image_url")
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

  return (
    <div className="mx-auto animate-in space-y-6 p-2 text-left duration-700 fade-in sm:max-w-2xl sm:p-6 md:max-w-7xl lg:max-w-7xl">

      <div className="flex items-start gap-3 rounded-2xl border border-[#E6DFC8] bg-white px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#C8956D]/30 bg-[#C8956D]/30">
          <Brain className="h-4 w-4 text-[#5C4033]" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-black text-xl leading-tight tracking-tighter text-[#5C4033] uppercase">
            {event.title ?? "Untitled Event"}
          </h1>
          <p className="mt-0.5 text-[11px] font-bold text-[#5F624F]">
            {formatDate(event.date)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
            Questions
          </p>
          <p className="font-black text-lg leading-none text-[#5C4033] tabular-nums">
            {totalQuestions}
            <span className="text-xs font-bold text-[#5F624F]/50"> / {targetQuestions}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {byCategory.map((cat) => (
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
          />
        ))}

        {byCategory.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-20" />
            <p className="font-black text-sm text-[#1F1F1A]">No quiz categories configured</p>
            <p className="mt-1 text-[11px] text-[#5F624F]">
              Add categories in{" "}
              <Link href="/event-setups/quiz-categories" className="underline">
                Quiz Rules
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
