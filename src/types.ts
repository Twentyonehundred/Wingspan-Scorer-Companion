export type ModuleKey = 'nectar' | 'duet'

export type CategoryKey =
  | 'birds'
  | 'bonus'
  | 'goals'
  | 'eggs'
  | 'food'
  | 'tucked'
  | ModuleKey

export interface CategoryDef {
  key: CategoryKey
  label: string
  hint: string
  /** Present only for categories that a scoring module switches on. */
  module?: ModuleKey
}

/**
 * The base score pad, in the order it is printed. Expansions are additive —
 * European/Asia/Oceania birds all shuffle into one deck — and only two of them
 * change scoring, so the pad is the base six plus whichever modules are on.
 */
export const CATEGORY_DEFS: readonly CategoryDef[] = [
  { key: 'birds', label: 'Birds', hint: 'Points on bird cards' },
  { key: 'bonus', label: 'Bonus cards', hint: 'Completed bonus cards' },
  { key: 'goals', label: 'Round goals', hint: 'End-of-round goals' },
  { key: 'eggs', label: 'Eggs', hint: '1 point each' },
  { key: 'food', label: 'Food', hint: 'Food on cards' },
  { key: 'tucked', label: 'Tucked', hint: 'Cards tucked under birds' },
  { key: 'nectar', label: 'Nectar', hint: 'Habitat majorities', module: 'nectar' },
  { key: 'duet', label: 'Duet map', hint: 'Duet map scoring', module: 'duet' },
]

export interface ModuleDef {
  key: ModuleKey
  label: string
  source: string
  blurb: string
  /** Duet mode is strictly two-player. */
  maxPlayers?: number
}

export const MODULE_DEFS: readonly ModuleDef[] = [
  {
    key: 'nectar',
    label: 'Nectar',
    source: 'Oceania',
    blurb: 'Most and second-most nectar spent in each habitat.',
  },
  {
    key: 'duet',
    label: 'Duet map',
    source: 'Asia',
    blurb: 'Adds a duet map line to the pad.',
    maxPlayers: 2,
  },
]

export const MIN_PLAYERS = 1
export const MAX_PLAYERS = 5

export interface Player {
  id: string
  name: string
  createdAt: number
  /**
   * Fixed categorical slot (0-7). Stored rather than derived so a player keeps
   * the same colour everywhere — colour follows the person, never their rank.
   */
  colorIndex?: number
}

export type ScoreLine = Partial<Record<CategoryKey, number>>

export interface Game {
  id: string
  /** Epoch ms. Set when the game is saved, editable afterwards. */
  playedAt: number
  modules: ModuleKey[]
  playerIds: string[]
  /** Sorted player ids joined with '|' — the identity of the group that played. */
  groupKey: string
  scores: Record<string, ScoreLine>
  /**
   * Only set when the totals tie and the official tiebreak (most unused food
   * tokens) was resolved by hand.
   */
  winnerId?: string | null
  /**
   * Who took the first turn. Turn order matters in Wingspan and the printed pad
   * has nowhere to record it, so it is kept here and the UI seats this player in
   * the leftmost column. Left undefined on games saved before it existed —
   * defaulting to `playerIds[0]` would invent an answer for those.
   */
  firstPlayerId?: string | null
}

/** A game in progress, held locally so a refresh mid-scoring loses nothing. */
export interface Draft {
  modules: ModuleKey[]
  playerIds: string[]
  scores: Record<string, ScoreLine>
  firstPlayerId?: string | null
}
