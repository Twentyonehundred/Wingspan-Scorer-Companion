import { useState } from 'react'
import { useStore } from '../data/store'
import { colorSlots } from '../lib/format'
import type { Player } from '../types'
import { Button, ConfirmDialog, PlayerDot, Sheet } from './ui'

/** Pick a regular, or type a name to start tracking someone new. */
export function PlayerPicker({
  open,
  onClose,
  exclude,
  onPick,
}: {
  open: boolean
  onClose: () => void
  exclude: readonly string[]
  onPick: (player: Player) => void
}) {
  const { players, addPlayer, deletePlayer, gamesForPlayer } = useStore()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null)

  const available = players.filter((p) => !exclude.includes(p.id))
  const slots = colorSlots(players, players.map((p) => p.id))
  const trimmed = name.trim()
  const duplicate = players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())

  const create = async () => {
    if (!trimmed || duplicate || busy) return
    setBusy(true)
    try {
      onPick(await addPlayer(trimmed))
      setName('')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a player">
      {available.length > 0 ? (
        <ul className="mb-5 flex flex-col gap-1">
          {available.map((player) => {
            const played = gamesForPlayer(player.id).length
            return (
              <li key={player.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onPick(player)
                    onClose()
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
                >
                  <PlayerDot slot={slots[player.id]} size={12} />
                  <span className="min-w-0 flex-1 truncate text-base font-semibold">
                    {player.name}
                  </span>
                </button>
                {/* Only offer removal while there is nothing to lose. Anyone with
                    games shows the count instead, so the missing button reads as
                    a reason rather than an omission. */}
                {played === 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${player.name}`}
                    onClick={() => setPendingDelete(player)}
                  >
                    Delete
                  </Button>
                ) : (
                  <span className="shrink-0 px-3 text-sm text-muted">
                    {played} game{played === 1 ? '' : 's'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <label htmlFor="new-player" className="mb-2 block text-xs font-bold tracking-[0.14em] text-muted uppercase">
          Someone new
        </label>
        <div className="flex gap-2">
          <input
            id="new-player"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <Button type="submit" variant="primary" disabled={!trimmed || duplicate || busy}>
            Add
          </Button>
        </div>
        {duplicate ? (
          <p className="mt-2 text-sm text-ink-2">{trimmed} is already in the list above.</p>
        ) : null}
      </form>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? 'player'}?`}
        body={<p>They haven't played any games, so nothing else is affected.</p>}
        confirmLabel="Delete player"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deletePlayer(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </Sheet>
  )
}
