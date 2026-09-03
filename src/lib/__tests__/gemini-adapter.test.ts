import { afterEach, describe, expect, it, vi } from "vitest";
import geminiAdapter, {
  geminiFilePayload,
  geminiGenerateUrl,
  geminiImagePayload,
  geminiSearchPayload,
  geminiTextPayload,
  parseGeminiModelList,
} from "@/lib/ai/providers/gemini";

const call = { baseUrl: "https://g.example/v1beta", apiKey: "k", model: "gemini-2.5-flash" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseGeminiModelList", () => {
  it("keeps generateContent models, strips the prefix and reads the kind off the id", () => {
    const models = parseGeminiModelList({
      models: [
        { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000 },
        { name: "models/gemini-2.5-flash-image", supportedGenerationMethods: ["generateContent"] },
        { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] },
        { name: "", supportedGenerationMethods: ["generateContent"] },
      ],
    });
    expect(models.map((m) => m.id)).toEqual(["gemini-2.5-flash", "gemini-2.5-flash-image"]);
    expect(models[0]).toMatchObject({ displayName: "Gemini 2.5 Flash", inputTokenLimit: 1000, kinds: ["text"] });
    expect(models[1]).toMatchObject({ displayName: "gemini-2.5-flash-image", kinds: ["image"] });
  });
});

describe("payloads and url", () => {
  it("builds the generateContent url from the base", () => {
    expect(geminiGenerateUrl(call.baseUrl, "gemini-3-pro", "abc")).toBe(
      "https://g.example/v1beta/models/gemini-3-pro:generateContent?key=abc"
    );
  });

  it("builds text, search, file and image payloads as the app always has", () => {
    expect(geminiTextPayload({ ...call, prompt: "hi", responseSchema: { type: "ARRAY" } })).toEqual({
      contents: [{ parts: [{ text: "hi" }] }],
      generationConfig: { temperature: 0.85, responseMimeType: "application/json", responseSchema: { type: "ARRAY" } },
    });
    expect(geminiSearchPayload({ ...call, prompt: "hi" })).toEqual({
      contents: [{ parts: [{ text: "hi" }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.6 },
    });
    expect(geminiFilePayload({ ...call, prompt: "read", file: { base64: "AAA", mimeType: "application/pdf" } })).toEqual({
      contents: [{ parts: [{ inline_data: { mime_type: "application/pdf", data: "AAA" } }, { text: "read" }] }],
      generationConfig: { temperature: 0 },
    });
    expect(geminiImagePayload({ ...call, prompt: "draw" })).toEqual({
      contents: [{ parts: [{ text: "draw" }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    });
  });
});

describe("adapter calls", () => {
  it("returns joined text from the first candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "a" }, { text: "b" }] } }] })))
    );
    expect(await geminiAdapter.generateText({ ...call, prompt: "p" })).toEqual({ text: "ab" });
  });

  it("surfaces the provider's error message with the status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }))
    );
    expect(await geminiAdapter.generateText({ ...call, prompt: "p" })).toEqual({ error: "AI error (429): quota" });
  });

  it("returns an image data url and citations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ inlineData: { mimeType: "image/png", data: "QUJD" } }, { text: "t" }] },
                groundingMetadata: { groundingChunks: [{ web: { uri: "https://x", title: "" } }, { web: {} }] },
              },
            ],
          })
        )
      )
    );
    expect(await geminiAdapter.generateImage({ ...call, prompt: "p" })).toEqual({ dataUrl: "data:image/png;base64,QUJD" });
    expect(await geminiAdapter.generateWithSearch({ ...call, prompt: "p" })).toEqual({
      text: "t",
      citations: [{ uri: "https://x", title: "https://x" }],
    });
  });

  it("follows pagination when listing models", async () => {
    const pages = [
      { models: [{ name: "models/gemini-3-pro", supportedGenerationMethods: ["generateContent"] }], nextPageToken: "p2" },
      { models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] },
    ];
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify(pages.shift()));
    });
    const result = await geminiAdapter.listModels(call.baseUrl, "k");
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain("pageToken=p2");
    expect("models" in result && result.models.map((m) => m.id)).toEqual(["gemini-3-pro", "gemini-2.5-flash"]);
  });
});
