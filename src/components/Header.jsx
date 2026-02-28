import React from 'react'

const PALETTES = ['ocean', 'forest', 'sunset', 'violet', 'rose', 'teal', 'crimson', 'slate']

export default function Header({ theme, palette, onToggleTheme, onSetPalette }) {
  return (
    <header>
      <div className="header-top">
        <h1>🃏 Scrum Poker</h1>
        <button
          className="btn btn-secondary theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
        <div className="palette-picker" role="group" aria-label="Color palette">
          <span className="palette-picker-label" aria-hidden="true">Palette:</span>
          {PALETTES.map(p => (
            <button
              key={p}
              className="palette-swatch"
              data-palette={p}
              aria-label={`${p.charAt(0).toUpperCase() + p.slice(1)} palette`}
              title={p.charAt(0).toUpperCase() + p.slice(1)}
              aria-pressed={palette === p}
              onClick={() => onSetPalette(p)}
            />
          ))}
        </div>
      </div>
      <p className="subtitle">Planning Poker for Agile Teams</p>
    </header>
  )
}
