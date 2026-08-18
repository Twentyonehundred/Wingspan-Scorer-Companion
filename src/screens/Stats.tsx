import { useMemo, useState } from 'react'
import { CategoryBars, Legend, ScoreTrend, StatTile, type CategoryBarRow } from '../components/charts'
import { GroupChips, groupLabel } from '../components/GroupChips'
import { Card, Empty, PlayerDot, SectionTitle } from '../components/ui'
import { useStore } from '../data/store'
import {
  colorSlots,
  formatAverage,
  formatDelta,
  formatPercent,
  formatShortDate,
  playerName,
} from '../lib/format'
import { CATEGORY_LABELS, isUnresolvedTie } from '../lib/scoring'
import { edgesFor, statsForGroup, summariseGroups } from '../lib/stats'

export function Stats() {
  const { players, games, ready } = useStore()
  const groups = useMemo(() => summariseGroups(games), [games])
  const [chosen, setChosen] = useState<string | null>(null)

  const groupKey = chosen ?? groups[0]?.key ?? null
  const stats = useMemo(
    () => (groupKey ? statsForGroup(games, groupKey) : null),
    [games, groupKey],
  )

  if (!stats) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-bold">Stats</h1>
        <Empty
          title={ready ? 'Nothing to chart yet' : 'Loading…'}
          body={
            ready
              ? 'Save a game or two and this fills up with averages, records and trends.'
              : 'Fetching your games.'
          }
        />
      </div>
    )
  }

  // Display order follows names, not the opaque id sort used for the group key.
  const ordered = [...stats.players].sort((a, b) =>
    playerName(players, a.playerId).localeCompare(playerName(players, b.playerId)),
  )
  const slots = colorSlots(players, stats.playerIds)
  const legend = ordered.map((p) => ({
    id: p.playerId,
    label: playerName(players, p.playerId),
    slot: slots[p.playerId],
  }))

  const headToHead = ordered.length === 2
  const unresolved = stats.games.filter(isUnresolvedTie).length

  const barRows: CategoryBarRow[] = stats.categories.map((category) => ({
    key: category.key,
    label: category.label,
    hint:
      ordered[0]?.gamesByCategory[category.key] !== stats.games.length
        ? `${ordered[0]?.gamesByCategory[category.key] ?? 0} of ${stats.games.length} games`
        : undefined,
    bars: ordered.map((p) => ({
      id: p.playerId,
      label: playerName(players, p.playerId),
      slot: slots[p.playerId],
      value: p.avgByCategory[category.key] ?? 0,
      delta: (p.avgByCategory[category.key] ?? 0) - (stats.tableAverage[category.key] ?? 0),
    })),
  }))

  const trendSeries = ordered.map((p) => ({
    id: p.playerId,
    label: playerName(players, p.playerId),
    slot: slots[p.playerId],
    values: stats.trend.map((t) => t.totals[p.playerId] ?? null),
  }))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold">Stats</h1>
        <p className="mt-1 text-ink-2">
          {groupLabel(players, stats.playerIds)} · {stats.games.length} game
          {stats.games.length === 1 ? '' : 's'}
        </p>
      </header>

      <GroupChips groups={groups} players={players} value={groupKey} onChange={setChosen} />

      {/* Hero: the headline number for the view. */}
      <Card className="px-5 py-6 text-center">
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
          {headToHead ? 'Head to head' : 'Wins'}
        </p>
        <p className="mt-2 text-6xl leading-none font-bold">
          {ordered.map((p) => p.wins).join(' – ')}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {ordered.map((p) => (
            <span key={p.playerId} className="flex items-center gap-2 text-sm font-semibold text-ink-2">
              <PlayerDot slot={slots[p.playerId]} />
              {playerName(players, p.playerId)}
            </span>
          ))}
        </div>
        {unresolved > 0 ? (
          <p className="mt-3 text-sm text-muted">
            {unresolved} unresolved {unresolved === 1 ? 'tie' : 'ties'} — open the game in History to
            settle it.
          </p>
        ) : null}
      </Card>

      <section>
        <SectionTitle>Per player</SectionTitle>
        <div className="flex flex-col gap-3">
          {ordered.map((p) => (
            <Card key={p.playerId} className="px-4 py-4">
              <p className="mb-3 flex items-center gap-2 text-base font-bold">
                <PlayerDot slot={slots[p.playerId]} size={12} />
                {playerName(players, p.playerId)}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Wins" value={p.wins} sub={formatPercent(p.winRate)} />
                <StatTile label="Average" value={formatAverage(p.avgTotal)} sub="points" />
                <StatTile label="Best" value={p.bestTotal} sub="points" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {ordered.length > 1 ? (
        <section>
          <SectionTitle>Strengths</SectionTitle>
          <div className="flex flex-col gap-3">
            {ordered.map((p) => {
              const edges = edgesFor(stats, p.playerId)
              const best = edges[0]
              const worst = edges[edges.length - 1]
              if (!best || !worst || best.category === worst.category) return null
              return (
                <Card key={p.playerId} className="px-4 py-4">
                  <p className="mb-2 flex items-center gap-2 text-base font-bold">
                    <PlayerDot slot={slots[p.playerId]} size={12} />
                    {playerName(players, p.playerId)}
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted">Strongest</dt>
                      <dd className="mt-0.5 font-bold">{CATEGORY_LABELS[best.category]}</dd>
                      <dd className={deltaTone(best.delta)}>{formatDelta(best.delta)} vs table</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Weakest</dt>
                      <dd className="mt-0.5 font-bold">{CATEGORY_LABELS[worst.category]}</dd>
                      <dd className={deltaTone(worst.delta)}>{formatDelta(worst.delta)} vs table</dd>
                    </div>
                  </dl>
                </Card>
              )
            })}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle>Average points per category</SectionTitle>
        <Card className="px-4 py-5">
          <div className="mb-4">
            <Legend items={legend} />
          </div>
          <CategoryBars rows={barRows} />
          <NumbersTable
            columns={legend}
            rows={stats.categories.map((c) => ({
              key: c.key,
              label: c.label,
              values: ordered.map((p) => formatAverage(p.avgByCategory[c.key] ?? 0)),
            }))}
          />
        </Card>
      </section>

      <section>
        <SectionTitle>Score over time</SectionTitle>
        <Card className="px-4 py-5">
          <div className="mb-3">
            <Legend items={legend} />
          </div>
          <ScoreTrend
            series={trendSeries}
            labels={stats.trend.map((t) => formatShortDate(t.playedAt))}
          />
          <NumbersTable
            columns={legend}
            rows={stats.trend.map((t, i) => ({
              key: t.gameId,
              label: `${i + 1}. ${formatShortDate(t.playedAt)}`,
              values: ordered.map((p) => String(t.totals[p.playerId] ?? '—')),
            }))}
          />
        </Card>
      </section>
    </div>
  )
}

/** A player can sit below the table average in every category, so colour by sign. */
function deltaTone(delta: number): string {
  const base = 'tabular-nums '
  if (Math.abs(delta) < 0.05) return base + 'text-muted'
  return base + (delta > 0 ? 'text-good' : 'text-critical')
}

/** The table view every chart falls back to. */
function NumbersTable({
  columns,
  rows,
}: {
  columns: { id: string; label: string; slot: number }[]
  rows: { key: string; label: string; values: string[] }[]
}) {
  return (
    <details className="mt-5 border-t border-hairline pt-3">
      <summary className="cursor-pointer text-xs font-bold tracking-[0.14em] text-muted uppercase">
        Show numbers
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="py-1.5 text-left font-semibold text-muted"> </th>
              {columns.map((c) => (
                <th key={c.id} className="py-1.5 pl-3 text-right font-semibold text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <PlayerDot slot={c.slot} size={8} />
                    <span className="max-w-20 truncate">{c.label}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-hairline">
                <td className="py-1.5 pr-3 text-ink-2">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={columns[i]?.id ?? i} className="py-1.5 pl-3 text-right font-semibold tabular-nums">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
