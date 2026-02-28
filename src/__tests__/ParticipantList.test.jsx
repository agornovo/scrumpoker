import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ParticipantList from '../components/ParticipantList.jsx'

const mkUsers = overrides => [
  { id: 'u1', name: 'Alice', vote: null, isObserver: false },
  { id: 'u2', name: 'Bob', vote: 'voted', isObserver: false },
  ...overrides,
]

describe('ParticipantList', () => {
  it('renders participant names', () => {
    render(
      <ParticipantList users={mkUsers([])} revealed={false} justRevealed={false}
        creatorId="u1" socketId="u1" specialEffects={false}
        voteFlipDelayIncrement={200} voteFlipMaxDelay={1200} tadaBounceSettleDelay={900}
        onRemove={vi.fn()} />
    )
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
  })

  it('shows participant count badge', () => {
    render(
      <ParticipantList users={mkUsers([])} revealed={false} justRevealed={false}
        creatorId="u1" socketId="u1" specialEffects={false}
        voteFlipDelayIncrement={200} voteFlipMaxDelay={1200} tadaBounceSettleDelay={900}
        onRemove={vi.fn()} />
    )
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('shows Host badge for creator', () => {
    render(
      <ParticipantList users={mkUsers([])} revealed={false} justRevealed={false}
        creatorId="u1" socketId="u2" specialEffects={false}
        voteFlipDelayIncrement={200} voteFlipMaxDelay={1200} tadaBounceSettleDelay={900}
        onRemove={vi.fn()} />
    )
    expect(screen.getByText('Host')).toBeTruthy()
  })

  it('shows Observer badge for observers', () => {
    const users = [{ id: 'u3', name: 'Carol', vote: null, isObserver: true }]
    render(
      <ParticipantList users={users} revealed={false} justRevealed={false}
        creatorId="u1" socketId="u2" specialEffects={false}
        voteFlipDelayIncrement={200} voteFlipMaxDelay={1200} tadaBounceSettleDelay={900}
        onRemove={vi.fn()} />
    )
    expect(screen.getByText('Observer')).toBeTruthy()
  })

  it('shows remove buttons when user is creator', () => {
    render(
      <ParticipantList users={mkUsers([])} revealed={false} justRevealed={false}
        creatorId="u1" socketId="u1" specialEffects={false}
        voteFlipDelayIncrement={200} voteFlipMaxDelay={1200} tadaBounceSettleDelay={900}
        onRemove={vi.fn()} />
    )
    // Should show remove button for Bob (u2) but not Alice (u1 = self)
    const removeBtns = document.querySelectorAll('.remove-participant-btn')
    expect(removeBtns.length).toBe(1)
  })

  it('calls onRemove after confirm', () => {
    window.confirm = vi.fn().mockReturnValue(true)
    const fn = vi.fn()
    render(
      <ParticipantList users={mkUsers([])} revealed={false} justRevealed={false}
        creatorId="u1" socketId="u1" specialEffects={false}
        voteFlipDelayIncrement={200} voteFlipMaxDelay={1200} tadaBounceSettleDelay={900}
        onRemove={fn} />
    )
    fireEvent.click(document.querySelector('.remove-participant-btn'))
    expect(fn).toHaveBeenCalledWith('u2')
  })

  it('shows vote values when revealed', () => {
    const users = [{ id: 'u1', name: 'Alice', vote: 8, isObserver: false }]
    render(
      <ParticipantList users={users} revealed={true} justRevealed={false}
        creatorId="u1" socketId="u1" specialEffects={false}
        voteFlipDelayIncrement={200} voteFlipMaxDelay={1200} tadaBounceSettleDelay={900}
        onRemove={vi.fn()} />
    )
    expect(screen.getByText('8')).toBeTruthy()
  })
})
