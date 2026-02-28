import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CardSelection from '../components/CardSelection.jsx'

describe('CardSelection', () => {
  it('renders nothing for observers', () => {
    const { container } = render(
      <CardSelection cardSet="standard" selectedVote={null} revealed={false} isObserver={true} specialEffects={false} onVote={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders card buttons for standard deck', () => {
    render(<CardSelection cardSet="standard" selectedVote={null} revealed={false} isObserver={false} specialEffects={false} onVote={vi.fn()} />)
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('13')).toBeTruthy()
    expect(screen.getByText('?')).toBeTruthy()
  })

  it('calls onVote with card value when clicked', () => {
    const fn = vi.fn()
    render(<CardSelection cardSet="standard" selectedVote={null} revealed={false} isObserver={false} specialEffects={false} onVote={fn} />)
    fireEvent.click(screen.getByText('5'))
    expect(fn).toHaveBeenCalledWith(5)
  })

  it('toggles vote off when same card clicked again', () => {
    const fn = vi.fn()
    render(<CardSelection cardSet="standard" selectedVote="5" revealed={false} isObserver={false} specialEffects={false} onVote={fn} />)
    fireEvent.click(screen.getByText('5'))
    expect(fn).toHaveBeenCalledWith(null)
  })

  it('cards are disabled when revealed', () => {
    render(<CardSelection cardSet="standard" selectedVote={null} revealed={true} isObserver={false} specialEffects={false} onVote={vi.fn()} />)
    const btn = screen.getByText('8')
    expect(btn.disabled).toBe(true)
  })

  it('renders fibonacci deck when specified', () => {
    render(<CardSelection cardSet="fibonacci" selectedVote={null} revealed={false} isObserver={false} specialEffects={false} onVote={vi.fn()} />)
    expect(screen.getByText('☕')).toBeTruthy()
  })
})
