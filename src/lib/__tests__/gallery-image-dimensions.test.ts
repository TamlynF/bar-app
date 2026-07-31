import { describe, it, expect, vi, afterEach } from "vitest";
import { readRemoteImageDimensions } from "../gallery-image-dimensions";

function pngBytes(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function mockFetch(response: Partial<Response> | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response)
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readRemoteImageDimensions", () => {
  it("reads dimensions from the header bytes", async () => {
    const bytes = pngBytes(1920, 1080);
    const fetchMock = mockFetch({
      ok: true,
      arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
    });

    await expect(readRemoteImageDimensions("https://example.test/a.png")).resolves.toEqual({
      width: 1920,
      height: 1080,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Range).toMatch(/^bytes=0-\d+$/);
  });

  it("returns null when the file cannot be fetched", async () => {
    mockFetch({ ok: false, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

    await expect(readRemoteImageDimensions("https://example.test/missing.png")).resolves.toBeNull();
  });

  it("returns null when the bytes are not a recognisable image", async () => {
    mockFetch({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer),
    });

    await expect(readRemoteImageDimensions("https://example.test/junk.bin")).resolves.toBeNull();
  });

  it("returns null when the request throws", async () => {
    mockFetch(new Error("network down"));

    await expect(readRemoteImageDimensions("https://example.test/a.png")).resolves.toBeNull();
  });
});
