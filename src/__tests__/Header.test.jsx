import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Header from '../components/Header.jsx'

describe('Header', () => {
  it('renders the app title', () => {
    render(<Header theme="light" palette="ocean" onToggleTheme={vi.fn()} onSetPalette={vi.fn()} />)
    expect(screen.getByText(/Scrum Poker/)).toBeTruthy()
  })

  it('shows "Dark theme" button when theme is light', () => {
    render(<Header theme="light" palette="ocean" onToggleTheme={vi.fn()} onSetPalette={vi.fn()} />)
    expect(screen.getByText('Dark theme')).toBeTruthy()
  })

  it('shows "Light theme" button when theme is dark', () => {
    render(<Header theme="dark" palette="ocean" onToggleTheme={vi.fn()} onSetPalette={vi.fn()} />)
    expect(screen.getByText('Light theme')).toBeTruthy()
  })

  it('calls onToggleTheme when button clicked', () => {
    const fn = vi.fn()
    render(<Header theme="light" palette="ocean" onToggleTheme={fn} onSetPalette={vi.fn()} />)
    fireEvent.click(screen.getByText('Dark theme'))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('renders 8 palette swatches', () => {
    render(<Header theme="light" palette="ocean" onToggleTheme={vi.fn()} onSetPalette={vi.fn()} />)
    const swatches = document.querySelectorAll('.palette-swatch')
    expect(swatches.length).toBe(8)
  })

  it('calls onSetPalette with palette name when swatch clicked', () => {
    const fn = vi.fn()
    render(<Header theme="light" palette="ocean" onToggleTheme={vi.fn()} onSetPalette={fn} />)
    fireEvent.click(screen.getByTitle('Forest'))
    expect(fn).toHaveBeenCalledWith('forest')
  })

  it('marks the active palette swatch as pressed', () => {
    render(<Header theme="light" palette="forest" onToggleTheme={vi.fn()} onSetPalette={vi.fn()} />)
    expect(screen.getByTitle('Forest').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTitle('Ocean').getAttribute('aria-pressed')).toBe('false')
  })
})
