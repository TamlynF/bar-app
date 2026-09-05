const FIREWORK_SPARKS = 10;
const FIREWORK_COLOURS = ["#FDCC4B", "#FF6B35", "#fff4cc", "#FDCC4B", "#E6392E"];

/* Ten sparks bursting outward from the centre of the parent, staggered so it
   reads as a firework. Parent must be `relative`. Purely decorative. */
export function Fireworks({ distance = 34 }: { distance?: number }) {
  return (
    <span
      className="ad-fireworks pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{ "--spark-d": `${distance}px` } as React.CSSProperties}
    >
      {Array.from({ length: FIREWORK_SPARKS }, (_, i) => (
        <span
          key={i}
          className="ad-spark absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full bg-(--spark-c)"
          style={
            {
              "--spark-a": `${(360 / FIREWORK_SPARKS) * i}deg`,
              "--spark-c": FIREWORK_COLOURS[i % FIREWORK_COLOURS.length],
              "--spark-i": i,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
