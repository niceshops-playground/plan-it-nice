import type { Card, Deck, DeckId } from './types'

const num = (n: number): Card => ({ value: String(n), label: String(n), numeric: n })
const special = (value: string, label: string): Card => ({ value, label, numeric: null })

/** "?" = unsure, "☕" = needs a break / no estimate. Common to every deck. */
const SPECIALS: Card[] = [special('?', '?'), special('coffee', '☕')]

export const DECKS: Record<DeckId, Deck> = {
  fibonacci: {
    id: 'fibonacci',
    name: 'Fibonacci',
    cards: [num(0), num(1), num(2), num(3), num(5), num(8), num(13), num(21), num(34), ...SPECIALS],
  },
  'mod-fibonacci': {
    id: 'mod-fibonacci',
    name: 'Modified Fibonacci',
    cards: [
      num(0),
      { value: '0.5', label: '½', numeric: 0.5 },
      num(1),
      num(2),
      num(3),
      num(5),
      num(8),
      num(13),
      num(20),
      num(40),
      num(100),
      ...SPECIALS,
    ],
  },
  tshirt: {
    id: 'tshirt',
    name: 'T-shirt sizes',
    cards: [
      { value: 'XS', label: 'XS', numeric: 1 },
      { value: 'S', label: 'S', numeric: 2 },
      { value: 'M', label: 'M', numeric: 3 },
      { value: 'L', label: 'L', numeric: 4 },
      { value: 'XL', label: 'XL', numeric: 5 },
      { value: 'XXL', label: 'XXL', numeric: 6 },
      ...SPECIALS,
    ],
  },
  'powers-of-2': {
    id: 'powers-of-2',
    name: 'Powers of 2',
    cards: [num(1), num(2), num(4), num(8), num(16), num(32), num(64), ...SPECIALS],
  },
}

export const DECK_LIST: Deck[] = Object.values(DECKS)

export function getDeck(id: DeckId): Deck {
  return DECKS[id] ?? DECKS.fibonacci
}

// Per-deck value → card index, built once, so card lookups (hot in stats and
// the participant list) are O(1) instead of scanning the deck each time.
const CARD_INDEX: Record<DeckId, Map<string, Card>> = Object.fromEntries(
  DECK_LIST.map((deck) => [deck.id, new Map(deck.cards.map((c) => [c.value, c]))]),
) as Record<DeckId, Map<string, Card>>

export function getCard(deckId: DeckId, value: string): Card | undefined {
  return CARD_INDEX[deckId]?.get(value)
}
