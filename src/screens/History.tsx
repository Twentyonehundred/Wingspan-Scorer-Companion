import { useMemo, useState } from 'react'
import { GameSummary } from '../components/GameSummary'
import { GroupChips, groupLabel } from '../components/GroupChips'
import { ScorePad } from '../components/ScorePad'
import {
  Button,
  Card,
  ConfirmDialog,
  Empty,
  FirstPlayerMark,
  PlayerDot,
  Sheet,
  dismissSheet,
} from '../components/ui'
import { useStore } from '../data/store'
import {
  colorSlots,
  formatDate,
  formatRelativeDay,
  fromDateInputValue,
  playerName,
  toDateInputValue,
} from '../lib/format'
import { categoriesFor, standingsFor, withFirstPlayer } from '../lib/scoring'
import { summariseGroups } from '../lib/stats'
import { MODULE_DEFS, type CategoryKey, type Game, type ScoreLine } from '../types'

export function History() {
  const { players, games, ready } = useStore()
  const groups = useMemo(() => summariseGroups(games), [games])
  const [group, setGroup] = useState<string | null | undefined>(undefined)
  const [openId, setOpenId] = useState<string | null>(null)

  // `undefined` means "not chosen yet" so the default can follow the data in.
  const selected = group === undefined ? (groups[0]?.key ?? null) : group
  const visible = selected ? games.filter((g) => g.groupKey === selected) : games
  const open = games.find((g) => g.id === openId) ?? null

  const days = useMemo(() => {
    const now = Date.now()
    const out: { label: string; games: Game[] }[] = []
    for (const game of visible) {
      const label = formatRelativeDay(game.playedAt, now)
      const last = out[out.length - 1]
      if (last && last.label === label) last.games.push(game)
      else out.push({ label, games: [game] })
    }
    return out
  }, [visible])

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-bold">History</h1>
        <p className="mt-1 text-ink-2">
          {selected
            ? `${visible.length} game${visible.length === 1 ? '' : 's'} · ${groupLabel(
                players,
                groups.find((g) => g.key === selected)?.playerIds ?? [],
              )}`
            : `${visible.length} game${visible.length === 1 ? '' : 's'}`}
        </p>
      </header>

      <GroupChips
        groups={groups}
        players={players}
        value={selected}
        onChange={setGroup}
        allowAll
      />

      {!games.length ? (
        <Empty
          title={ready ? 'No games yet' : 'Loading…'}
          body={ready ? 'Score a game and it will show up here.' : 'Fetching your games.'}
        />
      ) : (
        days.map((day) => (
          <section key={day.label}>
            <h2 className="mb-2 text-xs font-bold tracking-[0.14em] text-muted uppercase">
              {day.label}
            </h2>
            <ul className="flex flex-col gap-2">
              {day.games.map((game) => (
                <GameRow key={game.id} game={game} onOpen={() => setOpenId(game.id)} />
              ))}
            </ul>
          </section>
        ))
      )}

      <GameSheet game={open} onClose={() => setOpenId(null)} />
    </div>
  )
}

function GameRow({ game, onOpen }: { game: Game; onOpen: () => void }) {
  const { players } = useStore()
  const standings = standingsFor(game)
  const slots = colorSlots(players, game.playerIds)
  const badges = game.modules
    .map((m) => MODULE_DEFS.find((d) => d.key === m)?.label)
    .filter(Boolean) as string[]

  return (
    <Card as="li">
      <button type="button" onClick={onOpen} className="w-full px-4 py-3 text-left">
        {badges.length ? (
          <p className="mb-2 text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
            {badges.join(' · ')}
          </p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {standings.map((s) => (
            <li key={s.playerId} className="flex items-center gap-2.5">
              <PlayerDot slot={slots[s.playerId]} />
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  className={
                    'min-w-0 truncate ' + (s.isWinner ? 'font-bold' : 'font-medium text-ink-2')
                  }
                >
                  {playerName(players, s.playerId)}
                </span>
                {/* Who went first is the thing you come back days later to check. */}
                {game.firstPlayerId === s.playerId ? (
                  <>
                    <FirstPlayerMark active size={14} />
                    <span className="sr-only">went first</span>
                  </>
                ) : null}
              </span>
              <span className={'tabular-nums ' + (s.isWinner ? 'text-xl font-bold' : 'text-lg font-semibold text-ink-2')}>
                {s.total}
              </span>
            </li>
          ))}
        </ul>
      </button>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function GameSheet({ game, onClose }: { game: Game | null; onClose: () => void }) {
  const { players, saveGame, deleteGame } = useStore()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const close = () => {
    setEditing(false)
    setConfirmDelete(false)
    onClose()
  }

  if (!game) return null

  const categories = categoriesFor(game.modules)
  const standings = standingsFor(game)

  const change = (playerId: string, category: CategoryKey, raw: string) => {
    const line: ScoreLine = { ...game.scores[playerId] }
    if (raw === '') delete line[category]
    else line[category] = Number(raw)
    void saveGame({ ...game, scores: { ...game.scores, [playerId]: line } })
  }

  return (
    <Sheet open onClose={close} title={editing ? 'Edit scores' : 'Game'}>
      <div className="flex flex-col gap-5">
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Played</span>
          <input
            type="date"
            value={toDateInputValue(game.playedAt)}
            onChange={(e) =>
              void saveGame({ ...game, playedAt: fromDateInputValue(e.target.value, game.playedAt) })
            }
            className="h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </label>

        {editing ? (
          <ScorePad
            players={players}
            playerIds={game.playerIds}
            categories={categories}
            scores={game.scores}
            onChange={change}
            firstPlayerId={game.firstPlayerId}
            onFirstPlayer={(id) =>
              void saveGame({
                ...game,
                firstPlayerId: id,
                playerIds: withFirstPlayer(game.playerIds, id),
              })
            }
          />
        ) : (
          <GameSummary
            game={game}
            players={players}
            onResolveTie={(playerId) => void saveGame({ ...game, winnerId: playerId })}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setEditing((v) => !v)} className="flex-1">
            {editing ? 'Done editing' : 'Edit scores'}
          </Button>
          {game.winnerId ? (
            <Button variant="secondary" onClick={() => void saveGame({ ...game, winnerId: null })}>
              Clear tiebreak
            </Button>
          ) : null}
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this game?"
        body={
          <>
            <p>
              {formatDate(game.playedAt)} · {standings.map((s) => `${playerName(players, s.playerId)} ${s.total}`).join(' · ')}
            </p>
            <p className="mt-2">This removes it from history and stats. It can't be undone.</p>
          </>
        }
        confirmLabel="Delete game"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteGame(game.id)
          setConfirmDelete(false)
          dismissSheet(close)
        }}
      />
    </Sheet>
  )
}
