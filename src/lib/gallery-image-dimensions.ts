import { imageSize } from "image-size";

const HEADER_BYTES = 65536;

export type ImageDimensions = { width: number; height: number };

export async function readRemoteImageDimensions(
  url: string
): Promise<ImageDimensions | null> {
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const { width, height } = imageSize(new Uint8Array(await response.arrayBuffer()));

    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
}
