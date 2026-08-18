import { useState } from 'react'
import { Button, Card, Chip, PlayerDot, SectionTitle, Sheet } from '../components/ui'
import { useStore } from '../data/store'
import { colorSlots } from '../lib/format'
import type { ThemePref } from '../lib/theme'

const THEMES: { key: ThemePref; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]

export function Settings({
  open,
  onClose,
  theme,
  onTheme,
}: {
  open: boolean
  onClose: () => void
  theme: ThemePref
  onTheme: (next: ThemePref) => void
}) {
  const {
    players,
    games,
    authStatus,
    user,
    cloudEnabled,
    authError,
    signIn,
    signOutToSandbox,
    renamePlayer,
    deletePlayer,
  } = useStore()
  const slots = colorSlots(players, players.map((p) => p.id))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const gameCount = (playerId: string) =>
    games.filter((g) => g.playerIds.includes(playerId)).length

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ players, games }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wingspan-scores.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="flex flex-col gap-6">
        <section>
          <SectionTitle>Appearance</SectionTitle>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <Chip key={t.key} selected={theme === t.key} onClick={() => onTheme(t.key)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Sync</SectionTitle>
          <Card className="px-4 py-4">
            {!cloudEnabled ? (
              <p className="text-sm text-ink-2">
                No Firebase project is configured, so games are saved in this browser only.
              </p>
            ) : authStatus === 'signed-in' ? (
              <>
                <p className="text-sm text-ink-2">
                  Synced as <span className="font-semibold text-ink">{user?.email ?? 'your account'}</span>.
                </p>
                <Button variant="secondary" className="mt-3 w-full" onClick={() => void signOutToSandbox()}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-2">
                  Games are saved to this device. Sign in to keep them and see the same history
                  everywhere.
                </p>
                <Button variant="primary" className="mt-3 w-full" onClick={() => void signIn()}>
                  Sign in with Google
                </Button>
              </>
            )}
            {authError ? <p className="mt-3 text-sm text-critical">{authError}</p> : null}
          </Card>
        </section>

        <section>
          <SectionTitle>Players</SectionTitle>
          {players.length ? (
            <Card className="divide-y divide-hairline">
              {players.map((player) => {
                const played = gameCount(player.id)
                const editing = editingId === player.id
                return (
                  <div key={player.id} className="flex items-center gap-3 px-4 py-3">
                    <PlayerDot slot={slots[player.id]} size={12} />
                    {editing ? (
                      <input
                        value={draftName}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={() => {
                          if (draftName.trim()) void renamePlayer(player.id, draftName)
                          setEditingId(null)
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="h-9 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 font-semibold focus:outline-none focus:ring-2 focus:ring-ink"
                      />
                    ) : (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left font-semibold"
                        onClick={() => {
                          setEditingId(player.id)
                          setDraftName(player.name)
                        }}
                      >
                        {player.name}
                        <span className="ml-2 text-sm font-normal text-muted">
                          {played} game{played === 1 ? '' : 's'}
                        </span>
                      </button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={played > 0}
                      title={played > 0 ? 'Played games — delete those first' : undefined}
                      onClick={() => void deletePlayer(player.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )
              })}
            </Card>
          ) : (
            <p className="text-sm text-ink-2">No players yet.</p>
          )}
        </section>

        <section>
          <SectionTitle>Data</SectionTitle>
          <Button variant="secondary" className="w-full" onClick={exportJson}>
            Export as JSON
          </Button>
        </section>
      </div>
    </Sheet>
  )
}
