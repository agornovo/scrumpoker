import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Statistics from '../components/Statistics.jsx'

describe('Statistics', () => {
  it('renders nothing when not revealed', () => {
    const { container } = render(<Statistics stats={null} revealed={false} justRevealed={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders stats when revealed', () => {
    render(<Statistics stats={{ average: 5.5, median: 5, min: 3, max: 8 }} revealed={true} justRevealed={false} />)
    expect(screen.getByText('5.5')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
  })

  it('renders nothing when revealed but no stats', () => {
    const { container } = render(<Statistics stats={null} revealed={true} justRevealed={false} />)
    expect(container.firstChild).toBeNull()
  })
})
