import { stepAnswerText } from "./higher-lower";

export type HostCopyCategory = {
  id: number;
  category_name: string;
  question_count: number;
  order_no: number | null;
  include_spotify: boolean;
  is_picture: boolean;
  is_higher_lower: boolean;
};

export type HostCopyQuestion = {
  id: string;
  question_text: string;
  answer_text: string;
  answer_text_ext: string | null;
  quiz_category_configs_id: number | null;
  question_no: number | null;
  spotify_track_id: string | null;
  hint_year: number | null;
  release_year: number | null;
  image_description: string | null;
};

export type HostCopyLine = { number: number; question: string; answer: string; note: string | null };

export type HostCopyRound = {
  title: string;
  progress: string;
  playlistUrl: string | null;
  sharedQuestion: string | null;
  lines: HostCopyLine[];
};

export type HostCopy = {
  title: string;
  subtitle: string;
  questionsUrl: string;
  rounds: HostCopyRound[];
};

export type HostCopyInput = {
  eventTitle: string | null;
  eventDate: string | null;
  questionsUrl: string;
  categories: HostCopyCategory[];
  questions: HostCopyQuestion[];
  playlistByCategory: Record<number, string>;
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* The same reading as the host copy page: what the host says, then the answer,
   with the odd note beside it (the song to play, the Snowball to mark). */
export function buildHostCopy(input: HostCopyInput): HostCopy {
  const rounds = input.categories.map((cat) => {
    const questions = input.questions.filter((q) => q.quiz_category_configs_id === cat.id);
    const isNameThatTune = cat.include_spotify && !cat.is_higher_lower;
    const isHigherOrLower = cat.include_spotify && cat.is_higher_lower;
    const sharedQuestion = cat.is_picture ? (questions.find((q) => q.question_text)?.question_text ?? null) : null;

    const lines = questions.map((q, idx) => {
      const number = q.question_no ?? idx + 1;
      if (cat.is_picture) {
        return { number, question: `Picture ${number}`, answer: q.answer_text, note: q.image_description };
      }
      if (isNameThatTune) {
        const question = `Name the artist and song${q.release_year ? ` - released ${q.release_year}` : ""}`;
        return {
          number,
          question,
          answer: q.answer_text_ext ?? q.answer_text,
          note: q.spotify_track_id ? null : "No Spotify track - play manually",
        };
      }
      if (isHigherOrLower) {
        return {
          number,
          question: `${q.question_text}${q.answer_text_ext ? ` (${q.answer_text_ext})` : ""}`,
          answer: q.hint_year && q.release_year ? stepAnswerText(q.release_year, q.hint_year) : q.answer_text,
          note: null,
        };
      }
      return { number, question: q.question_text, answer: q.answer_text, note: null };
    });

    return {
      title: `${cat.order_no != null ? `${cat.order_no}. ` : ""}${cat.category_name}`,
      progress: `${questions.length} of ${cat.question_count}`,
      playlistUrl: input.playlistByCategory[cat.id] ?? null,
      sharedQuestion,
      lines,
    };
  });

  const total = input.questions.length;
  return {
    title: input.eventTitle ?? "Untitled event",
    subtitle: `${formatDate(input.eventDate)} · ${plural(total, "question")} across ${plural(rounds.length, "round")}`,
    questionsUrl: input.questionsUrl,
    rounds,
  };
}
