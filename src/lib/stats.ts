import { CATEGORY_DEFS, type CategoryDef, type CategoryKey, type Game } from '../types'
import { categoriesFor, gameTotals, standingsFor } from './scoring'

export interface GroupSummary {
  key: string
  playerIds: string[]
  gameCount: number
  lastPlayedAt: number
}

/**
 * A "group" is simply the exact set of players who sat down together, so the
 * two-player history stays clean when a third person joins for a night.
 */
export function summariseGroups(games: readonly Game[]): GroupSummary[] {
  const byKey = new Map<string, GroupSummary>()
  for (const game of games) {
    const existing = byKey.get(game.groupKey)
    if (existing) {
      existing.gameCount += 1
      existing.lastPlayedAt = Math.max(existing.lastPlayedAt, game.playedAt)
    } else {
      byKey.set(game.groupKey, {
        key: game.groupKey,
        playerIds: [...game.playerIds].sort(),
        gameCount: 1,
        lastPlayedAt: game.playedAt,
      })
    }
  }
  // Most-played first, then most-recent — so the usual pairing leads.
  return [...byKey.values()].sort(
    (a, b) => b.gameCount - a.gameCount || b.lastPlayedAt - a.lastPlayedAt,
  )
}

export interface PlayerStats {
  playerId: string
  games: number
  wins: number
  /** Games that ended level at the top and were never resolved. */
  unresolvedTies: number
  winRate: number
  avgTotal: number
  bestTotal: number
  /** Mean score in a category, over the games where that category was in play. */
  avgByCategory: Partial<Record<CategoryKey, number>>
  gamesByCategory: Partial<Record<CategoryKey, number>>
}

export interface TrendPoint {
  gameId: string
  playedAt: number
  totals: Record<string, number>
}

export interface GroupStats {
  key: string
  playerIds: string[]
  games: Game[]
  /** Every category that appeared in at least one of the group's games. */
  categories: CategoryDef[]
  players: PlayerStats[]
  /** The table average for each category — the baseline an edge is measured against. */
  tableAverage: Partial<Record<CategoryKey, number>>
  trend: TrendPoint[]
}

export function statsForGroup(allGames: readonly Game[], groupKey: string): GroupStats | null {
  const games = allGames
    .filter((g) => g.groupKey === groupKey)
    .sort((a, b) => a.playedAt - b.playedAt)
  if (!games.length) return null

  const playerIds = [...games[0].playerIds].sort()

  const inPlay = new Set<CategoryKey>()
  for (const game of games) for (const c of categoriesFor(game.modules)) inPlay.add(c.key)
  const categories = CATEGORY_DEFS.filter((c) => inPlay.has(c.key))

  const totalsSum: Record<string, number> = {}
  const best: Record<string, number> = {}
  const wins: Record<string, number> = {}
  const ties: Record<string, number> = {}
  const catSum: Record<string, Partial<Record<CategoryKey, number>>> = {}
  const catCount: Record<string, Partial<Record<CategoryKey, number>>> = {}
  const trend: TrendPoint[] = []

  for (const id of playerIds) {
    totalsSum[id] = 0
    best[id] = 0
    wins[id] = 0
    ties[id] = 0
    catSum[id] = {}
    catCount[id] = {}
  }

  for (const game of games) {
    const totals = gameTotals(game)
    const standings = standingsFor(game)
    const gameCategories = categoriesFor(game.modules)
    const topPlace = standings.filter((s) => s.place === 1)

    for (const id of playerIds) {
      const total = totals[id] ?? 0
      totalsSum[id] += total
      best[id] = Math.max(best[id], total)

      for (const c of gameCategories) {
        catSum[id][c.key] = (catSum[id][c.key] ?? 0) + (game.scores[id]?.[c.key] ?? 0)
        catCount[id][c.key] = (catCount[id][c.key] ?? 0) + 1
      }
    }

    for (const s of standings) {
      if (s.isWinner) wins[s.playerId] += 1
      else if (s.place === 1 && topPlace.length > 1) ties[s.playerId] += 1
    }

    trend.push({ gameId: game.id, playedAt: game.playedAt, totals })
  }

  const players: PlayerStats[] = playerIds.map((id) => ({
    playerId: id,
    games: games.length,
    wins: wins[id],
    unresolvedTies: ties[id],
    winRate: games.length ? wins[id] / games.length : 0,
    avgTotal: games.length ? totalsSum[id] / games.length : 0,
    bestTotal: best[id],
    avgByCategory: Object.fromEntries(
      categories
        .map((c) => [c.key, divide(catSum[id][c.key], catCount[id][c.key])] as const)
        .filter(([, v]) => v !== null),
    ) as Partial<Record<CategoryKey, number>>,
    gamesByCategory: Object.fromEntries(
      categories.map((c) => [c.key, catCount[id][c.key] ?? 0] as const),
    ) as Partial<Record<CategoryKey, number>>,
  }))

  const tableAverage: Partial<Record<CategoryKey, number>> = {}
  for (const c of categories) {
    const values = players.map((p) => p.avgByCategory[c.key]).filter(isNumber)
    if (values.length) tableAverage[c.key] = values.reduce((a, b) => a + b, 0) / values.length
  }

  return { key: groupKey, playerIds, games, categories, players, tableAverage, trend }
}

export interface CategoryEdge {
  category: CategoryKey
  avg: number
  /** Points above (+) or below (−) the table average for this category. */
  delta: number
}

/** A player's categories ranked from strongest to weakest relative to the table. */
export function edgesFor(stats: GroupStats, playerId: string): CategoryEdge[] {
  const player = stats.players.find((p) => p.playerId === playerId)
  if (!player) return []
  return stats.categories
    .map((c) => {
      const avg = player.avgByCategory[c.key]
      const baseline = stats.tableAverage[c.key]
      if (!isNumber(avg) || !isNumber(baseline)) return null
      return { category: c.key, avg, delta: avg - baseline }
    })
    .filter((e): e is CategoryEdge => e !== null)
    .sort((a, b) => b.delta - a.delta)
}

function divide(sum: number | undefined, count: number | undefined): number | null {
  if (!count) return null
  return (sum ?? 0) / count
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
