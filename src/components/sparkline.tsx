/* Tiny SVG price line for a market instrument. Pure, server-friendly. */
export function Sparkline({
  points,
  width = 240,
  height = 64,
  stroke = "#FDCC4B",
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (points.length < 2) {
    return <div className={className} style={{ width, height }} aria-hidden="true" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 4;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => [pad + i * step, pad + (1 - (p - min) / span) * (height - pad * 2)] as const);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} ${(pad + (points.length - 1) * step).toFixed(1)},${height} ${pad},${height}`;
  const last = coords[coords.length - 1];
  const id = `spark-${stroke.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} role="img" aria-label="Price over the session">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} />
      <circle cx={last[0]} cy={last[1]} r="7" fill={stroke} opacity="0.25" />
    </svg>
  );
}
