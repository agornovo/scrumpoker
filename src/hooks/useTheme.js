import { useState, useEffect, useCallback } from 'react'

const THEME_KEY = 'scrumpoker-theme'
const PALETTE_KEY = 'scrumpoker-palette'

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) } catch { return null }
}
function getStoredPalette() {
  try { return localStorage.getItem(PALETTE_KEY) } catch { return null }
}

export function useTheme() {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const [theme, setThemeState] = useState(() => getStoredTheme() || (prefersDark ? 'dark' : 'light'))
  const [palette, setPaletteState] = useState(() => getStoredPalette() || 'ocean')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette)
  }, [palette])

  const setTheme = useCallback(newTheme => {
    setThemeState(newTheme)
    try { localStorage.setItem(THEME_KEY, newTheme) } catch { /**/ }
  }, [])

  const setPalette = useCallback(newPalette => {
    setPaletteState(newPalette)
    try { localStorage.setItem(PALETTE_KEY, newPalette) } catch { /**/ }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, palette, toggleTheme, setPalette }
}
