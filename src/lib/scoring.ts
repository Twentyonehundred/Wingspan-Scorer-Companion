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

/**
 * Seat `id` in the leading chair, trading places with whoever is in it. A swap
 * rather than a rotation: the rest of the list is where people are actually
 * sitting, so only the two involved should move — and it keeps the animation
 * honest about what happened.
 */
export function withFirstPlayer(playerIds: readonly string[], id: string): string[] {
  const at = playerIds.indexOf(id)
  if (at <= 0) return [...playerIds]
  const next = [...playerIds]
  next[at] = next[0]
  next[0] = id
  return next
}

/** Sorted-and-joined player ids: the stable identity of a playing group. */
export function groupKeyFor(playerIds: readonly string[]): string {
  return [...playerIds].sort().join('|')
}

export interface FirstPlayerTurn {
  /** Whose turn it is to start, or null when there is nothing to go on. */
  nextId: string | null
  /** Who started the most recent game this lineup played. */
  lastId: string | null
  lastPlayedAt: number | null
}

/**
 * Whose turn it is to go first. Turn order is worth a real advantage in
 * Wingspan, so a group that plays regularly passes the start around, and the
 * thing you actually want to know when setting up is who is owed it.
 *
 * That's whoever has gone longest without — never having started counts as
 * longest of all — read from games this exact lineup played. Exact, because a
 * group is the precise set of people who sat down everywhere else in the app,
 * and because a rotation between four people says nothing about a night when
 * two of them played alone.
 *
 * The answer is never the person who started last time, which is what makes it
 * a rotation: their turn is the most recent by definition.
 */
export function firstPlayerTurn(
  games: readonly Game[],
  playerIds: readonly string[],
): FirstPlayerTurn {
  const nothing: FirstPlayerTurn = { nextId: null, lastId: null, lastPlayedAt: null }
  if (playerIds.length < 2) return nothing

  // Games from before this was recorded can't answer the question, and saying
  // nothing beats guessing from them.
  const key = groupKeyFor(playerIds)
  const history = games
    .filter((g) => g.groupKey === key && g.firstPlayerId)
    .sort((a, b) => b.playedAt - a.playedAt)
  if (!history.length) return nothing

  const started = new Map<string, number>()
  for (const game of history) {
    if (!started.has(game.firstPlayerId!)) started.set(game.firstPlayerId!, game.playedAt)
  }

  // Lowest wins, and never-started is lower than any date. Only a strict
  // improvement displaces the incumbent, so ties fall to whoever the lineup
  // lists first and the answer doesn't wander between renders.
  const since = (id: string) => started.get(id) ?? -Infinity
  let nextId = playerIds[0]
  for (const id of playerIds) if (since(id) < since(nextId)) nextId = id

  return { nextId, lastId: history[0].firstPlayerId!, lastPlayedAt: history[0].playedAt }
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
