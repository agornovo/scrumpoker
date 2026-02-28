import React from 'react'
import { getCardDeck } from '../utils/cardDecks.js'
import { SoundEffects } from '../utils/soundEffects.js'

export default function CardSelection({ cardSet, selectedVote, revealed, isObserver, specialEffects, onVote }) {
  if (isObserver) return null

  const deck = getCardDeck(cardSet)

  const handleClick = (card) => {
    if (revealed) return
    const strVal = String(card.value)
    if (selectedVote === strVal) {
      onVote(null)
    } else {
      onVote(card.value)
      if (specialEffects) {
        SoundEffects.cardSelect()
      }
    }
  }

  return (
    <div className="card-selection">
      <h3>Select Your Card</h3>
      <div className="cards-container">
        {deck.cards.map(card => {
          const strVal = String(card.value)
          const isSelected = selectedVote === strVal || selectedVote === card.value
          return (
            <button
              key={strVal}
              className={`card-button${card.special ? ' card-special' : ''}${isSelected ? ' selected' : ''}`}
              data-value={strVal}
              disabled={revealed}
              onClick={() => handleClick(card)}
            >
              {card.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
