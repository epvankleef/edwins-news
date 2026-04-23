'use client'

import { useState, useEffect } from 'react'

const LINKS = [
  { href: '/',            label: '◆ feed' },
  { href: '/opgeslagen',  label: 'opgeslagen' },
  { href: '/voorkeuren',  label: 'voorkeuren' },
]

const THEMES = ['obsidian', 'graphite', 'porcelain', 'linen', 'bone'] as const
type Theme = typeof THEMES[number]
const THEME_COLOR: Record<Theme, string> = {
  obsidian: '#0E0E12', graphite: '#1E2024', porcelain: '#FBF9F5',
  linen: '#F5F0E8', bone: '#FAFAF8',
}

export default function NavMenu({ current }: { current: '/' | '/opgeslagen' | '/voorkeuren' }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('porcelain')

  useEffect(() => {
    const t = localStorage.getItem('ef:theme') as Theme | null
    if (t && THEMES.includes(t)) setTheme(t)
  }, [])

  function applyTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('ef:theme', t)
    document.body.setAttribute('data-theme', t)
  }

  return (
    <>
      <button className="hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu">
        <span className="hamburger-bars"><span /><span /><span /></span>
      </button>

      <div
        className={`nav-backdrop${open ? ' nav-backdrop--open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className={`nav-drawer${open ? ' nav-drawer--open' : ''}`}>
        <button className="nav-drawer__close" onClick={() => setOpen(false)} aria-label="Sluiten">
          ✕
        </button>

        <nav className="nav-drawer__links">
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className={`nav-drawer__link${href === current ? ' nav-drawer__link--active' : ''}`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="nav-drawer__section-label">Thema</div>
        <div className="nav-drawer__themes">
          {THEMES.map(t => (
            <button
              key={t}
              className={`theme-swatch${theme === t ? ' active' : ''}`}
              style={{ '--sw': THEME_COLOR[t] } as React.CSSProperties}
              title={t.charAt(0).toUpperCase() + t.slice(1)}
              onClick={() => applyTheme(t)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
