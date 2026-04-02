import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Brain, BookOpen } from "lucide-react";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Category = { id: number; category_name: string; question_count: number };
type Question = {
  id: string;
  question_text: string;
  answer_text: string;
  quiz_category_configs_id: number | null;
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: event, error: eventError },
    { data: categories },
    { data: questions },
  ] = await Promise.all([
    supabase.from("events").select("id, title, date").eq("id", id).single(),
    supabase
      .from("quiz_category_configs")
      .select("id, category_name, question_count")
      .order("category_name"),
    supabase
      .from("past_quiz_questions")
      .select("id, question_text, answer_text, quiz_category_configs_id")
      .eq("events_id", id)
      .order("created_at"),
  ]);

  if (eventError || !event) notFound();

  const cats: Category[] = categories ?? [];
  const qs: Question[] = questions ?? [];

  const byCategory = cats.map((cat) => ({
    ...cat,
    questions: qs.filter((q) => q.quiz_category_configs_id === cat.id),
  }));

  const totalQuestions = qs.length;
  const targetQuestions = cats.reduce((s, c) => s + c.question_count, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">

      {/* Back nav */}
      <Link
        href="/settings/events"
        className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#5F624F] hover:text-[#26300D] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Events
      </Link>

      {/* Event header card */}
      <div className="bg-white border border-[#E6DFC8] rounded-2xl px-5 py-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#FDCC4B]/15 border border-[#FDCC4B]/30 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-[#FDCC4B]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-[#26300D] uppercase tracking-tighter leading-tight">
            {event.title ?? "Untitled Event"}
          </h1>
          <p className="text-[11px] font-bold text-[#5F624F] mt-0.5">
            {formatDate(event.date)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
            Questions
          </p>
          <p className="text-lg font-black text-[#26300D] tabular-nums leading-none">
            {totalQuestions}
            <span className="text-xs text-[#5F624F]/50 font-bold"> / {targetQuestions}</span>
          </p>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {byCategory.map((cat) => {
          const count = cat.questions.length;
          const isComplete = count >= cat.question_count;
          const hasAny = count > 0;
          return (
            <section
              key={cat.id}
              className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden"
            >
              {/* Category header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E6DFC8] bg-[#F7F4EA]">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#26300D]">
                  {cat.category_name}
                </p>
                <span
                  className={`text-[10px] font-black tabular-nums px-2.5 py-1 rounded-lg border ${
                    isComplete
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : hasAny
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-[#F7F4EA] border-[#E6DFC8] text-[#5F624F]"
                  }`}
                >
                  {count} / {cat.question_count}
                </span>
              </div>

              {/* Questions */}
              <div className="divide-y divide-[#E6DFC8]">
                {count === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <BookOpen className="w-6 h-6 text-[#5F624F] opacity-20 mx-auto mb-2" />
                    <p className="text-xs font-black text-[#5F624F] opacity-40 uppercase tracking-widest">
                      No questions yet
                    </p>
                  </div>
                ) : (
                  cat.questions.map((q, idx) => (
                    <div key={q.id} className="px-5 py-4 flex items-start gap-3">
                      <span className="text-[10px] font-black text-[#26300D]/20 mt-0.5 shrink-0 tabular-nums w-5 text-right">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-bold text-[#1F1F1A] leading-snug">
                          {q.question_text}
                        </p>
                        <p className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] rounded-xl px-3 py-1.5 w-fit">
                          {q.answer_text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}

        {/* No categories configured at all */}
        {byCategory.length === 0 && (
          <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
            <BookOpen className="w-8 h-8 text-[#5F624F] opacity-20 mx-auto mb-3" />
            <p className="text-sm font-black text-[#1F1F1A]">No quiz categories configured</p>
            <p className="text-[11px] text-[#5F624F] mt-1">
              Add categories in{" "}
              <Link href="/settings/quiz-categories" className="underline">
                Quiz Rules
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
