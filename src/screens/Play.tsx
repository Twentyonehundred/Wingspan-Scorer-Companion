import { useMemo, useState } from 'react'
import { GameSummary } from '../components/GameSummary'
import { PlayerPicker } from '../components/PlayerPicker'
import { ScorePad } from '../components/ScorePad'
import { Button, Card, PlayerDot, SectionTitle, Toggle } from '../components/ui'
import { useStore, newId } from '../data/store'
import { colorSlots, playerName } from '../lib/format'
import {
  categoriesFor,
  groupKeyFor,
  modulesForPlayerCount,
  standingsFor,
  withFirstPlayer,
} from '../lib/scoring'
import {
  MAX_PLAYERS,
  MODULE_DEFS,
  type CategoryKey,
  type Game,
  type ModuleKey,
  type ScoreLine,
} from '../types'

const stickyBottom = { bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom))' }

export function Play({ onGoToHistory }: { onGoToHistory: () => void }) {
  const { games, draft, setDraft, saveGame } = useStore()
  const [savedGameId, setSavedGameId] = useState<string | null>(null)

  const savedGame = games.find((g) => g.id === savedGameId)

  if (savedGame) {
    return (
      <Results
        game={savedGame}
        onNewGame={() => setSavedGameId(null)}
        onGoToHistory={() => {
          setSavedGameId(null)
          onGoToHistory()
        }}
      />
    )
  }

  if (draft) {
    return (
      <Entry
        onDiscard={() => setDraft(null)}
        onSave={async () => {
          const game: Game = {
            id: newId(),
            playedAt: Date.now(),
            modules: draft.modules,
            playerIds: draft.playerIds,
            groupKey: groupKeyFor(draft.playerIds),
            scores: draft.scores,
            winnerId: null,
            firstPlayerId: draft.firstPlayerId ?? null,
          }
          await saveGame(game)
          setDraft(null)
          setSavedGameId(game.id)
        }}
      />
    )
  }

  return <Setup />
}

/* -------------------------------------------------------------------------- */
/* Step 1 — which game, and who is playing                                     */
/* -------------------------------------------------------------------------- */

interface SetupState {
  modules: ModuleKey[]
  playerIds: string[]
}

function Setup() {
  const { players, games, prefs, setDraft, saveSetup } = useStore()
  const [edited, setEdited] = useState<SetupState | null>(null)
  const [picking, setPicking] = useState(false)

  /**
   * Open on the lineup you last played — the usual pairing is then one tap
   * away. The saved preference leads because it survives deleting that game;
   * the last game is the fallback for accounts from before it existed. Either
   * way the ids are filtered against players who still exist.
   */
  const lastGame = games[0]
  const seed = useMemo<SetupState>(() => {
    const known = new Set(players.map((p) => p.id))
    const remembered = (prefs?.lastPlayerIds ?? []).filter((id) => known.has(id))
    if (remembered.length) return { modules: prefs?.lastModules ?? [], playerIds: remembered }
    return {
      modules: lastGame?.modules ?? [],
      playerIds: (lastGame?.playerIds ?? []).filter((id) => known.has(id)),
    }
  }, [prefs, lastGame, players])
  const state = edited ?? seed

  const available = modulesForPlayerCount(state.modules, state.playerIds.length)
  const slots = colorSlots(players, state.playerIds)

  const update = (next: Partial<SetupState>) => {
    const merged = { ...state, ...next }
    setEdited({ ...merged, modules: modulesForPlayerCount(merged.modules, merged.playerIds.length) })
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold">New game</h1>
        <p className="mt-1 text-ink-2">Switch on whatever changes the score pad.</p>
      </header>

      <section>
        <SectionTitle>Score pad</SectionTitle>
        <Card className="divide-y divide-hairline">
          <div className="px-5 py-4">
            <p className="text-base font-semibold">Base game</p>
            <p className="mt-0.5 text-sm text-ink-2">
              Birds, bonus cards, round goals, eggs, food, tucked. Always on.
            </p>
          </div>
          {MODULE_DEFS.map((module) => {
            const blocked = Boolean(module.maxPlayers && state.playerIds.length > module.maxPlayers)
            return (
              <Toggle
                key={module.key}
                checked={available.includes(module.key)}
                disabled={blocked}
                disabledReason={`${module.maxPlayers} players only`}
                label={
                  <>
                    {module.label}{' '}
                    <span className="text-sm font-medium text-muted">{module.source}</span>
                  </>
                }
                hint={module.blurb}
                onChange={(next) =>
                  update({
                    modules: next
                      ? [...state.modules, module.key]
                      : state.modules.filter((m) => m !== module.key),
                  })
                }
              />
            )
          })}
        </Card>
      </section>

      <section>
        <SectionTitle>
          Players
          <span className="ml-2 font-normal normal-case tracking-normal">
            {state.playerIds.length} of {MAX_PLAYERS}
          </span>
        </SectionTitle>
        <Card className="divide-y divide-hairline">
          {state.playerIds.map((id) => (
            <div key={id} className="flex items-center gap-3 px-5 py-3.5">
              <PlayerDot slot={slots[id]} size={12} />
              <span className="min-w-0 flex-1 truncate text-base font-semibold">
                {playerName(players, id)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${playerName(players, id)}`}
                onClick={() => update({ playerIds: state.playerIds.filter((p) => p !== id) })}
              >
                Remove
              </Button>
            </div>
          ))}
          <div className="px-5 py-3.5">
            <Button
              variant="secondary"
              onClick={() => setPicking(true)}
              disabled={state.playerIds.length >= MAX_PLAYERS}
              className="w-full"
            >
              Add player
            </Button>
          </div>
        </Card>
      </section>

      <div className="sticky z-20 pb-2" style={stickyBottom}>
        <Button
          variant="primary"
          size="lg"
          className="w-full shadow-lg"
          disabled={state.playerIds.length === 0}
          onClick={() => {
            // Remember the lineup at the moment it's chosen, not on save, so a
            // discarded game still updates who you normally play with.
            void saveSetup({ lastModules: available, lastPlayerIds: state.playerIds })
            setDraft({ modules: available, playerIds: state.playerIds, scores: {} })
          }}
        >
          Start scoring
        </Button>
      </div>

      <PlayerPicker
        open={picking}
        onClose={() => setPicking(false)}
        exclude={state.playerIds}
        onPick={(player) => update({ playerIds: [...state.playerIds, player.id] })}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 2 — the pad                                                            */
/* -------------------------------------------------------------------------- */

function Entry({ onDiscard, onSave }: { onDiscard: () => void; onSave: () => Promise<void> }) {
  const { players, draft, setDraft } = useStore()
  const [saving, setSaving] = useState(false)
  if (!draft) return null

  const categories = categoriesFor(draft.modules)

  const change = (playerId: string, category: CategoryKey, raw: string) => {
    const line: ScoreLine = { ...draft.scores[playerId] }
    if (raw === '') delete line[category]
    else line[category] = Number(raw)
    setDraft({ ...draft, scores: { ...draft.scores, [playerId]: line } })
  }

  // Handing over the first-player token also moves that player to the leading
  // column, so the pad reads left to right in turn order.
  const setFirst = (playerId: string) =>
    setDraft({
      ...draft,
      firstPlayerId: playerId,
      playerIds: withFirstPlayer(draft.playerIds, playerId),
    })

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Scoring</h1>
          <p className="mt-1 text-ink-2">
            {draft.modules.length
              ? `Base + ${draft.modules
                  .map((m) => MODULE_DEFS.find((d) => d.key === m)?.label ?? m)
                  .join(' + ')}`
              : 'Base game'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
      </header>

      <Card className="px-4 py-4">
        <ScorePad
          players={players}
          playerIds={draft.playerIds}
          categories={categories}
          scores={draft.scores}
          onChange={change}
          firstPlayerId={draft.firstPlayerId}
          onFirstPlayer={setFirst}
        />
      </Card>

      <div className="sticky z-20 pb-2" style={stickyBottom}>
        <Button
          variant="primary"
          size="lg"
          className="w-full shadow-lg"
          disabled={saving}
          onClick={() => {
            setSaving(true)
            void onSave().finally(() => setSaving(false))
          }}
        >
          {saving ? 'Saving…' : 'Save game'}
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 3 — result                                                             */
/* -------------------------------------------------------------------------- */

function Results({
  game,
  onNewGame,
  onGoToHistory,
}: {
  game: Game
  onNewGame: () => void
  onGoToHistory: () => void
}) {
  const { players, saveGame } = useStore()
  const winner = standingsFor(game).find((s) => s.isWinner)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
          {winner ? 'Winner' : 'Final scores'}
        </p>
        <h1 className="mt-1 text-4xl leading-tight font-bold">
          {winner ? playerName(players, winner.playerId) : 'Too close to call'}
        </h1>
      </header>

      <GameSummary
        game={game}
        players={players}
        onResolveTie={(playerId) => void saveGame({ ...game, winnerId: playerId })}
      />

      <div className="flex gap-3">
        <Button variant="primary" size="lg" className="flex-1" onClick={onNewGame}>
          New game
        </Button>
        <Button variant="secondary" size="lg" onClick={onGoToHistory}>
          History
        </Button>
      </div>
    </div>
  )
}
