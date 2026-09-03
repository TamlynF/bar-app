/* What features call when they want a model to do something. Each call looks
   up the area's provider, model and endpoint from the settings row, hands the
   work to that provider's adapter, and says which provider and model ran so
   the caller can record it. */

import type { AiAreaKey } from "./areas";
import { aiProvider } from "./providers/registry";
import type {
  AiFailure,
  AiImageResult,
  AiProviderId,
  AiSearchResult,
  AiTextResult,
} from "./providers/types";
import { apiKeyFor, getAiSettings } from "./settings";

export type AiRun = { provider: AiProviderId; model: string };

type TextOptions = { prompt: string; temperature?: number; responseSchema?: unknown; timeoutMs?: number };
type FileOptions = TextOptions & { file: { base64: string; mimeType: string } };
type ImageOptions = { prompt: string; timeoutMs?: number };

async function target(area: AiAreaKey) {
  const settings = await getAiSettings();
  const resolved = settings.areas[area];
  const provider = aiProvider(resolved.provider);
  const apiKey = apiKeyFor(provider.id);
  const run: AiRun = { provider: provider.id, model: resolved.model };
  const missingKey: AiFailure | null = apiKey
    ? null
    : { error: `No API key is set for ${provider.label}. Set ${provider.apiKeyEnv.join(" or ")} in the environment.` };
  return { adapter: provider.adapter, call: { baseUrl: resolved.baseUrl, apiKey, model: resolved.model }, run, missingKey };
}

export async function aiText(area: AiAreaKey, options: TextOptions): Promise<AiTextResult & AiRun> {
  const { adapter, call, run, missingKey } = await target(area);
  if (missingKey) return { ...missingKey, ...run };
  return { ...(await adapter.generateText({ ...call, ...options })), ...run };
}

export async function aiSearch(area: AiAreaKey, options: TextOptions): Promise<AiSearchResult & AiRun> {
  const { adapter, call, run, missingKey } = await target(area);
  if (missingKey) return { ...missingKey, ...run };
  return { ...(await adapter.generateWithSearch({ ...call, ...options })), ...run };
}

export async function aiReadFile(area: AiAreaKey, options: FileOptions): Promise<AiTextResult & AiRun> {
  const { adapter, call, run, missingKey } = await target(area);
  if (missingKey) return { ...missingKey, ...run };
  return { ...(await adapter.readFile({ ...call, ...options })), ...run };
}

export async function aiImage(area: AiAreaKey, options: ImageOptions): Promise<AiImageResult & AiRun> {
  const { adapter, call, run, missingKey } = await target(area);
  if (missingKey) return { ...missingKey, ...run };
  return { ...(await adapter.generateImage({ ...call, ...options })), ...run };
}

/* The model an area would run on right now, for callers that need to record
   it before or without making a call. */
export async function aiModelFor(area: AiAreaKey): Promise<AiRun> {
  const settings = await getAiSettings();
  const resolved = settings.areas[area];
  return { provider: resolved.provider, model: resolved.model };
}
