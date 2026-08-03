/** Weight over time. Inline SVG polyline — no chart library, see CLAUDE.md. */
export function Sparkline({
  values,
  width = 96,
  height = 26,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(' ');

  const lastX = width;
  const lastY = height - (((values.at(-1) as number) - min) / span) * (height - 4) - 2;

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent/70"
      />
      <circle cx={lastX} cy={lastY} r={2.5} className="fill-accent" />
    </svg>
  );
}
