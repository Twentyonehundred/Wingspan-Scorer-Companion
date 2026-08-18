import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
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
}: ButtonHTMLAttributes<HTMLButtonElement> & {
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

/**
 * Numeric score field. Kept as a string so the box can be genuinely empty
 * rather than showing a 0 you have to clear before typing.
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
  return (
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
      placeholder="0"
      className={
        'h-14 w-full rounded-2xl bg-surface-2 text-center text-2xl font-bold ' +
        'tabular-nums text-ink placeholder:text-muted/50 ' +
        'focus:outline-none focus:ring-2 focus:ring-ink'
      }
    />
  )
}

/* -------------------------------------------------------------------------- */

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

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
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
        <div className="sticky top-0 flex items-center justify-between gap-3 bg-surface px-5 pt-5 pb-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button variant="secondary" size="sm" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}
