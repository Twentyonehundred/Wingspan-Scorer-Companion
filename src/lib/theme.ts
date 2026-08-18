import { useCallback, useEffect, useState } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'ws.theme'

function read(): ThemePref {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Resolves the preference onto `<html data-theme>`, which every colour token
 * keys off. index.html applies the same rule before first paint.
 */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(read)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = pref === 'system' ? media.matches : pref === 'dark'
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [pref])

  const set = useCallback((next: ThemePref) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      // Preference just won't survive a reload.
    }
    setPref(next)
  }, [])

  return [pref, set] as const
}
