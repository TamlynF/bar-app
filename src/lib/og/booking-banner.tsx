import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* The link-preview banner for every booking page: one line saying what the
   page is for, the wordmark underneath, over a faint tiled df pattern. Wider
   than it is tall so chat apps draw it as a short strip rather than a poster. */
export const BANNER_SIZE = { width: 1200, height: 360 };
export const BANNER_CONTENT_TYPE = "image/png";

const OLIVE = "#26300D";
const GOLD = "#FDCC4B";
const CREAM = "#F4F1E8";

const TILE_COLS = 10;
const TILE_ROWS = 3;

function tiles() {
  const cellW = BANNER_SIZE.width / TILE_COLS;
  const cellH = BANNER_SIZE.height / TILE_ROWS;
  const out: React.ReactNode[] = [];
  for (let row = 0; row < TILE_ROWS; row += 1) {
    for (let col = -1; col <= TILE_COLS; col += 1) {
      const stagger = row % 2 === 1 ? cellW / 2 : 0;
      const faint = (row + col) % 2 === 0;
      out.push(
        <div
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            left: col * cellW + stagger,
            top: row * cellH - 10,
            width: cellW,
            height: cellH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Pirata One",
            fontSize: 92,
            color: GOLD,
            opacity: faint ? 0.07 : 0.12,
            transform: "rotate(-14deg)",
          }}
        >
          df
        </div>
      );
    }
  }
  return out;
}

export async function bookingBanner(kicker: string): Promise<ImageResponse> {
  /* Literal paths, so the deploy traces just these three files. */
  const [pirata, archivo, wordmark] = await Promise.all([
    readFile(join(process.cwd(), "src/lib/og/fonts/PirataOne-Regular.ttf")),
    readFile(join(process.cwd(), "src/lib/og/fonts/Archivo-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/df-wordmark.svg")),
  ]);
  const wordmarkSrc = `data:image/svg+xml;base64,${wordmark.toString("base64")}`;
  const long = kicker.length > 28;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: OLIVE,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {tiles()}
        <div
          style={{
            display: "flex",
            fontFamily: "Archivo",
            fontSize: long ? 38 : 48,
            letterSpacing: long ? 5 : 7,
            textTransform: "uppercase",
            color: CREAM,
            maxWidth: 1080,
            textAlign: "center",
            justifyContent: "center",
          }}
        >
          {kicker}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wordmarkSrc} alt="" width={620} height={126} style={{ marginTop: 14 }} />
      </div>
    ),
    {
      ...BANNER_SIZE,
      fonts: [
        { name: "Pirata One", data: pirata, weight: 400, style: "normal" },
        { name: "Archivo", data: archivo, weight: 600, style: "normal" },
      ],
    }
  );
}
