import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PrintActions from "./print-actions";
import { stepAnswerText } from "@/lib/quiz/higher-lower";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { pickCategoryPlaylist, type CategoryPlaylistRow } from "@/lib/quiz/category-playlist";

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
  answer_text_ext: string | null;
  quiz_category_configs_id: number | null;
  question_no: number | null;
  spotify_track_id: string | null;
  hint_year: number | null;
  release_year: number | null;
  image_url: string | null;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, date")
    .eq("id", id)
    .single();
  const datePart = event?.date ? formatDate(event.date) : "";
  return {
    title: `Quiz host copy${datePart ? ` - ${datePart}` : ""}${event?.title ? ` - ${event.title}` : ""}`,
  };
}

export default async function PrintQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      .select("quiz_category_configs_id, playlist_url, playlist_id, employee_id")
      .eq("events_id", id),
  ]);

  if (eventError || !event) notFound();

  const cats: Category[] = categories ?? [];
  const qs: Question[] = questions ?? [];

  // The host copy prints whoever's playlist this user would actually play from.
  const myEmployeeId = await getCurrentEmployeeId(supabase);
  const playlistRows = (playlists ?? []) as (CategoryPlaylistRow & {
    quiz_category_configs_id: number;
  })[];
  const playlistByCategory = new Map<number, string>();
  for (const cat of cats) {
    const picked = pickCategoryPlaylist(
      playlistRows.filter((p) => p.quiz_category_configs_id === cat.id),
      myEmployeeId
    );
    if (picked) playlistByCategory.set(cat.id, picked.row.playlist_url);
  }

  const rounds = cats.map((cat) => ({
    ...cat,
    questions: qs.filter((q) => q.quiz_category_configs_id === cat.id),
    playlistUrl: playlistByCategory.get(cat.id) ?? null,
  }));

  const totalQuestions = qs.length;

  return (
    <div data-print-sheet className="mx-auto max-w-4xl bg-white p-4 text-admin-ink sm:p-8">
      <PrintActions eventId={event.id} />

      <header className="mb-6 border-b-2 border-admin-ink pb-3">
        <p className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
          Host copy - questions and answers
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">
          {event.title ?? "Untitled event"}
        </h1>
        <p className="mt-1 text-[13px] font-medium text-admin-muted">
          {formatDate(event.date)} · {totalQuestions} question{totalQuestions === 1 ? "" : "s"} across {rounds.length} round{rounds.length === 1 ? "" : "s"}
        </p>
      </header>

      {rounds.map((round, index) => {
        const isNameThatTune = round.include_spotify && !round.is_higher_lower;
        const isHigherOrLower = round.include_spotify && round.is_higher_lower;
        const sharedQuestion = round.is_picture
          ? round.questions.find((q) => q.question_text)?.question_text ?? null
          : null;

        return (
          <section
            key={round.id}
            /* Round 1 shares the header's page; the rest each start a new one.
               Keyed off the index because the section is never :first-child -
               the toolbar and header sit above it. The break itself is in the
               print block in globals.css, which sets both spellings. */
            data-round-break={index > 0 ? "" : undefined}
            className="mb-8"
          >
            <div className="mb-3 flex items-baseline justify-between gap-4 break-after-avoid border-b border-admin-ink/40 pb-1.5">
              <h2 className="text-base font-bold tracking-tight">
                {round.order_no != null ? `${round.order_no}. ` : ""}
                {round.category_name}
              </h2>
              <span className="shrink-0 text-[12px] font-semibold text-admin-muted tabular-nums">
                {round.questions.length} of {round.question_count}
              </span>
            </div>

            {round.playlistUrl && (
              <p className="mb-3 break-after-avoid text-[12px] text-admin-muted">
                Playlist: <span className="font-medium text-admin-ink">{round.playlistUrl}</span>
              </p>
            )}

            {sharedQuestion && (
              <p className="mb-3 break-after-avoid text-[13px] font-semibold">
                Question: <span className="font-normal">{sharedQuestion}</span>
              </p>
            )}

            {round.questions.length === 0 ? (
              <p className="text-[13px] text-admin-muted italic">No questions saved for this round.</p>
            ) : round.is_picture ? (
              <ul className="grid grid-cols-3 gap-x-4 gap-y-5">
                {round.questions.map((q, idx) => (
                  <li key={q.id} className="break-inside-avoid text-center">
                    {q.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={q.image_url}
                        alt=""
                        loading="eager"
                        className="mx-auto h-32 w-full rounded-lg border border-admin-ink/20 object-contain"
                      />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-admin-ink/30 text-[12px] text-admin-muted">
                        No image
                      </div>
                    )}
                    <p className="mt-1.5 text-[12px] leading-snug">
                      <span className="font-bold">{q.question_no ?? idx + 1}.</span>{" "}
                      <span className="font-semibold">{q.answer_text}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <ol className="space-y-2.5">
                {round.questions.map((q, idx) => {
                  const number = q.question_no ?? idx + 1;
                  return (
                    <li key={q.id} className="break-inside-avoid">
                      <p className="text-[13px] leading-snug">
                        <span className="font-bold">{number}.</span>{" "}
                        {isNameThatTune ? (
                          <>
                            Name the artist and song
                            {q.release_year ? ` - released ${q.release_year}` : ""}
                            {!q.spotify_track_id && (
                              <span className="font-semibold"> [no Spotify track - play manually]</span>
                            )}
                          </>
                        ) : (
                          <>
                            {q.question_text}
                            {/* The question names only the year, so the host
                                needs the song beside it to know what to play. */}
                            {isHigherOrLower && q.answer_text_ext && ` (${q.answer_text_ext})`}
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 pl-5 text-[13px] leading-snug font-bold">
                        {/* The host reads the direction, then the year - which is
                            the year the next question compares against. */}
                        A:{" "}
                        {isHigherOrLower && q.hint_year && q.release_year
                          ? stepAnswerText(q.release_year, q.hint_year)
                          : q.answer_text}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
