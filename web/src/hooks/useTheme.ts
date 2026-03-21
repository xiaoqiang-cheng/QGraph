import { useState, useEffect, useCallback } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('qgraph-theme')
    return (saved as Theme) || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('qgraph-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
