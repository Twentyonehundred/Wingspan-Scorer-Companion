import { useState, type ReactNode } from 'react'
import { History } from './screens/History'
import { Play } from './screens/Play'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'
import { useTheme } from './lib/theme'

type Tab = 'play' | 'history' | 'stats'

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  {
    key: 'play',
    label: 'Play',
    icon: (
      <path d="M5 3h11l3 3v15H5z M8 8h8 M8 12h8 M8 16h5" />
    ),
  },
  {
    key: 'history',
    label: 'History',
    icon: <path d="M12 7v5l3 2 M21 12a9 9 0 1 1-3.2-6.9 M21 3v4h-4" />,
  },
  {
    key: 'stats',
    label: 'Stats',
    icon: <path d="M4 20V10 M10 20V4 M16 20v-7 M22 20H2" />,
  },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('play')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useTheme()

  return (
    <div className="min-h-dvh bg-plane">
      <header className="pad-safe-top sticky top-0 z-30 bg-plane/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <p className="text-sm font-bold tracking-[0.14em] text-muted uppercase">Wingspan</p>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-ink-2"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>

      <main
        className="mx-auto max-w-2xl px-5 pt-2"
        style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        {tab === 'play' ? <Play onGoToHistory={() => setTab('history')} /> : null}
        {tab === 'history' ? <History /> : null}
        {tab === 'stats' ? <Stats /> : null}
      </main>

      <nav className="pad-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface">
        <div
          className="mx-auto flex max-w-2xl items-stretch"
          style={{ height: 'var(--nav-h)' }}
        >
          {TABS.map((item) => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={active ? 'page' : undefined}
                className={
                  'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-bold ' +
                  (active ? 'text-ink' : 'text-muted')
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.4 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {item.icon}
                </svg>
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onTheme={setTheme}
      />
    </div>
  )
}
