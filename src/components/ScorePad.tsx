import { useLayoutEffect, useRef } from 'react'
import { colorSlots, playerName } from '../lib/format'
import { totalFor } from '../lib/scoring'
import type { CategoryDef, Player, ScoreLine } from '../types'
import { FirstPlayerButton, FirstPlayerMark, PlayerDot, ScoreField } from './ui'

const SWAP_MS = 340

/**
 * A column is not one element — its cells are spread through a single flat grid
 * — so a reorder is animated by hand. React has already moved every cell by the
 * time this runs, so each one is put straight back where it was with a
 * transform and then released on the next frame.
 */
function useColumnSwap(order: readonly string[]) {
  const ref = useRef<HTMLDivElement>(null)
  const previous = useRef<readonly string[] | null>(null)

  useLayoutEffect(() => {
    const root = ref.current
    const before = previous.current
    previous.current = order
    if (!root || !before) return
    // Only a reshuffle animates. Adding or removing a player is a different
    // change and sliding the survivors sideways would misdescribe it.
    if (before.length !== order.length || !order.every((id) => before.includes(id))) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const cells = new Map<string, HTMLElement[]>()
    for (const el of root.querySelectorAll<HTMLElement>('[data-col]')) {
      const id = el.dataset.col
      if (!id) continue
      const found = cells.get(id)
      if (found) found.push(el)
      else cells.set(id, [el])
    }

    // Whoever now sits at a player's old index is standing exactly where that
    // player was, so the distance to travel needs no memory of the old layout —
    // which keeps it right after a resize or a change of player count.
    const lefts = order.map((id) => cells.get(id)?.[0]?.offsetLeft ?? 0)
    const moving = order
      .map((id, to) => ({ els: cells.get(id) ?? [], dx: lefts[before.indexOf(id)] - lefts[to] }))
      .filter((m) => m.dx !== 0 && m.els.length > 0)
    if (!moving.length) return

    for (const { els, dx } of moving) {
      for (const el of els) {
        el.style.transition = 'none'
        el.style.transform = `translateX(${dx}px)`
      }
    }
    const frame = requestAnimationFrame(() => {
      for (const { els } of moving) {
        for (const el of els) {
          el.style.transition = `transform ${SWAP_MS}ms cubic-bezier(0.2, 0.85, 0.25, 1)`
          el.style.transform = ''
        }
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [order])

  return ref
}

/**
 * The pad itself: categories down, players across, in seating order with the
 * first player on the left. Wide tables scroll horizontally with the category
 * column pinned.
 */
export function ScorePad({
  players,
  playerIds,
  categories,
  scores,
  onChange,
  firstPlayerId,
  onFirstPlayer,
}: {
  players: readonly Player[]
  playerIds: readonly string[]
  categories: readonly CategoryDef[]
  scores: Record<string, ScoreLine>
  onChange: (playerId: string, category: CategoryDef['key'], raw: string) => void
  firstPlayerId?: string | null
  /** Omit to show who went first without offering to change it. */
  onFirstPlayer?: (playerId: string) => void
}) {
  const slots = colorSlots(players, playerIds)
  const gridRef = useColumnSwap(playerIds)
  // A cell is − / box / +, so it can't go below about 96px. Two players fit a
  // phone comfortably; three or more overflow and scroll with the category
  // column pinned.
  const columns = `minmax(70px, 1.1fr) repeat(${playerIds.length}, minmax(96px, 1fr))`

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div
          ref={gridRef}
          className="grid min-w-full items-center gap-x-1.5 gap-y-2"
          style={{ gridTemplateColumns: columns }}
        >
          <div className="sticky left-0 z-10 bg-surface" />
          {playerIds.map((id) => (
            <div key={id} data-col={id} className="flex flex-col items-center gap-1 pb-1">
              <PlayerDot slot={slots[id]} />
              <p
                className="w-full truncate text-center text-sm font-bold"
                title={playerName(players, id)}
              >
                {playerName(players, id)}
              </p>
              {onFirstPlayer ? (
                <FirstPlayerButton
                  active={firstPlayerId === id}
                  name={playerName(players, id)}
                  onSelect={() => onFirstPlayer(id)}
                />
              ) : firstPlayerId === id ? (
                <span className="grid h-8 place-items-center">
                  <FirstPlayerMark active />
                  <span className="sr-only">Went first</span>
                </span>
              ) : null}
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
            <p
              key={id}
              data-col={id}
              className="mt-1 text-center text-3xl font-bold tabular-nums"
            >
              {totalFor(scores[id], categories)}
            </p>
          ))}
        </div>
      </div>

      {onFirstPlayer ? (
        <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
          {firstPlayerId ? (
            <>
              <FirstPlayerMark active size={14} />
              {playerName(players, firstPlayerId)} went first
            </>
          ) : (
            <>
              Tap <FirstPlayerMark size={14} /> to mark who went first
            </>
          )}
        </p>
      ) : null}
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
          <div key={id} data-col={id}>
            <ScoreField
              value={value == null ? '' : String(value)}
              onChange={(raw) => onChange(id, category.key, raw)}
              ariaLabel={`${category.label} for ${playerName(players, id)}`}
              autoFocus={autoFocusFirst && i === 0}
            />
          </div>
        )
      })}
    </>
  )
}
