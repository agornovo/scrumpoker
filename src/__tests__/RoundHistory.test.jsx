import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RoundHistory from '../components/RoundHistory.jsx'

const sampleRounds = [
  { round: 1, title: 'Story A', stats: { average: 5, min: 3, max: 8 } },
  { round: 2, title: 'Story B', stats: { average: 3, min: 2, max: 5 } },
]

describe('RoundHistory', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<RoundHistory rounds={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders rounds in reverse order (most recent first)', () => {
    render(<RoundHistory rounds={sampleRounds} />)
    const items = document.querySelectorAll('.round-history-item')
    expect(items[0].textContent).toContain('Round 2')
    expect(items[1].textContent).toContain('Round 1')
  })

  it('shows story titles and stats', () => {
    render(<RoundHistory rounds={sampleRounds} />)
    expect(screen.getByText('Story A')).toBeTruthy()
    expect(screen.getByText('Story B')).toBeTruthy()
  })

  it('shows (no title) for rounds without a title', () => {
    render(<RoundHistory rounds={[{ round: 1, title: '', stats: { average: 5, min: 3, max: 8 } }]} />)
    expect(screen.getByText('(no title)')).toBeTruthy()
  })
})
