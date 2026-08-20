import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react'
import { seriesColor } from '../lib/format'

/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold ' +
  'transition-[transform,opacity] active:scale-[0.98] disabled:opacity-40 ' +
  'disabled:pointer-events-none select-none'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-plane',
  secondary: 'bg-surface-2 text-ink',
  ghost: 'text-ink-2 hover:text-ink',
  danger: 'bg-surface-2 text-critical',
}

const buttonSizes = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-12 px-5 text-base',
  lg: 'h-14 px-6 text-lg',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ComponentPropsWithRef<'button'> & {
  variant?: ButtonVariant
  size?: keyof typeof buttonSizes
}) {
  return (
    <button
      type="button"
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className = '',
  as: As = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'li'
}) {
  return (
    <As className={`rounded-card bg-surface ring-1 ring-hairline ${className}`}>{children}</As>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-bold tracking-[0.14em] text-muted uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Card className="px-6 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-ink-2">{body}</p>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

/** The coloured dot that carries a player's identity next to their name. */
export function PlayerDot({ slot, size = 10 }: { slot: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: seriesColor(slot) }}
    />
  )
}

/**
 * The first-player token. Filled when it's this player's, a dashed outline when
 * it's the offer to become one — the outline is what makes the control findable
 * before anyone has been marked, and it reads as an empty seat rather than a
 * disabled control.
 *
 * `inverse` is for the winner's row in the standings, which is `bg-ink`.
 */
export function FirstPlayerMark({
  active,
  inverse,
  size = 16,
}: {
  active?: boolean
  inverse?: boolean
  size?: number
}) {
  const tone = active
    ? inverse
      ? 'bg-plane text-ink'
      : 'bg-ink text-plane'
    : inverse
      ? 'border border-dashed border-plane/45 text-plane/70'
      : 'border border-dashed border-axis text-muted'

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold ${tone}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62), lineHeight: 1 }}
    >
      1
    </span>
  )
}

/** The same token, as the control that hands it to someone. */
export function FirstPlayerButton({
  active,
  name,
  onSelect,
}: {
  active: boolean
  name: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${name} went first` : `Mark ${name} as going first`}
      title={active ? `${name} went first` : `${name} went first?`}
      // Already-first is a no-op rather than disabled, so the token stays at
      // full strength and keeps announcing who holds it.
      onClick={() => !active && onSelect()}
      className={
        'grid h-8 w-8 place-items-center rounded-full transition-colors ' +
        'active:bg-hairline focus-visible:outline-2 focus-visible:outline-offset-1 ' +
        'focus-visible:outline-ink'
      }
    >
      <FirstPlayerMark active={active} />
    </button>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ' +
        'transition-colors active:scale-[0.98] ' +
        (selected ? 'bg-ink text-plane' : 'bg-surface-2 text-ink-2') +
        ` ${className}`
      }
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */

function initialsFor(name?: string | null): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return ''
  // An email falls back to its first letter; a display name gives two.
  if (trimmed.includes('@')) return trimmed[0].toUpperCase()
  const parts = trimmed.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''))
    .toUpperCase()
}

/**
 * The account button's face: the Google profile photo when signed in, initials
 * when that account has no photo, and a person glyph while the session is still
 * anonymous — so being signed in is visible without opening Settings.
 */
export function Avatar({
  signedIn,
  photoURL,
  name,
  size = 40,
}: {
  signedIn: boolean
  photoURL?: string | null
  name?: string | null
  size?: number
}) {
  // Google's lh3 URLs 403 intermittently; fall back rather than show a gap.
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [photoURL])

  const initials = signedIn ? initialsFor(name) : ''

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-ink-2 ring-1 ring-hairline"
      style={{ width: size, height: size }}
    >
      {signedIn && photoURL && !broken ? (
        <img
          src={photoURL}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : initials ? (
        <span className="font-bold text-ink" style={{ fontSize: size * 0.36 }}>
          {initials}
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={size * 0.5}
          height={size * 0.5}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      )}
    </span>
  )
}

/* -------------------------------------------------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
  disabledReason,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
  disabledReason?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 px-5 py-4 text-left disabled:opacity-45"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{label}</span>
        {(disabled && disabledReason ? disabledReason : hint) ? (
          <span className="mt-0.5 block text-sm text-ink-2">
            {disabled && disabledReason ? disabledReason : hint}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={
          'relative h-8 w-14 shrink-0 rounded-full transition-colors ' +
          (checked ? 'bg-ink' : 'bg-surface-2 ring-1 ring-hairline')
        }
      >
        <span
          className={
            'absolute top-1 h-6 w-6 rounded-full transition-[left] ' +
            (checked ? 'left-7 bg-plane' : 'left-1 bg-muted')
          }
        />
      </span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */

const SCORE_MAX = 999

/**
 * Numeric score field. Kept as a string so the box can be genuinely empty
 * rather than showing a 0 you have to clear before typing.
 *
 * Most Wingspan categories are counted in ones, so the − / + on either side do
 * the work on a phone and the keyboard is for the occasional big bird total.
 * The box itself is narrow to pay for them; three digits still fit because the
 * columns stretch to fill whatever width is going.
 */
export function ScoreField({
  value,
  onChange,
  ariaLabel,
  autoFocus,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  autoFocus?: boolean
}) {
  const current = value === '' ? 0 : Number(value)
  const nudge = (by: number) => {
    const next = Math.min(SCORE_MAX, Math.max(0, current + by))
    onChange(String(next))
  }

  return (
    <div className="flex items-stretch gap-0.5">
      <Stepper
        label={`Subtract one from ${ariaLabel}`}
        disabled={current <= 0}
        onPress={() => nudge(-1)}
      >
        <path d="M5 12h14" />
      </Stepper>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="next"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        onKeyDown={(e) => {
          // Arrow keys do what the buttons do, for anyone on a keyboard.
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            nudge(e.key === 'ArrowUp' ? 1 : -1)
          }
        }}
        placeholder="0"
        className={
          'h-12 min-w-0 flex-1 rounded-xl bg-surface-2 px-0 text-center ' +
          'text-xl font-bold tabular-nums text-ink placeholder:text-muted/50 ' +
          'focus:outline-none focus:ring-2 focus:ring-ink'
        }
      />
      <Stepper
        label={`Add one to ${ariaLabel}`}
        disabled={current >= SCORE_MAX}
        onPress={() => nudge(1)}
      >
        <path d="M12 5v14 M5 12h14" />
      </Stepper>
    </div>
  )
}

function Stepper({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string
  disabled: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      // Keep the caret (and the phone keyboard) where it is when a stepper is
      // tapped mid-entry.
      onPointerDown={(e) => e.preventDefault()}
      className={
        'flex h-12 w-7 shrink-0 items-center justify-center rounded-xl bg-surface-2 ' +
        'text-ink-2 active:bg-hairline disabled:opacity-35 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
      }
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        {children}
      </svg>
    </button>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Confirmation for anything that destroys data. Deliberately a separate layer
 * above the sheet rather than an inline "tap again", so what is about to be
 * deleted can be named and the safe choice can hold focus.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Marks the event handled so the sheet underneath stays open.
          e.preventDefault()
          onCancel()
        }
      }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} role="presentation" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm rounded-3xl bg-surface p-5 ring-1 ring-hairline"
      >
        <h2 className="text-xl font-bold">{title}</h2>
        {body ? <div className="mt-2 text-sm text-ink-2">{body}</div> : null}
        <div className="mt-5 flex gap-2">
          <Button ref={cancelRef} variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Dismiss a sheet from code (after a delete, say) through the same history
 * entry the UI uses, so Back and the sheet never disagree.
 */
export function dismissSheet(onClose: () => void) {
  if (window.history.state?.sheet) window.history.back()
  else onClose()
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Callers rebuild their close handler on every render, so hold it in a ref —
  // the effects below must not re-run and push a second history entry.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  /**
   * A sheet reads as a place you navigated to, so Back should dismiss it rather
   * than leave the app. Opening pushes an entry; every dismissal path goes
   * through that entry so the two can never disagree.
   */
  useEffect(() => {
    if (!open) return
    window.history.pushState({ sheet: true }, '')
    const onPop = () => closeRef.current()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])

  const dismiss = () => dismissSheet(onClose)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // A confirm dialog on top handles its own Escape and marks it handled.
      if (e.key === 'Escape' && !e.defaultPrevented) dismissSheet(closeRef.current)
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={dismiss}
        role="presentation"
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          'relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-surface ' +
          'pad-safe-bottom sm:max-w-md sm:rounded-3xl focus:outline-none'
        }
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-surface px-5 pt-5 pb-3">
          <Button variant="ghost" size="sm" onClick={dismiss} className="-ml-3 pr-3 pl-2">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Back
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h2>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}
