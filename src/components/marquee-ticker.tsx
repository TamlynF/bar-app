const PHRASES = [
  "Live Music",
  "Thursday Quiz",
  "World-Famous Karaoke",
  "Music Bingo",
  "DJ Sets",
  "Last Orders Late",
];

export function MarqueeTicker() {
  return (
    <div
      aria-hidden="true"
      className="relative my-10 overflow-hidden border-y border-hairline bg-[#FDCC4B]/5 py-3.5 sm:my-14"
    >
      <div className="ad-marquee-track">
        {[0, 1].map((row) => (
          <div className="flex" key={row}>
            {PHRASES.map((phrase, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-6 pr-6 font-black text-2xl tracking-tight whitespace-nowrap text-ink-2 uppercase sm:text-3xl"
              >
                {phrase}
                <span className="text-lg text-[#FDCC4B] not-italic">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
