import type { Player } from '../types'

const dayFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const shortDayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

export function formatDate(ms: number): string {
  return dayFormat.format(new Date(ms))
}

export function formatShortDate(ms: number): string {
  return shortDayFormat.format(new Date(ms))
}

/** "today" / "yesterday" / a date — the label above a run of games. */
export function formatRelativeDay(ms: number, now: number): string {
  const startOf = (t: number) => {
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const days = Math.round((startOf(now) - startOf(ms)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(ms)
}

/** For an <input type="date"> value, in local time. */
export function toDateInputValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateInputValue(value: string, previous: number): number {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return previous
  const next = new Date(previous)
  next.setFullYear(y, m - 1, d)
  return next.getTime()
}

export function formatAverage(value: number): string {
  return value.toFixed(1)
}

export function formatDelta(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded).toFixed(1)}`
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

export function playerName(players: readonly Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? 'Unknown'
}

/**
 * Resolve display colours for a set of players. Each keeps its stored slot
 * where possible; clashes inside one view fall through to the next free slot.
 */
export function colorSlots(
  players: readonly Player[],
  ids: readonly string[],
): Record<string, number> {
  const used = new Set<number>()
  const out: Record<string, number> = {}
  for (const id of ids) {
    const preferred = players.find((p) => p.id === id)?.colorIndex ?? 0
    let slot = preferred
    let guard = 0
    while (used.has(slot) && guard < 8) {
      slot = (slot + 1) % 8
      guard += 1
    }
    used.add(slot)
    out[id] = slot
  }
  return out
}

/** CSS custom property for a categorical slot (0-indexed). */
export function seriesColor(slot: number): string {
  return `var(--series-${(slot % 8) + 1})`
}
