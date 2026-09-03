/* The prompts the quiz generator sends to the model, one per round type, with
   {{tokens}} where the code fills in what only it knows - the count asked for,
   the exclusion list, the year windows a Higher-or-Lower step allows.

   A category may store its own wording on quiz_category_configs.ai_prompt; null
   there means the built-in prompt below. Pure and free of any Supabase import,
   because the generator renders these on the server and the categories page
   shows and edits them in the browser. */

export type PromptKind = "question" | "picture" | "song" | "higher_lower";

export const PROMPT_KINDS: readonly PromptKind[] = ["question", "picture", "song", "higher_lower"];

export function promptKindFor(flags: {
  isPicture: boolean;
  includeSpotify: boolean;
  isHigherLower: boolean;
}): PromptKind {
  if (flags.isPicture) return "picture";
  if (!flags.includeSpotify) return "question";
  return flags.isHigherLower ? "higher_lower" : "song";
}

export const PROMPT_KIND_LABELS: Record<PromptKind, string> = {
  question: "Question round",
  picture: "Picture round subjects",
  song: "Name-that-tune round",
  higher_lower: "Higher or Lower round",
};

/* label - what the field is; source - where the generator gets it from, in
   terms of the screens staff use; sample - what it might look like once
   filled in. */
export type PromptToken = { token: string; label: string; source: string; sample: string };

const ROUND_SHEET_COUNT = "The number you ask for in the round sheet when you generate.";
const ROUND_SHEET_TOPIC = "The topic typed in the round sheet when you generate.";
const ROUND_SHEET_DIFFICULTY =
  "The difficulty picked in the round sheet - Easy, Medium or Hard - turned into a sentence.";
const CATEGORY_EXCLUSIONS =
  "The last 100 items saved in this category, plus anything already generated for this event, so nothing comes back twice.";

export const PROMPT_TOKENS: Record<PromptKind, PromptToken[]> = {
  question: [
    {
      token: "subject",
      label: "The category the round is about",
      source:
        "This category's name. A name that describes the scoring rather than a subject, such as High Stakes, is sent as General Knowledge.",
      sample: "Movies",
    },
    {
      token: "topic_line",
      label: "The theme sentence, or a request for variety when no topic was given",
      source: `${ROUND_SHEET_TOPIC} Left blank, it asks for a balanced variety across the category instead.`,
      sample: 'Focus specifically on this theme within that category: "1980s action films".',
    },
    { token: "count", label: "How many questions were asked for", source: ROUND_SHEET_COUNT, sample: "10" },
    {
      token: "difficulty_line",
      label: "The difficulty wording for Easy, Medium or Hard",
      source: ROUND_SHEET_DIFFICULTY,
      sample: 'Mixture of easy, medium, and "bar-room debate" hard.',
    },
    {
      token: "exclusions",
      label: "Questions already asked in this category, so they are not repeated",
      source: CATEGORY_EXCLUSIONS,
      sample: "What is the capital of Peru? | Who painted The Night Watch?",
    },
  ],
  picture: [
    { token: "count", label: "How many pictures were asked for", source: ROUND_SHEET_COUNT, sample: "10" },
    { token: "topic", label: "The round's topic", source: ROUND_SHEET_TOPIC, sample: "Famous pets" },
    {
      token: "description_rule",
      label: "What the artist's description must contain, following the host's picture instructions",
      source:
        "Built from the picture instructions typed in the round sheet. With none, it asks for a one-sentence description of exactly which subject to draw.",
      sample: '- "description" is one sentence for the artist, never shown to guests: ...',
    },
    {
      token: "difficulty_guide",
      label: "The difficulty wording for Easy, Medium or Hard",
      source: ROUND_SHEET_DIFFICULTY,
      sample: "a mix of well-known and moderately challenging",
    },
    {
      token: "exclude_rule",
      label: "A rule listing answers already used in this round, or nothing",
      source:
        "The answers already saved or generated for this round in this event. Nothing at all when there are none yet.",
      sample: '- Do NOT include any of these already-used answers: ["Snoopy"]',
    },
    {
      token: "example",
      label: "A worked example of the JSON the model should return",
      source:
        "A fixed example built into the app, one version for rounds with picture instructions and one without, so the model returns the right shape.",
      sample: 'Example for topic "famous pets": [{"answer":"Hachiko","description":"..."}]',
    },
  ],
  song: [
    { token: "count", label: "How many songs were asked for", source: ROUND_SHEET_COUNT, sample: "10" },
    {
      token: "topic_line",
      label: "The binding topic rule, or a spread across decades when no topic was given",
      source: `${ROUND_SHEET_TOPIC} A decade or year range in it is binding. Left blank, it asks for songs spread from 1960 to today.`,
      sample: '- Every song must fit the topic "90s Britpop", and this is binding. ...',
    },
    {
      token: "difficulty_line",
      label: "The difficulty wording for Easy, Medium or Hard",
      source: ROUND_SHEET_DIFFICULTY,
      sample: "- Song difficulty: Mix of well-known hits and some lesser-known tracks.",
    },
    {
      token: "exclusions",
      label: "Songs already used in this category, so they are not repeated",
      source: CATEGORY_EXCLUSIONS,
      sample: "Oasis - Wonderwall | Blur - Parklife",
    },
  ],
  higher_lower: [
    {
      token: "chain_year",
      label: "The year the next song is compared against",
      source:
        "The release year of the last song already in the round. For the first song it is the start year set in the round sheet.",
      sample: "1994",
    },
    {
      token: "brief",
      label: "What to generate - candidates from a host-picked year, or from the allowed windows",
      source:
        "Depends on whether you picked a release year for the next song in the round sheet. With one, every candidate must come from that year.",
      sample:
        "Generate 10 candidate songs. Exactly one of them will be picked, so every single one must be a legal answer on its own.",
    },
    {
      token: "year_rules",
      label: "The release-year rules for this step, worked out from the category's year gap",
      source:
        "Worked out from this category's min and max years apart and the year being compared against - or the release year you picked in the round sheet.",
      sample: "- The release year MUST be between 1984 and 1991, or between 1997 and 2004. ...",
    },
    {
      token: "topic_line",
      label: "The theme line, or a request for variety when no topic was given",
      source: `${ROUND_SHEET_TOPIC} Left blank, it asks for a balanced variety across genres.`,
      sample: '- Focus on this theme/genre: "Rock".',
    },
    {
      token: "difficulty_line",
      label: "The difficulty wording for Easy, Medium or Hard",
      source: ROUND_SHEET_DIFFICULTY,
      sample: "- Song difficulty: Mix of well-known hits and some lesser-known tracks.",
    },
    {
      token: "exclusions",
      label: "Songs already used in this category, so they are not repeated",
      source: CATEGORY_EXCLUSIONS,
      sample: "Oasis - Wonderwall | Blur - Parklife",
    },
    {
      token: "return_rule",
      label: "The rule to return fewer songs rather than one outside the allowed years",
      source:
        "Depends on whether you picked a release year in the round sheet: it names that year, or the allowed windows.",
      sample: "- Return fewer than 10 songs rather than including one outside the allowed years.",
    },
  ],
};

export const DEFAULT_PROMPTS: Record<PromptKind, string> = {
  question: `Act as the Pub Quiz Master for "Don Fenticas".
Generate a round for the category: "{{subject}}".
{{topic_line}}

Requirements:
- Exactly {{count}} unique questions.
- Difficulty: {{difficulty_line}}
- Each question must be a direct, concise question only. No conversational filler, no preamble, no phrases like "Right then", "Here's one for you", "A proper head scratcher" etc. Just the question itself.
- Answers must be short and factual - just the answer, nothing else.
- Avoid these past questions: [{{exclusions}}].
- Format: JSON array.`,

  picture: `Generate exactly {{count}} specific, identifiable items for a pub quiz picture round on the topic "{{topic}}".

Rules:
- Each item must be a specific named thing (suitable for a single picture card)
- "answer" is the name guests write down, exactly as it should be marked
{{description_rule}}
- Vary across the topic - avoid repetition within subtypes (e.g. for "dog breeds" don't list 5 retrievers)
- Difficulty: {{difficulty_guide}}{{exclude_rule}}
- Return ONLY a valid JSON array of objects. No markdown, no explanation.
{{example}}`,

  song: `You are a music expert for a pub quiz at "Don Fenticas".
Generate exactly {{count}} songs whose studio recording opens with a purely instrumental intro.

The intro rule is absolute and overrides every other requirement below:
- The first 8 seconds must contain NO lead vocals, NO backing vocals, NO spoken word and NO wordless singing (no "ooh", "ahh", chanting or humming).
- Judge the standard studio album or single version, timed from 0:00.
- If you are not certain a song clears a full 8 seconds, leave it out and choose another. A famous intro whose singing starts at 0:05 does not qualify - "Good Vibrations" by The Beach Boys is exactly the kind of song to exclude.
- Begin intro_description with the length of the instrumental intro, e.g. "0:12 - rising organ line before the vocal".

Requirements:
{{topic_line}}
- Well-known, recognizable songs that a British pub audience would know.
- The instrumental intro must be iconic and identifiable - think guitar riffs, piano intros, synth openings, drum patterns.
{{difficulty_line}}
- Avoid these previously used songs: [{{exclusions}}]
- Return a JSON array sorted by year ascending.`,

  higher_lower: `You are a music expert for a pub quiz "Higher or Lower" round at "Don Fenticas".
The host reads out the year {{chain_year}}, and the teams say whether the next song was released higher or lower than it.
{{brief}}

Requirements:
{{year_rules}}
- Well-known, recognizable songs that a British pub audience would know.
{{topic_line}}
{{difficulty_line}}
- Avoid these previously used songs: [{{exclusions}}]
{{return_rule}}
- Return a JSON array.`,
};

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type PromptValues = Record<string, string | number | null | undefined>;

export type RenderedPrompt = {
  text: string;
  /* Tokens the wording asks for that the generator does not supply. Left in
     place rather than blanked, so a typo is visible in what the model gets
     back instead of silently deleting a rule. */
  unknownTokens: string[];
};

export function renderPrompt(template: string, values: PromptValues): RenderedPrompt {
  const unknown = new Set<string>();
  const text = template.replace(TOKEN, (match, token: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, token)) {
      unknown.add(token);
      return match;
    }
    const value = values[token];
    return value == null ? "" : String(value);
  });
  return { text, unknownTokens: [...unknown] };
}

export function promptTokensUsed(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(TOKEN)) found.add(match[1]);
  return [...found];
}

export function unknownPromptTokens(kind: PromptKind, template: string): string[] {
  const known = new Set(PROMPT_TOKENS[kind].map((t) => t.token));
  return promptTokensUsed(template).filter((token) => !known.has(token));
}

/* Textareas hand back CRLF on some browsers and a trailing newline on most,
   neither of which is a reason to call the wording customised. */
export function normalisePrompt(text: string | null | undefined): string {
  return (text ?? "").replace(/\r\n?/g, "\n").trim();
}

export function resolvePrompt(
  kind: PromptKind,
  stored: string | null | undefined
): { template: string; isCustomised: boolean } {
  const custom = normalisePrompt(stored);
  return custom
    ? { template: custom, isCustomised: true }
    : { template: DEFAULT_PROMPTS[kind], isCustomised: false };
}

/* What to store: null for blank or for wording identical to the built-in
   prompt, so a category goes on inheriting later changes to it. */
export function promptOverride(kind: PromptKind, edited: string | null | undefined): string | null {
  const text = normalisePrompt(edited);
  if (!text || text === normalisePrompt(DEFAULT_PROMPTS[kind])) return null;
  return text;
}
