import { playerName } from '../lib/format'
import type { GroupSummary } from '../lib/stats'
import type { Player } from '../types'
import { Chip } from './ui'

export function groupLabel(players: readonly Player[], playerIds: readonly string[]): string {
  const names = playerIds.map((id) => playerName(players, id))
  if (names.length <= 2) return names.join(' & ')
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/**
 * Groups are ordered most-played first, so the pairing you play most sits at
 * the front and is selected by default.
 */
export function GroupChips({
  groups,
  players,
  value,
  onChange,
  allowAll = false,
}: {
  groups: readonly GroupSummary[]
  players: readonly Player[]
  value: string | null
  onChange: (key: string | null) => void
  allowAll?: boolean
}) {
  if (groups.length <= 1) return null

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <div className="flex w-max gap-2 pb-1">
        {allowAll ? (
          <Chip selected={value === null} onClick={() => onChange(null)}>
            All games
          </Chip>
        ) : null}
        {groups.map((group) => (
          <Chip
            key={group.key}
            selected={value === group.key}
            onClick={() => onChange(group.key)}
            className="whitespace-nowrap"
          >
            {groupLabel(players, group.playerIds)}
            <span className="text-xs opacity-60">{group.gameCount}</span>
          </Chip>
        ))}
      </div>
    </div>
  )
}
