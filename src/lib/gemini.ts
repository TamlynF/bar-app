/**
 * Server-only Google Gemini helper with Google Search grounding.
 *
 * Mirrors the raw-`fetch` pattern already used by the quiz generator
 * (`event-setups/quiz-generator/actions.ts`) — no SDK — but adds the
 * `google_search` tool so the model can answer from live web results and
 * return source citations.
 *
 * NOTE: Gemini does not allow `responseMimeType: "application/json"` /
 * `responseSchema` together with the `google_search` tool, so callers prompt
 * for JSON in the text and parse it with `parseJsonLoose`.
 */

const MODEL = "gemini-2.5-flash";

export type GroundingCitation = { uri: string; title: string };

export type GroundedResult =
  | { text: string; citations: GroundingCitation[] }
  | { error: string };

function getApiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
}

/**
 * Run a grounded generation. Returns the model's text plus any web citations
 * from `groundingMetadata`. Never throws — returns `{ error }` on failure so
 * server actions can surface a friendly message.
 */
export async function generateGrounded(
  prompt: string,
  opts: { temperature?: number } = {},
): Promise<GroundedResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { error: "AI key is missing. Set GEMINI_API_KEY in your environment." };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: opts.temperature ?? 0.6 },
  };

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reach the AI service." };
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || "The AI service is currently unavailable.";
    // A 400 on the tool usually means Search grounding isn't enabled on the key's project.
    return { error: `AI error (${response.status}): ${message}` };
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const text: string | undefined = candidate?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");

  if (!text) {
    return { error: "The AI service returned an empty response." };
  }

  const chunks: Array<{ web?: { uri?: string; title?: string } }> =
    candidate?.groundingMetadata?.groundingChunks ?? [];
  const citations: GroundingCitation[] = chunks
    .map((c) => c.web)
    .filter((w): w is { uri: string; title: string } => !!w?.uri)
    .map((w) => ({ uri: w.uri, title: w.title || w.uri }));

  return { text, citations };
}

/**
 * Tolerant JSON extraction from an LLM text response: strips ```json fences and
 * any prose around the first JSON array/object. Returns null if nothing parses.
 */
export function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, "```").trim();

  // Prefer a fenced block if present.
  const fenceMatch = cleaned.match(/```\s*([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenceMatch) candidates.push(fenceMatch[1].trim());

  // Fall back to the outermost array or object in the text.
  const firstArr = cleaned.indexOf("[");
  const lastArr = cleaned.lastIndexOf("]");
  if (firstArr !== -1 && lastArr > firstArr) candidates.push(cleaned.slice(firstArr, lastArr + 1));
  const firstObj = cleaned.indexOf("{");
  const lastObj = cleaned.lastIndexOf("}");
  if (firstObj !== -1 && lastObj > firstObj) candidates.push(cleaned.slice(firstObj, lastObj + 1));

  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
