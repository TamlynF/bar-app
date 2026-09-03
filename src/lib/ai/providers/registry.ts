/* The providers the app can talk to. Adding one is a new adapter file and an
   entry here; the settings page reads this list for its provider dropdown. */

import geminiAdapter, { GEMINI_DEFAULT_BASE_URL } from "./gemini";
import type { AiCapability, AiProvider, AiProviderId } from "./types";

export const AI_PROVIDERS: readonly AiProvider[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    defaultBaseUrl: GEMINI_DEFAULT_BASE_URL,
    apiKeyEnv: ["GEMINI_API_KEY", "NEXT_PUBLIC_GEMINI_API_KEY"],
    capabilities: ["text", "json", "search", "file", "image"],
    adapter: geminiAdapter,
  },
];

export const AI_PROVIDER_IDS: readonly AiProviderId[] = AI_PROVIDERS.map((provider) => provider.id);

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function aiProvider(id: AiProviderId): AiProvider {
  const found = AI_PROVIDERS.find((provider) => provider.id === id);
  if (!found) throw new Error(`Unknown AI provider: ${id}`);
  return found;
}

export function providerCovers(provider: AiProvider, needs: AiCapability[]): boolean {
  return needs.every((need) => provider.capabilities.includes(need));
}

export function providersCovering(needs: AiCapability[]): AiProvider[] {
  return AI_PROVIDERS.filter((provider) => providerCovers(provider, needs));
}
