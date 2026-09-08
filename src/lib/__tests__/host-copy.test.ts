import { describe, expect, it } from "vitest";
import { buildHostCopy, type HostCopyCategory, type HostCopyQuestion } from "../quiz/host-copy";

const cat = (over: Partial<HostCopyCategory>): HostCopyCategory => ({
  id: 1,
  category_name: "General",
  question_count: 10,
  order_no: 1,
  include_spotify: false,
  is_picture: false,
  is_higher_lower: false,
  ...over,
});
const q = (over: Partial<HostCopyQuestion>): HostCopyQuestion => ({
  id: "q",
  question_text: "Q?",
  answer_text: "A",
  answer_text_ext: null,
  quiz_category_configs_id: 1,
  question_no: 1,
  spotify_track_id: null,
  hint_year: null,
  release_year: null,
  image_description: null,
  ...over,
});

describe("buildHostCopy", () => {
  it("numbers rounds and counts questions", () => {
    const copy = buildHostCopy({
      eventTitle: "Thursday Quiz",
      eventDate: "2026-09-13",
      questionsUrl: "https://example.test/event-setups/events/48",
      categories: [cat({}), cat({ id: 2, order_no: 2, category_name: "Music" })],
      questions: [q({}), q({ id: "b", question_no: 2, quiz_category_configs_id: 1 })],
      playlistByCategory: { 2: "https://open.spotify.com/playlist/x" },
    });
    expect(copy.title).toBe("Thursday Quiz");
    expect(copy.subtitle).toContain("2 questions across 2 rounds");
    expect(copy.rounds[0].title).toBe("1. General");
    expect(copy.rounds[0].progress).toBe("2 of 10");
    expect(copy.rounds[0].lines.map((l) => l.number)).toEqual([1, 2]);
    expect(copy.rounds[1].playlistUrl).toContain("spotify");
    expect(copy.rounds[1].lines).toHaveLength(0);
  });

  it("phrases song, higher-or-lower and picture rounds for the host", () => {
    const copy = buildHostCopy({
      eventTitle: null,
      eventDate: null,
      questionsUrl: "https://example.test/event-setups/events/48",
      categories: [
        cat({ id: 1, include_spotify: true }),
        cat({ id: 2, include_spotify: true, is_higher_lower: true }),
        cat({ id: 3, is_picture: true }),
      ],
      questions: [
        q({ id: "s", quiz_category_configs_id: 1, release_year: 1984, answer_text_ext: "Prince - Purple Rain" }),
        q({
          id: "h",
          quiz_category_configs_id: 2,
          question_text: "Higher or lower than 1990?",
          release_year: 1995,
          hint_year: 1990,
          answer_text_ext: "Oasis - Wonderwall",
        }),
        q({ id: "p", quiz_category_configs_id: 3, question_text: "Name the band", answer_text: "The Clash", image_description: "Anagram" }),
      ],
      playlistByCategory: {},
    });
    expect(copy.title).toBe("Untitled event");
    expect(copy.rounds[0].lines[0]).toMatchObject({
      question: "Name the artist and song - released 1984",
      answer: "Prince - Purple Rain",
      note: "No Spotify track - play manually",
    });
    expect(copy.rounds[1].lines[0].question).toBe("Higher or lower than 1990? (Oasis - Wonderwall)");
    expect(copy.rounds[1].lines[0].answer).toBe("Higher - released 1995");
    expect(copy.rounds[2].sharedQuestion).toBe("Name the band");
    expect(copy.rounds[2].lines[0]).toMatchObject({ question: "Picture 1", answer: "The Clash", note: "Anagram" });
  });
});
