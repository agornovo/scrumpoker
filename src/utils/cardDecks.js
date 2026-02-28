export const CARD_DECKS = {
  standard: {
    label: 'Standard [1-100]',
    cards: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 5, label: '5' },
      { value: 8, label: '8' },
      { value: 13, label: '13' },
      { value: 20, label: '20' },
      { value: 40, label: '40' },
      { value: 100, label: '100' },
      { value: '?', label: '?', special: true },
    ],
  },
  fibonacci: {
    label: 'Fibonacci',
    cards: [
      { value: 0, label: '0' },
      { value: 0.5, label: '½' },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 5, label: '5' },
      { value: 8, label: '8' },
      { value: 13, label: '13' },
      { value: 21, label: '21' },
      { value: 34, label: '34' },
      { value: 55, label: '55' },
      { value: '?', label: '?', special: true },
      { value: '☕', label: '☕', special: true },
    ],
  },
  tshirt: {
    label: 'T-Shirt Sizes',
    cards: [
      { value: 'XS', label: 'XS' },
      { value: 'S', label: 'S' },
      { value: 'M', label: 'M' },
      { value: 'L', label: 'L' },
      { value: 'XL', label: 'XL' },
      { value: 'XXL', label: 'XXL' },
      { value: '?', label: '?', special: true },
    ],
  },
  powers2: {
    label: 'Powers of 2',
    cards: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 4, label: '4' },
      { value: 8, label: '8' },
      { value: 16, label: '16' },
      { value: 32, label: '32' },
      { value: 64, label: '64' },
      { value: '?', label: '?', special: true },
    ],
  },
}

export function getCardDeck(deckKey) {
  return CARD_DECKS[deckKey] || CARD_DECKS.standard
}
