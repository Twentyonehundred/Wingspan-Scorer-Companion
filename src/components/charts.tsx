import { useEffect, useRef, useState, type ReactNode } from 'react'
import { seriesColor } from '../lib/format'
import { PlayerDot } from './ui'

/* -------------------------------------------------------------------------- */
/* Stat tile                                                                   */
/* -------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'neutral' | 'good'
}) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p
        className={
          'mt-1 text-3xl leading-none font-bold ' + (tone === 'good' ? 'text-good' : 'text-ink')
        }
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-ink-2">{sub}</p> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Legend                                                                      */
/* -------------------------------------------------------------------------- */

export function Legend({
  items,
}: {
  items: { id: string; label: string; slot: number }[]
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 text-sm font-medium text-ink-2">
          <PlayerDot slot={item.slot} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* Category bars                                                               */
/* -------------------------------------------------------------------------- */

export interface CategoryBarRow {
  key: string
  label: string
  hint?: string
  bars: { id: string; label: string; slot: number; value: number; delta: number }[]
}

/**
 * One block per scoring category, one bar per player, on a single shared scale
 * so the size of each pot stays honest across categories. Every bar carries a
 * visible value — three of the light-mode hues sit under 3:1 on the surface, so
 * the labels are the relief, not a nicety.
 */
export function CategoryBars({ rows }: { rows: CategoryBarRow[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.bars.map((b) => b.value)))

  return (
    <div className="flex flex-col gap-5">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-bold">{row.label}</h3>
            {row.hint ? <p className="text-xs text-muted">{row.hint}</p> : null}
          </div>
          <div className="flex flex-col gap-[2px]">
            {row.bars.map((bar) => (
              <div key={bar.id} className="flex items-center gap-3">
                <div className="h-4 min-w-0 flex-1">
                  <div
                    className="h-full rounded-r"
                    style={{
                      width: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 1.5 : 0)}%`,
                      background: seriesColor(bar.slot),
                    }}
                  />
                </div>
                <p className="w-32 shrink-0 text-right text-sm tabular-nums text-ink-2">
                  <span className="font-bold text-ink">{bar.value.toFixed(1)}</span>
                  <span className="ml-2 text-muted">{bar.label}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Score trend                                                                 */
/* -------------------------------------------------------------------------- */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(max - min, 1)
  const rawStep = span / count
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? magnitude * 10
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let t = start; t <= max + step / 2; t += step) ticks.push(Math.round(t))
  return ticks
}

export interface TrendSeries {
  id: string
  label: string
  slot: number
  values: (number | null)[]
}

/** Total score per game, oldest to newest, with a crosshair read-out. */
export function ScoreTrend({
  series,
  labels,
}: {
  series: TrendSeries[]
  labels: string[]
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const height = 200
  const pad = { top: 14, right: 16, bottom: 26, left: 34 }
  const plotW = Math.max(width - pad.left - pad.right, 10)
  const plotH = height - pad.top - pad.bottom

  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null)
  // A line encodes position, not length, so the axis is free to skip the empty
  // 0-60 band that every Wingspan score sits above. Tick labels say so.
  const rawMin = all.length ? Math.min(...all) : 0
  const rawMax = all.length ? Math.max(...all) : 1
  const breathing = Math.max((rawMax - rawMin) * 0.15, 2)
  const dataMin = Math.max(0, rawMin - breathing)
  const dataMax = rawMax + breathing
  const ticks = niceTicks(dataMin, dataMax)
  const yMin = Math.min(ticks[0], dataMin)
  const yMax = Math.max(ticks[ticks.length - 1], dataMax)

  const n = labels.length
  const x = (i: number) => (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => plotH - ((v - yMin) / Math.max(yMax - yMin, 1)) * plotH

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = e.clientX - rect.left - pad.left
    if (n <= 1) return setActive(0)
    setActive(Math.max(0, Math.min(n - 1, Math.round((rel / plotW) * (n - 1)))))
  }

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Total score per game, oldest to newest"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setActive(null)}
          className="touch-pan-y"
        >
          <g transform={`translate(${pad.left} ${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
                <text
                  x={-8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted text-[10px] tabular-nums"
                >
                  {t}
                </text>
              </g>
            ))}

            {active != null ? (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={0}
                y2={plotH}
                stroke="var(--axis)"
                strokeWidth={1}
              />
            ) : null}

            {series.map((s) => {
              const points = s.values
                .map((v, i) => (v == null ? null : ([x(i), y(v)] as const)))
                .filter((p): p is readonly [number, number] => p !== null)
              if (!points.length) return null
              const d = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ')
              const last = points[points.length - 1]
              return (
                <g key={s.id}>
                  {points.length > 1 ? (
                    <path
                      d={d}
                      fill="none"
                      stroke={seriesColor(s.slot)}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  <circle
                    cx={last[0]}
                    cy={last[1]}
                    r={4.5}
                    fill={seriesColor(s.slot)}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                  {active != null && s.values[active] != null ? (
                    <circle
                      cx={x(active)}
                      cy={y(s.values[active])}
                      r={5.5}
                      fill={seriesColor(s.slot)}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                  ) : null}
                </g>
              )
            })}

            <line x1={0} x2={plotW} y1={plotH} y2={plotH} stroke="var(--axis)" strokeWidth={1} />
            <text x={0} y={plotH + 17} className="fill-muted text-[10px]">
              {labels[0]}
            </text>
            {n > 1 ? (
              <text x={plotW} y={plotH + 17} textAnchor="end" className="fill-muted text-[10px]">
                {labels[n - 1]}
              </text>
            ) : null}
          </g>
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      {active != null ? (
        <div
          className="pointer-events-none absolute top-0 rounded-xl bg-surface-2 px-3 py-2 text-xs shadow-lg ring-1 ring-hairline"
          style={{
            left: Math.min(Math.max(pad.left + x(active) - 60, 0), Math.max(width - 132, 0)),
            width: 132,
          }}
        >
          <p className="mb-1 font-semibold text-ink-2">{labels[active]}</p>
          {series.map((s) => (
            <p key={s.id} className="flex items-center gap-2">
              <PlayerDot slot={s.slot} size={8} />
              <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
              <span className="font-bold tabular-nums text-ink">{s.values[active] ?? '—'}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
