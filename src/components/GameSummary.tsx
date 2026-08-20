import { colorSlots, playerName } from '../lib/format'
import { categoriesFor, isUnresolvedTie, standingsFor } from '../lib/scoring'
import type { Game, Player } from '../types'
import { Button, FirstPlayerMark, PlayerDot } from './ui'

/** Final standings plus the full pad, used after saving and in history. */
export function GameSummary({
  game,
  players,
  onResolveTie,
}: {
  game: Game
  players: readonly Player[]
  onResolveTie?: (playerId: string) => void
}) {
  const standings = standingsFor(game)
  const categories = categoriesFor(game.modules)
  const slots = colorSlots(players, game.playerIds)
  const tie = isUnresolvedTie(game)
  const tied = standings.filter((s) => s.place === 1)

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-2">
        {standings.map((s) => (
          <li
            key={s.playerId}
            className={
              'flex items-center gap-3 rounded-2xl px-4 py-3 ' +
              (s.isWinner ? 'bg-ink text-plane' : 'bg-surface-2')
            }
          >
            <span
              className={
                'w-5 text-sm font-bold tabular-nums ' + (s.isWinner ? 'text-plane/60' : 'text-muted')
              }
            >
              {s.place}
            </span>
            <PlayerDot slot={slots[s.playerId]} size={12} />
            <span className="min-w-0 flex-1 truncate text-lg font-bold">
              {playerName(players, s.playerId)}
            </span>
            {game.firstPlayerId === s.playerId ? (
              <>
                <FirstPlayerMark active inverse={s.isWinner} size={15} />
                <span className="sr-only">Went first</span>
              </>
            ) : null}
            {s.isWinner ? (
              <span className="text-xs font-bold tracking-[0.14em] text-plane/70 uppercase">Won</span>
            ) : null}
            <span className="text-2xl font-bold tabular-nums">{s.total}</span>
          </li>
        ))}
      </ol>

      {tie ? (
        <div className="rounded-2xl bg-surface-2 px-4 py-4">
          <p className="text-base font-bold">Tied on points</p>
          <p className="mt-1 text-sm text-ink-2">
            The tiebreak is most unused food tokens, which never reaches the pad. Who had more?
          </p>
          {onResolveTie ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {tied.map((s) => (
                <Button
                  key={s.playerId}
                  variant="primary"
                  size="sm"
                  onClick={() => onResolveTie(s.playerId)}
                >
                  {playerName(players, s.playerId)}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-bold tracking-[0.14em] text-muted uppercase">Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-full text-sm">
            <thead>
              <tr>
                <th className="py-2 text-left font-semibold text-muted">Category</th>
                {game.playerIds.map((id) => (
                  <th key={id} className="py-2 pl-3 text-right font-semibold text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <PlayerDot slot={slots[id]} size={8} />
                      <span className="max-w-20 truncate">{playerName(players, id)}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.key} className="border-t border-hairline">
                  <td className="py-2 pr-3 text-ink-2">{c.label}</td>
                  {game.playerIds.map((id) => (
                    <td key={id} className="py-2 pl-3 text-right font-semibold tabular-nums">
                      {game.scores[id]?.[c.key] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
