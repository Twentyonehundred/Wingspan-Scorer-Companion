import { useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  PlayerDot,
  SectionTitle,
  Sheet,
  Toggle,
} from '../components/ui'
import { profileFor, useStore } from '../data/store'
import { colorSlots } from '../lib/format'
import type { ThemePref } from '../lib/theme'
import type { Player } from '../types'

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
    accounts,
    sharedFrom,
    shareWith,
    stopSharing,
    renamePlayer,
    deletePlayer,
    gamesForPlayer,
  } = useStore()
  const profile = profileFor(user)
  const slots = colorSlots(players, players.map((p) => p.id))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null)

  const pendingGames = pendingDelete ? gamesForPlayer(pendingDelete.id).length : 0

  // Everyone who has signed in, most recent first, minus yourself. Present only
  // for the app owner — for anyone else `accounts` is null and the section
  // below never renders.
  const others = accounts
    ?.filter((a) => a.uid !== user?.uid)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  // Your own list of who's been let in. This is the fact that grants access, so
  // it's what the switch reflects; pointing them at your games is the separate,
  // second half, and worth saying when only one of the two has happened.
  const sharedWith = accounts?.find((a) => a.uid === user?.uid)?.sharedWith ?? []

  const gameCount = (playerId: string) => gamesForPlayer(playerId).length

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
                <div className="flex items-center gap-3">
                  <Avatar
                    signedIn
                    photoURL={profile.photoURL}
                    name={profile.name ?? profile.email}
                    size={44}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {profile.name ?? 'Signed in'}
                    </p>
                    <p className="truncate text-sm text-ink-2">{profile.email ?? 'Synced'}</p>
                  </div>
                </div>
                {sharedFrom ? (
                  <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
                    You're scoring in{' '}
                    <span className="font-semibold text-ink">
                      {sharedFrom.name ?? sharedFrom.email ?? 'someone else'}
                    </span>
                    's games. Anything either of you logs shows up for you both.
                  </p>
                ) : null}
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

        {others ? (
          <section>
            <SectionTitle>People</SectionTitle>
            <p className="mb-2 text-sm text-ink-2">
              Everyone who has signed in. Share your games with someone and you both keep one
              history — whatever either of you scores, you both see.
            </p>
            {others.length ? (
              <Card className="divide-y divide-hairline">
                {others.map((person) => {
                  const shared = sharedWith.includes(person.uid)
                  const looking = person.workspaceId === user?.uid
                  const name = person.name ?? person.email ?? 'Signed-in account'
                  return (
                    <Toggle
                      key={person.uid}
                      checked={shared}
                      onChange={(next) =>
                        void (next ? shareWith(person.uid) : stopSharing(person.uid))
                      }
                      label={
                        <span className="flex items-center gap-3">
                          <Avatar signedIn photoURL={person.photoURL} name={name} size={32} />
                          <span className="min-w-0">
                            <span className="block truncate">{name}</span>
                            {person.email && person.email !== name ? (
                              <span className="block truncate text-sm font-normal text-ink-2">
                                {person.email}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      }
                      hint={
                        !shared
                          ? undefined
                          : looking
                            ? 'Scoring into your games. Their own history is kept, just hidden until you turn this off.'
                            : 'Let in, but still using their own games. Turn this off and on again to point them at yours.'
                      }
                    />
                  )
                })}
              </Card>
            ) : (
              <p className="text-sm text-ink-2">Nobody else has signed in yet.</p>
            )}
          </section>
        ) : null}

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
                      aria-label={`Delete ${player.name}`}
                      onClick={() => setPendingDelete(player)}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? 'player'}?`}
        body={
          pendingGames > 0 ? (
            <p>
              This also deletes the {pendingGames} game{pendingGames === 1 ? '' : 's'} they played
              in, because a game's scores and stats only mean anything with everyone who sat down.
              It can't be undone.
            </p>
          ) : (
            <p>They haven't played any games, so nothing else is affected.</p>
          )
        }
        confirmLabel={pendingGames > 0 ? `Delete player and ${pendingGames} game${pendingGames === 1 ? '' : 's'}` : 'Delete player'}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deletePlayer(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </Sheet>
  )
}
