import { useMemo, useState } from 'react';
import type { GrowthWeek } from './types';

/**
 * Weekly new-organization signups — a single sequential series (magnitude over
 * time), so per the dataviz method: one hue (validated blue, step 400), no
 * legend box needed, bars ≤24px with a 4px rounded data-end, 2px surface gaps,
 * hairline gridlines, and a per-bar hover tooltip since this is the mark-is-
 * the-hit-target case (bars/cells), not a crosshair chart.
 */
export function GrowthChart({ weeks }: { weeks: GrowthWeek[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 640;
  const height = 200;
  const paddingLeft = 32;
  const paddingBottom = 24;
  const paddingTop = 12;
  const plotWidth = width - paddingLeft;
  const plotHeight = height - paddingBottom - paddingTop;

  const maxValue = useMemo(() => Math.max(1, ...weeks.map((w) => w.count)), [weeks]);
  // Round the axis ceiling up to a clean step (1, 2, 5, 10, 20, 50, 100…).
  const niceMax = useMemo(() => {
    const rough = maxValue;
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, rough)));
    const normalized = rough / magnitude;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
  }, [maxValue]);

  const barSlot = plotWidth / weeks.length;
  const barWidth = Math.min(24, barSlot - 4);
  const gap = 2;

  const yTicks = [0, niceMax / 2, niceMax];

  const formatWeek = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="New organizations per week">
        {/* Gridlines — hairline, recessive, one step off the surface. */}
        {yTicks.map((tick) => {
          const y = paddingTop + plotHeight - (tick / niceMax) * plotHeight;
          return (
            <g key={tick}>
              <line x1={paddingLeft} x2={width} y1={y} y2={y} stroke="#2c2c2a" strokeWidth={1} />
              <text x={0} y={y + 4} fontSize={10} fill="#898781">
                {Math.round(tick)}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={paddingLeft}
          x2={width}
          y1={paddingTop + plotHeight}
          y2={paddingTop + plotHeight}
          stroke="#383835"
          strokeWidth={1}
        />

        {weeks.map((w, i) => {
          const barHeight = niceMax > 0 ? (w.count / niceMax) * plotHeight : 0;
          const x = paddingLeft + i * barSlot + (barSlot - barWidth) / 2;
          const y = paddingTop + plotHeight - barHeight;
          const isHovered = hoverIndex === i;
          // Show a week label roughly every ~4 bars, plus always the last, so
          // labels never collide regardless of the range length.
          const showLabel = i === weeks.length - 1 || i % Math.ceil(weeks.length / 6) === 0;

          return (
            <g key={w.weekStart}>
              {/* Hit target — the full slot, taller than the bar so short/zero bars are still easy to hover. */}
              <rect
                x={paddingLeft + i * barSlot}
                y={paddingTop}
                width={barSlot}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
                tabIndex={0}
              />
              {w.count > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={Math.max(0, barWidth - gap)}
                  height={Math.max(0, barHeight)}
                  rx={4}
                  fill={isHovered ? '#5598e7' : '#3987e5'}
                  className="pointer-events-none transition-colors"
                />
              )}
              {showLabel && (
                <text x={x + barWidth / 2} y={height - 6} fontSize={10} fill="#898781" textAnchor="middle">
                  {formatWeek(w.weekStart)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hoverIndex !== null && weeks[hoverIndex] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-[#1a1a19] px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${((paddingLeft + hoverIndex * barSlot + barSlot / 2) / width) * 100}%`,
            top: `${(paddingTop / height) * 100}%`,
          }}
        >
          <p className="font-semibold text-white">{weeks[hoverIndex].count} organization{weeks[hoverIndex].count === 1 ? '' : 's'}</p>
          <p className="text-white/50">Week of {formatWeek(weeks[hoverIndex].weekStart)}</p>
        </div>
      )}
    </div>
  );
}
