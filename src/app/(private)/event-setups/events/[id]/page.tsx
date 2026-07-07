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
    <div className="space-y-6 mx-auto p-2 sm:p-6 sm:max-w-2xl md:max-w-7xl lg:max-w-7xl text-left animate-in duration-700 fade-in">

      {/* Event header card */}
      <div className="flex items-start gap-3 bg-white px-5 py-4 border border-[#E6DFC8] rounded-2xl">
        <div className="flex justify-center items-center bg-[#C8956D]/30 border border-[#C8956D]/30 rounded-2xl w-10 h-10 shrink-0">
          <Brain className="w-4 h-4 text-[#5C4033]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-[#5C4033] text-xl uppercase leading-tight tracking-tighter">
            {event.title ?? "Untitled Event"}
          </h1>
          <p className="mt-0.5 font-bold text-[#5F624F] text-[11px]">
            {formatDate(event.date)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
            Questions
          </p>
          <p className="font-black tabular-nums text-[#5C4033] text-lg leading-none">
            {totalQuestions}
            <span className="font-bold text-[#5F624F]/50 text-xs"> / {targetQuestions}</span>
          </p>
        </div>
      </div>

      {/* Categories */}
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

        {/* No categories configured at all */}
        {byCategory.length === 0 && (
          <div className="py-14 border border-[#E6DFC8] border-dashed rounded-2xl text-center">
            <BookOpen className="opacity-20 mx-auto mb-3 w-8 h-8 text-[#5F624F]" />
            <p className="font-black text-[#1F1F1A] text-sm">No quiz categories configured</p>
            <p className="mt-1 text-[#5F624F] text-[11px]">
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
