import type { MenuItemLite } from "./types";

// The venue the trends are for — gives the AI concrete grounding for its "action" ideas.
const VENUE =
  '"Don Fenticas", a grassroots live-music bar & daytime café on Regent Street, Hinckley, Leicestershire, UK';

// Every trend must relate to these business categories (the user's requirement).
const SECTORS =
  "music venues, bars, pubs, hospitality, drink vendors, food vendors, and entertainment";

// Ask the model to avoid regenerating anything the user has already saved or ignored
// (semantic de-dup — catches near-identical trends, not just exact-title repeats).
function blocklistLine(blocklist: string[]): string {
  if (!blocklist.length) return "";
  return `\nNEVER include these already-seen topics or anything near-identical: ${blocklist
    .slice(0, 40)
    .join("; ")}.`;
}

// Voice/tone directive shared by both trend prompts — keeps the copy punchy,
// plain and specific instead of formal marketing-speak.
const TONE = `VOICE — write like the bar's own switched-on social manager talking to the owner: punchy, plain, human, a bit of cheek. Every line must be concrete and specific — never vague or corporate.
- Name the ACTUAL thing driving it: the specific match, meme, song + artist, creator, headline, number or date — not "a trending audio" but the named track and roughly how many videos use it.
- Keep sentences short and lively. One idea per sentence, no padding.
- BANNED words/phrases (never use): leverage, utilise, engagement, content strategy, elevate, curate, synergy, "in today's fast-paced", "short-form video content that…", "reacts humorously to", "creating content that". Just say the thing plainly.`;

// The two output fields shared by both trend prompts.
const ACTION_EFFORT_SCHEMA =
  '  "action": "ONE concrete sentence: exactly what to film/post/run THIS WEEK — the specific shot, overlay text, audio or offer, and when to post it",\n' +
  '  "effort": "exactly one of: Easy, Medium, Big",';

/**
 * Advertising / social-media trend prompt: funny, highly-interacted content
 * (e.g. Instagram reels) tied to current events that the bar could riff on.
 */
export function buildAdvertisingTrendsPrompt(area: string, todayISO: string, blocklist: string[] = []): string {
  return `You are the social-media marketing scout inside the app of ${VENUE}. Comparison area: ${area}.
Today's date is ${todayISO}. Use web search to find what is trending RIGHT NOW.

Find 6 current advertising / social-media trends the venue could ride on. Prioritise:
- Funny or highly-shared short-form content (Instagram Reels, TikTok) that bars/pubs are using and that is getting strong engagement.
- Trends tied to CURRENT events happening in the world/UK this week (news, sport, seasonal moments, viral memes).
- Ideas clearly relevant to ${SECTORS}.
Prefer things happening near ${area} where relevant, but global viral trends are fine too.${blocklistLine(blocklist)}

${TONE}

Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "title": "punchy, max 8 words, vivid — the actual idea, not a category label (e.g. 'World Cup pub reaction reel')",
  "summary": "1-2 short, plain-English sentences: what the trend actually is",
  "relevance": "ONE punchy sentence on why it's hot RIGHT NOW — name the specific match/meme/song/creator/number/date",
${ACTION_EFFORT_SCHEMA}
  "category": "one of: reel, meme, seasonal, current_event, format, hashtag",
  "source_url": "a real URL to an example post or article (from your search)",
  "source_name": "platform or publication name, e.g. Instagram, TikTok, BBC",
  "tags": ["2-4","lowercase","keywords"]
}`;
}

/**
 * Competitor event-ideas prompt: what other hospitality businesses are running.
 */
export function buildEventIdeasPrompt(area: string, todayISO: string, blocklist: string[] = []): string {
  return `You are the events scout inside the app of ${VENUE}. Comparison area: ${area}.
Today's date is ${todayISO}. Use web search for the latest, real examples.

Find 6 event / function ideas that other businesses in ${SECTORS} are currently running,
especially near ${area}. Favour concrete, currently-advertised events (theme nights, live
music formats, quizzes, tasting events, seasonal functions) over generic advice.${blocklistLine(blocklist)}

${TONE}

Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "title": "punchy, max 8 words, vivid — the actual format, not a generic label (e.g. '90s Britpop bottomless brunch')",
  "summary": "1-2 short, plain-English sentences: what the business is actually doing",
  "relevance": "ONE punchy sentence on why it'd work for this venue — name the crowd, night or moment it taps",
${ACTION_EFFORT_SCHEMA}
  "category": "one of: theme_night, live_music, quiz, tasting, seasonal, community",
  "source_url": "a real URL to the event/business (from your search)",
  "source_name": "the business or listing name",
  "tags": ["2-4","lowercase","keywords"]
}`;
}

/**
 * Local competitor price prompt, scoped to the comparison area. We pass the
 * venue's own item names so the AI targets comparable products.
 */
export function buildPricesPrompt(area: string, radius: string | null, menuItems: MenuItemLite[]): string {
  const ownItems = menuItems.slice(0, 40).map((m) => m.name).join(", ") || "common bar drinks and snacks";
  const radiusLine = radius ? ` (within roughly ${radius})` : "";
  return `You are a hospitality pricing analyst. Use web search to find CURRENT typical prices
at bars, pubs and music venues in and around ${area}${radiusLine} in the UK (GBP).

Gather price points for common drinks, snacks and food, targeting items comparable to this
venue's own menu: ${ownItems}. Include a spread of nearby venues (name them). Prefer real,
recently-listed prices from menus, listings or reviews.

Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "venue_name": "name of the competitor venue",
  "item_name": "the product, e.g. Pint of Lager, House Gin & Tonic, Nachos",
  "item_type": "one of: drink, snack, food",
  "price_text": "the price as shown, e.g. £4.80",
  "source_url": "a real URL you used",
  "source_name": "the site/listing name"
}
Aim for 15-25 rows across several venues. Only include items where you found an actual price.`;
}
