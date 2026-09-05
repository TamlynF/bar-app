export type MarqueeItem = {
  text: string;
  Icon?: React.ComponentType<{ className?: string }>;
};

const PHRASES: MarqueeItem[] = [
  { text: "Live Music" },
  { text: "Quiz Thursday" },
  { text: "DJ Sets" },
  { text: "Open Mic" },
  { text: "World Famous Karaoke" },
  { text: "Open until 2:00am on weekends" },
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

const LIVE_REPEATS = 6;

export function LiveTicker({
  items,
  label = "Live tonight",
}: {
  items: string[];
  label?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      role="status"
      aria-label={`${label}: ${items.join(", ")}`}
      className="relative z-30 flex h-9 items-stretch overflow-hidden border-y border-(--wordmark)/25 bg-(--canvas) text-(--wordmark) shadow-lg shadow-black/35 sm:h-10"
    >
      <span className="relative z-10 flex shrink-0 items-center gap-2 bg-(--burgundy) pr-3.5 pl-4 font-black text-xs tracking-[0.18em] text-(--ink) uppercase sm:pl-6 sm:text-sm">
        <span className="ad-live-dot h-2 w-2 rounded-full bg-(--neon) sm:h-2.5 sm:w-2.5" aria-hidden="true" />
        {label}
        <span
          aria-hidden="true"
          className="absolute top-0 -right-3 bottom-0 w-3 bg-(--burgundy) [clip-path:polygon(0_0,100%_0,0_100%)]"
        />
      </span>

      <div
        aria-hidden="true"
        className="ad-marquee-track items-center pl-6"
        style={{ "--marquee-duration": `${LIVE_REPEATS * 9}s` } as React.CSSProperties}
      >
        {Array.from({ length: LIVE_REPEATS * 2 }, (_, row) => (
          <div className="flex items-center" key={row}>
            {items.map((text, i) => (
              <span
                key={i}
                className={
                  "inline-flex items-center gap-3 pr-3 font-black text-sm leading-none tracking-wide whitespace-nowrap uppercase sm:text-base " +
                  (i === 0 ? "text-(--ink)" : "text-(--wordmark)")
                }
              >
                {text}
                <span className="text-[10px] text-(--wordmark)/45">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
