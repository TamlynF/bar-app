/* Google Gemini. Everything Gemini-shaped lives here: the generateContent
   path, the contents/parts payloads, the candidates/parts responses, the
   google_search tool, inline file data, image parts, and the models list. */

import type {
  AiFileRequest,
  AiImageRequest,
  AiImageResult,
  AiModel,
  AiModelListResult,
  AiProviderAdapter,
  AiSearchResult,
  AiTextRequest,
  AiTextResult,
} from "./types";

export const GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const DEFAULT_TIMEOUT_MS = 45_000;

const TIMEOUT_MESSAGE = "The AI service took too long. Try a smaller batch.";
const NETWORK_MESSAGE = "Connection lost or request timed out. Please try again.";

const isTimeout = (error: unknown) =>
  error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

export function geminiGenerateUrl(baseUrl: string, model: string, apiKey: string): string {
  return `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export function geminiListUrl(baseUrl: string, apiKey: string, pageToken?: string): string {
  const params = new URLSearchParams({ pageSize: "1000", key: apiKey });
  if (pageToken) params.set("pageToken", pageToken);
  return `${baseUrl}/models?${params.toString()}`;
}

type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };

type GeminiPayload = {
  contents: { parts: GeminiPart[] }[];
  tools?: { google_search: Record<string, never> }[];
  generationConfig: Record<string, unknown>;
};

export function geminiTextPayload(request: AiTextRequest): GeminiPayload {
  return {
    contents: [{ parts: [{ text: request.prompt }] }],
    generationConfig: {
      temperature: request.temperature ?? 0.85,
      ...(request.responseSchema
        ? { responseMimeType: "application/json", responseSchema: request.responseSchema }
        : {}),
    },
  };
}

export function geminiSearchPayload(request: AiTextRequest): GeminiPayload {
  return {
    contents: [{ parts: [{ text: request.prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: request.temperature ?? 0.6 },
  };
}

export function geminiFilePayload(request: AiFileRequest): GeminiPayload {
  return {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: request.file.mimeType, data: request.file.base64 } },
          { text: request.prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: request.temperature ?? 0,
      ...(request.responseSchema
        ? { responseMimeType: "application/json", responseSchema: request.responseSchema }
        : {}),
    },
  };
}

export function geminiImagePayload(request: AiImageRequest): GeminiPayload {
  return {
    contents: [{ parts: [{ text: request.prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  };
}

type GeminiListEntry = {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
};

/* Only models that answer generateContent are any use to the app. Which kind
   a model is for is read off its id, because the list carries no such flag. */
export function parseGeminiModelList(json: unknown): AiModel[] {
  const entries = ((json as { models?: GeminiListEntry[] })?.models ?? []) as GeminiListEntry[];
  const models: AiModel[] = [];
  for (const entry of entries) {
    const id = (entry.name ?? "").replace(/^models\//, "").trim();
    if (!id) continue;
    if (!(entry.supportedGenerationMethods ?? []).includes("generateContent")) continue;
    models.push({
      id,
      displayName: entry.displayName?.trim() || id,
      description: entry.description?.trim() ?? "",
      inputTokenLimit: entry.inputTokenLimit ?? null,
      outputTokenLimit: entry.outputTokenLimit ?? null,
      kinds: /image/i.test(id) ? ["image"] : ["text"],
    });
  }
  return models;
}

async function post(
  request: { baseUrl: string; apiKey: string; model: string; timeoutMs?: number },
  payload: GeminiPayload
): Promise<{ result: unknown } | { error: string }> {
  try {
    const response = await fetch(geminiGenerateUrl(request.baseUrl, request.model, request.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data?.error?.message || "The AI service is currently unavailable.";
      return { error: `AI error (${response.status}): ${message}` };
    }
    return { result: await response.json() };
  } catch (error) {
    return { error: isTimeout(error) ? TIMEOUT_MESSAGE : NETWORK_MESSAGE };
  }
}

type GeminiCandidate = {
  content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] };
  groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
};

function firstCandidate(result: unknown): GeminiCandidate | undefined {
  return (result as { candidates?: GeminiCandidate[] })?.candidates?.[0];
}

function joinedText(candidate: GeminiCandidate | undefined): string {
  return (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("");
}

const geminiAdapter: AiProviderAdapter = {
  async listModels(baseUrl, apiKey): Promise<AiModelListResult> {
    const models: AiModel[] = [];
    let pageToken: string | undefined;
    try {
      do {
        const response = await fetch(geminiListUrl(baseUrl, apiKey, pageToken), {
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const message = data?.error?.message || "The provider did not return its model list.";
          return { error: `Could not list models (${response.status}): ${message}` };
        }
        const json = await response.json();
        models.push(...parseGeminiModelList(json));
        pageToken = (json as { nextPageToken?: string })?.nextPageToken || undefined;
      } while (pageToken);
    } catch (error) {
      return { error: isTimeout(error) ? "Listing models took too long." : "Could not reach the provider to list models." };
    }
    return { models };
  },

  async generateText(request): Promise<AiTextResult> {
    const outcome = await post(request, geminiTextPayload(request));
    if ("error" in outcome) return outcome;
    const text = joinedText(firstCandidate(outcome.result));
    return text ? { text } : { error: "The AI service returned an empty response." };
  },

  async generateWithSearch(request): Promise<AiSearchResult> {
    const outcome = await post(request, geminiSearchPayload(request));
    if ("error" in outcome) return outcome;
    const candidate = firstCandidate(outcome.result);
    const text = joinedText(candidate);
    if (!text) return { error: "The AI service returned an empty response." };
    const citations = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .map((chunk) => chunk.web)
      .filter((web): web is { uri: string; title: string } => !!web?.uri)
      .map((web) => ({ uri: web.uri, title: web.title || web.uri }));
    return { text, citations };
  },

  async readFile(request): Promise<AiTextResult> {
    const outcome = await post(request, geminiFilePayload(request));
    if ("error" in outcome) return outcome;
    const text = joinedText(firstCandidate(outcome.result));
    return text ? { text } : { error: "The AI service could not read anything from that file." };
  },

  async generateImage(request): Promise<AiImageResult> {
    const outcome = await post(request, geminiImagePayload(request));
    if ("error" in outcome) return outcome;
    const part = (firstCandidate(outcome.result)?.content?.parts ?? []).find((p) => p.inlineData?.data);
    if (!part?.inlineData) return { error: "The AI service returned no image." };
    return { dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` };
  },
};

export default geminiAdapter;
