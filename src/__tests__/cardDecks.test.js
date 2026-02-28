import { describe, it, expect } from 'vitest'
import { CARD_DECKS, getCardDeck } from '../utils/cardDecks.js'

describe('cardDecks', () => {
  it('exports four deck keys', () => {
    expect(Object.keys(CARD_DECKS)).toEqual(['standard', 'fibonacci', 'tshirt', 'powers2'])
  })
  it('getCardDeck returns the right deck', () => {
    expect(getCardDeck('fibonacci').label).toBe('Fibonacci')
    expect(getCardDeck('tshirt').cards[0].value).toBe('XS')
  })
  it('getCardDeck falls back to standard for unknown keys', () => {
    expect(getCardDeck('unknown').label).toBe('Standard [1-100]')
  })
  it('standard deck includes special card ?', () => {
    expect(CARD_DECKS.standard.cards.find(c => c.value === '?')).toBeTruthy()
  })
})
