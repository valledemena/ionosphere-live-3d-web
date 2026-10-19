"use client";

/** Sparkline SVG reutilizable */
export default function Sparkline({
  data,
  width = 120,
  height = 30,
  color = "#22d3ee",
  fill = true,
  min,
  max,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  min?: number;
  max?: number;
}) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const span = hi - lo || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((v - lo) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && (
        <polygon
          points={`0,${height} ${pts.join(" ")} ${width},${height}`}
          fill={color}
          opacity={0.12}
        />
      )}
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  );
}
