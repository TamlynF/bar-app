/* What every AI provider has to offer the app, and nothing about how any one
   of them does it. A feature asks for text, a grounded answer, a read of a
   file or a picture; the adapter behind the chosen provider turns that into
   the provider's own request and reads its own response back. */

export type AiKind = "text" | "image";

export type AiCapability = "text" | "json" | "search" | "file" | "image";

export type AiProviderId = "gemini";

export type AiModel = {
  id: string;
  displayName: string;
  description: string;
  inputTokenLimit: number | null;
  outputTokenLimit: number | null;
  kinds: AiKind[];
};

export type AiFailure = { error: string };

export type AiCall = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

export type AiTextRequest = AiCall & {
  prompt: string;
  temperature?: number;
  responseSchema?: unknown;
};

export type AiFileRequest = AiTextRequest & {
  file: { base64: string; mimeType: string };
};

export type AiImageRequest = AiCall & { prompt: string };

export type AiCitation = { uri: string; title: string };

export type AiTextResult = { text: string } | AiFailure;
export type AiSearchResult = { text: string; citations: AiCitation[] } | AiFailure;
export type AiImageResult = { dataUrl: string } | AiFailure;
export type AiModelListResult = { models: AiModel[] } | AiFailure;

export type AiProviderAdapter = {
  listModels(baseUrl: string, apiKey: string): Promise<AiModelListResult>;
  generateText(request: AiTextRequest): Promise<AiTextResult>;
  generateWithSearch(request: AiTextRequest): Promise<AiSearchResult>;
  readFile(request: AiFileRequest): Promise<AiTextResult>;
  generateImage(request: AiImageRequest): Promise<AiImageResult>;
};

export type AiProvider = {
  id: AiProviderId;
  label: string;
  defaultBaseUrl: string;
  /* Environment variables holding the key, first one set wins. */
  apiKeyEnv: string[];
  capabilities: AiCapability[];
  adapter: AiProviderAdapter;
};

export function isAiFailure<T extends object>(result: T | AiFailure): result is AiFailure {
  return "error" in result && typeof (result as AiFailure).error === "string";
}
