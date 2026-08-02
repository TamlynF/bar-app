import type { MenuItemLite } from "./types";

const VENUE =
  '"Don Fenticas", a grassroots live-music bar & daytime café on Regent Street, Hinckley, Leicestershire, UK';

const SECTORS =
  "music venues, bars, pubs, hospitality, drink vendors, food vendors, and entertainment";

function blocklistLine(blocklist: string[]): string {
  if (!blocklist.length) return "";
  return `\nNEVER include these already-seen topics or anything near-identical: ${blocklist
    .slice(0, 40)
    .join("; ")}.`;
}

const TONE = `VOICE - write like the bar's own switched-on social manager talking to the owner: punchy, plain, human, a bit of cheek. Every line must be concrete and specific - never vague or corporate.
- Name the ACTUAL thing driving it: the specific match, meme, song + artist, creator, headline, number or date - not "a trending audio" but the named track and roughly how many videos use it.
- Keep sentences short and lively. One idea per sentence, no padding.
- BANNED words/phrases (never use): leverage, utilise, engagement, content strategy, elevate, curate, synergy, "in today's fast-paced", "short-form video content that…", "reacts humorously to", "creating content that". Just say the thing plainly.`;

const ACTION_EFFORT_SCHEMA =
  '  "action": "ONE concrete sentence: exactly what to film/post/run THIS WEEK - the specific shot, overlay text, audio or offer, and when to post it",\n' +
  '  "effort": "exactly one of: Easy, Medium, Big",';

const PRICE_ACTION_EFFORT_SCHEMA =
  '  "action": "ONE vivid sentence - the exact in-venue pricing play to run THIS WEEK. Give it a FUN, ownable name (a chalkboard pledge, a named house pour, a timed happy-hour, a bundle), commit to a specific price, say who and when it applies, and name the local rival or chain it undercuts. A REAL move at the bar - never \'film a reel\' or \'post a video\'.",\n' +
  '  "effort": "exactly one of: Easy, Medium, Big",';

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
  "title": "punchy, max 8 words, vivid - the actual idea, not a category label (e.g. 'World Cup pub reaction reel')",
  "summary": "1-2 short, plain-English sentences: what the trend actually is",
  "relevance": "ONE punchy sentence on why it's hot RIGHT NOW - name the specific match/meme/song/creator/number/date",
${ACTION_EFFORT_SCHEMA}
  "category": "one of: reel, meme, seasonal, current_event, format, hashtag",
  "source_url": "a real URL to an example post or article (from your search)",
  "source_name": "platform or publication name, e.g. Instagram, TikTok, BBC",
  "tags": ["2-4","lowercase","keywords"]
}`;
}

export function buildEventIdeasPrompt(area: string, todayISO: string, blocklist: string[] = []): string {
  return `You are the events scout inside the app of ${VENUE}. Comparison area: ${area}.
Today's date is ${todayISO}. Use web search for the latest, real examples.

Find 6 event / function ideas that other businesses in ${SECTORS} are currently running,
especially near ${area}. Favour concrete, currently-advertised events (theme nights, live
music formats, quizzes, tasting events, seasonal functions) over generic advice.${blocklistLine(blocklist)}

${TONE}

Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "title": "punchy, max 8 words, vivid - the actual format, not a generic label (e.g. '90s Britpop bottomless brunch')",
  "summary": "1-2 short, plain-English sentences: what the business is actually doing",
  "relevance": "ONE punchy sentence on why it'd work for this venue - name the crowd, night or moment it taps",
${ACTION_EFFORT_SCHEMA}
  "category": "one of: theme_night, live_music, quiz, tasting, seasonal, community",
  "source_url": "a real URL to the event/business (from your search)",
  "source_name": "the business or listing name",
  "tags": ["2-4","lowercase","keywords"]
}`;
}

export function buildPriceTrendsPrompt(
  area: string,
  radius: string | null,
  todayISO: string,
  priceContext: string = "",
  blocklist: string[] = [],
): string {
  const radiusLine = radius ? ` (within roughly ${radius})` : "";
  const contextBlock = priceContext.trim()
    ? `\nHERE IS THE VENUE'S OWN PRICING vs LOCAL RIVALS RIGHT NOW - build plays off these REAL numbers, name the actual rivals, and quote the exact gaps:\n${priceContext.trim()}\n`
    : "";
  return `You are the pricing scout inside the app of ${VENUE}. Comparison area: ${area}${radiusLine}.
Today's date is ${todayISO}. Use web search for CURRENT UK drink/hospitality pricing data and news RIGHT NOW.
${contextBlock}
Find 5 pricing plays this venue could run to win on value or margin. Make them CREATIVE and FUN - the kind of cheeky, ownable move a switched-on landlord chalks on a board, not safe corporate advice. Ground each in something real:
- The venue's own price gap above - name the rival and quote the exact before→after numbers or the £ difference.
- Actual pint/drink price data or trade-press reports (name the report, the beer AND the price) near ${area}.
- Category momentum (a drink whose sales/searches are spiking) that justifies a deal or feature.
- Happy-hour / value-pledge / bundle positioning that beats nearby ${SECTORS}.${blocklistLine(blocklist)}

Give every play an ownable NAME (e.g. an 'Honest Pint' pledge), a concrete committed price, and a bold call-out of exactly which chains or venues it beats in and around ${area}. Be specific, local and playful; never generic and never a national average with no local hook.

${TONE}

Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "title": "punchy, max 8 words - the play itself, vivid (e.g. 'Beat the £5+ pint with a value pledge')",
  "summary": "1 short, plain-English sentence: the value angle in a line",
  "relevance": "ONE punchy sentence on why NOW - name a specific local rival or trade report and the exact numbers/price gap behind it, tied to this week (e.g. 'Greene King IPA nearby is now £4.55, up from £3.85')",
${PRICE_ACTION_EFFORT_SCHEMA}
  "category": "one of: price_positioning, deal, happy_hour, value_pledge, bundle, seasonal_pricing",
  "source_url": "a real URL to the price data/report/menu (from your search)",
  "source_name": "the site/report/publication name",
  "tags": ["2-4","lowercase","keywords"]
}`;
}

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
