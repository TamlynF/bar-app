/**
 * After-dark marquee — a slow scrolling band of the bar's recurring nights,
 * echoing the lit signage over the bar. Decorative (aria-hidden); pauses for
 * users who prefer reduced motion (see .ad-marquee-track in globals.css).
 */
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
      className="relative my-10 sm:my-14 overflow-hidden border-y border-hairline bg-[#FDCC4B]/5 py-3.5"
    >
      <div className="ad-marquee-track">
        {[0, 1].map((row) => (
          <div className="flex" key={row}>
            {PHRASES.map((phrase, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-6 pr-6 whitespace-nowrap text-2xl sm:text-3xl font-black uppercase tracking-tight text-ink-2"
              >
                {phrase}
                <span className="text-[#FDCC4B] text-lg not-italic">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
