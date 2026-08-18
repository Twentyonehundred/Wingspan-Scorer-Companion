import {
  CATEGORY_DEFS,
  MODULE_DEFS,
  type CategoryDef,
  type CategoryKey,
  type Game,
  type ModuleKey,
  type ScoreLine,
} from '../types'

/** The pad for a given set of modules: the base six plus whatever is switched on. */
export function categoriesFor(modules: readonly ModuleKey[]): CategoryDef[] {
  return CATEGORY_DEFS.filter((c) => !c.module || modules.includes(c.module))
}

export function totalFor(line: ScoreLine | undefined, categories: readonly CategoryDef[]): number {
  if (!line) return 0
  let sum = 0
  for (const c of categories) sum += line[c.key] ?? 0
  return sum
}

export function gameTotals(game: Game): Record<string, number> {
  const categories = categoriesFor(game.modules)
  const totals: Record<string, number> = {}
  for (const id of game.playerIds) totals[id] = totalFor(game.scores[id], categories)
  return totals
}

export interface Standing {
  playerId: string
  total: number
  /** 1-indexed; tied players share a place. */
  place: number
  isWinner: boolean
}

/**
 * Wingspan's official tiebreak is most unused food tokens, which never reaches
 * the score pad — so a tie stays a tie until it is resolved by hand and stored
 * as `winnerId`.
 */
export function standingsFor(game: Game): Standing[] {
  const totals = gameTotals(game)
  const ordered = [...game.playerIds].sort((a, b) => totals[b] - totals[a])

  const top = ordered.length ? totals[ordered[0]] : 0
  const tiedAtTop = ordered.filter((id) => totals[id] === top)
  const decided = game.winnerId ?? (tiedAtTop.length === 1 ? tiedAtTop[0] : null)

  let place = 0
  let seen = 0
  let lastTotal: number | null = null
  return ordered.map((id) => {
    seen += 1
    if (totals[id] !== lastTotal) {
      place = seen
      lastTotal = totals[id]
    }
    return {
      playerId: id,
      total: totals[id],
      place,
      isWinner: decided === id,
    }
  })
}

/** True when the top score is shared and nobody has been named the winner yet. */
export function isUnresolvedTie(game: Game): boolean {
  if (game.winnerId) return false
  const totals = gameTotals(game)
  const values = game.playerIds.map((id) => totals[id])
  const top = Math.max(...values, 0)
  return values.filter((v) => v === top).length > 1
}

/** Sorted-and-joined player ids: the stable identity of a playing group. */
export function groupKeyFor(playerIds: readonly string[]): string {
  return [...playerIds].sort().join('|')
}

export function modulesForPlayerCount(
  modules: readonly ModuleKey[],
  playerCount: number,
): ModuleKey[] {
  return modules.filter((key) => {
    const def = MODULE_DEFS.find((m) => m.key === key)
    return !def?.maxPlayers || playerCount <= def.maxPlayers
  })
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.key, c.label]),
) as Record<CategoryKey, string>
