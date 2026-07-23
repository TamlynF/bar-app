export type MarqueeItem = {
  text: string;
  Icon?: React.ComponentType<{ className?: string }>;
};

const PHRASES: MarqueeItem[] = [
  { text: "Live Music" },
  { text: "Thursday Quiz" },
  { text: "World-Famous Karaoke" },
  { text: "Music Bingo" },
  { text: "DJ Sets" },
  { text: "Last Orders Late" },
];

const REPEATS_PER_HALF = 4;

export function MarqueeTicker({
  items,
  straight = false,
}: {
  items?: MarqueeItem[];
  straight?: boolean;
}) {
  const entries = items?.length ? items : PHRASES;

  return (
    <>
      {items?.length ? (
        <ul className="sr-only">
          {items.map((item, i) => (
            <li key={i}>{item.text}</li>
          ))}
        </ul>
      ) : null}

      <div
        aria-hidden="true"
        className={
          "relative overflow-hidden bg-[#FDCC4B] py-1.5 shadow-md shadow-black/25 " +
          (straight ? "w-full" : "-mx-[6%] w-[112%] -rotate-[1.5deg]")
        }
      >
        <div
          className="ad-marquee-track"
          style={
            { "--marquee-duration": `${REPEATS_PER_HALF * 30}s` } as React.CSSProperties
          }
        >
          {Array.from({ length: REPEATS_PER_HALF * 2 }, (_, row) => (
            <div className="flex" key={row}>
              {entries.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2.5 pr-4 font-black text-base leading-none tracking-tight whitespace-nowrap text-[#1a2008] uppercase sm:text-lg"
                >
                  {item.Icon && <item.Icon className="h-4 w-4 shrink-0" />}
                  {item.text}
                  <span className="ml-1.5 text-xs text-[#1a2008]/45 not-italic">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
