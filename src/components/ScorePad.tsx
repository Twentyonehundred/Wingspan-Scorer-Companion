import { colorSlots, playerName } from '../lib/format'
import { totalFor } from '../lib/scoring'
import type { CategoryDef, Player, ScoreLine } from '../types'
import { PlayerDot, ScoreField } from './ui'

/**
 * The pad itself: categories down, players across. Wide tables scroll
 * horizontally with the category column pinned.
 */
export function ScorePad({
  players,
  playerIds,
  categories,
  scores,
  onChange,
}: {
  players: readonly Player[]
  playerIds: readonly string[]
  categories: readonly CategoryDef[]
  scores: Record<string, ScoreLine>
  onChange: (playerId: string, category: CategoryDef['key'], raw: string) => void
}) {
  const slots = colorSlots(players, playerIds)
  // Sized so three players still fit a phone without scrolling; four or five
  // overflow and the category column stays pinned.
  const columns = `minmax(78px, 1.3fr) repeat(${playerIds.length}, minmax(62px, 1fr))`

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-full items-center gap-x-1.5 gap-y-2"
        style={{ gridTemplateColumns: columns }}
      >
        <div className="sticky left-0 z-10 bg-surface" />
        {playerIds.map((id) => (
          <div key={id} className="flex flex-col items-center gap-1 pb-1">
            <PlayerDot slot={slots[id]} />
            <p className="w-full truncate text-center text-sm font-bold" title={playerName(players, id)}>
              {playerName(players, id)}
            </p>
          </div>
        ))}

        {categories.map((category, index) => (
          <Row
            key={category.key}
            category={category}
            playerIds={playerIds}
            players={players}
            scores={scores}
            onChange={onChange}
            autoFocusFirst={index === 0}
          />
        ))}

        <div className="sticky left-0 z-10 mt-1 bg-surface">
          <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Total</p>
        </div>
        {playerIds.map((id) => (
          <p key={id} className="mt-1 text-center text-3xl font-bold tabular-nums">
            {totalFor(scores[id], categories)}
          </p>
        ))}
      </div>
    </div>
  )
}

function Row({
  category,
  players,
  playerIds,
  scores,
  onChange,
  autoFocusFirst,
}: {
  category: CategoryDef
  players: readonly Player[]
  playerIds: readonly string[]
  scores: Record<string, ScoreLine>
  onChange: (playerId: string, category: CategoryDef['key'], raw: string) => void
  autoFocusFirst?: boolean
}) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-surface pr-2">
        <p className="text-sm leading-tight font-semibold">{category.label}</p>
        <p className="text-[11px] leading-tight text-muted">{category.hint}</p>
      </div>
      {playerIds.map((id, i) => {
        const value = scores[id]?.[category.key]
        return (
          <ScoreField
            key={id}
            value={value == null ? '' : String(value)}
            onChange={(raw) => onChange(id, category.key, raw)}
            ariaLabel={`${category.label} for ${playerName(players, id)}`}
            autoFocus={autoFocusFirst && i === 0}
          />
        )
      })}
    </>
  )
}
