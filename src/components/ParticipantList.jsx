import React, { useEffect, useRef } from 'react'

export default function ParticipantList({
  users,
  revealed,
  justRevealed,
  creatorId,
  socketId,
  specialEffects,
  voteFlipDelayIncrement,
  voteFlipMaxDelay,
  tadaBounceSettleDelay,
  onRemove,
}) {
  const listRef = useRef(null)

  useEffect(() => {
    if (!justRevealed || !specialEffects || !listRef.current) return
    const voters = users.filter(u => !u.isObserver && u.vote !== null)
    const stats = voters.map(u => u.vote).filter(v => typeof v === 'number')
    const isConsensus = voters.length >= 2 && stats.length > 0 && Math.min(...stats) === Math.max(...stats)
    const cardAnimClass = isConsensus ? 'card-dance' : 'tada-bounce'
    listRef.current.querySelectorAll('.participant-card').forEach((card, idx) => {
      const delay = Math.min(idx * voteFlipDelayIncrement, voteFlipMaxDelay) + tadaBounceSettleDelay
      setTimeout(() => {
        card.classList.add(cardAnimClass)
        card.addEventListener('animationend', () => card.classList.remove(cardAnimClass), { once: true })
      }, delay)
    })
  }, [justRevealed, specialEffects, users, voteFlipDelayIncrement, voteFlipMaxDelay, tadaBounceSettleDelay])

  return (
    <div className="participants-section">
      <h3>
        Participants <span className="count-badge">{users.length}</span>
      </h3>
      <div ref={listRef} className="participants-list">
        {users.map((user, index) => {
          let cardClass = 'participant-card'
          if (user.isObserver) cardClass += ' observer'
          else if (user.vote === 'voted') cardClass += ' voted'

          let voteDisplay
          let voteStyle = {}
          let voteClass = 'participant-vote'
          if (user.isObserver) {
            voteDisplay = '👁️'
            voteStyle = { color: '#6c757d' }
          } else if (revealed) {
            voteDisplay = user.vote !== null ? String(user.vote) : '-'
            if (justRevealed && user.vote !== null) {
              voteClass += ' flip-reveal'
            }
          } else if (user.vote === 'voted') {
            voteDisplay = '✓'
            voteClass += ' hidden-vote'
          } else {
            voteDisplay = '...'
            voteStyle = { color: '#dee2e6' }
          }

          const animDelay = justRevealed && revealed && user.vote !== null
            ? `${Math.min(index * voteFlipDelayIncrement, voteFlipMaxDelay)}ms`
            : undefined

          return (
            <div key={user.id} className={cardClass}>
              {creatorId === socketId && user.id !== socketId && (
                <button
                  className="remove-participant-btn"
                  title="Remove participant"
                  onClick={() => {
                    if (window.confirm(`Remove ${user.name} from the room?`)) {
                      onRemove(user.id)
                    }
                  }}
                >
                  ×
                </button>
              )}
              <div className="participant-name">{user.name}</div>
              <div
                className={voteClass}
                style={{ ...voteStyle, animationDelay: animDelay }}
              >
                {voteDisplay}
              </div>
              {user.isObserver && <div className="participant-badge">Observer</div>}
              {user.id === creatorId && <div className="participant-badge host">Host</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
