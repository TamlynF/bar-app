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
      className="relative -mx-[6%] w-[112%] -rotate-[1.5deg] overflow-hidden bg-[#FDCC4B] py-2.5 shadow-lg shadow-black/30"
    >
      <div className="ad-marquee-track">
        {[0, 1].map((row) => (
          <div className="flex" key={row}>
            {PHRASES.map((phrase, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-6 pr-6 font-black text-2xl tracking-tight whitespace-nowrap text-[#1a2008] uppercase sm:text-3xl"
              >
                {phrase}
                <span className="text-lg text-[#1a2008]/45 not-italic">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
