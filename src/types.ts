/** A single selectable card value. `value` is the wire/identity key. */
export interface Card {
  /** Stable identifier, also what gets stored as a vote. */
  value: string
  /** What the user sees on the card face. */
  label: string
  /** Numeric weight used for average/median/spread, or null if non-numeric
   *  (e.g. "?", "☕"). Non-numeric votes are excluded from stats. */
  numeric: number | null
}

export interface Deck {
  id: DeckId
  name: string
  cards: Card[]
}

export type DeckId = 'fibonacci' | 'mod-fibonacci' | 'tshirt' | 'powers-of-2'

/** A participant as seen by everyone in the room. */
export interface Participant {
  id: string
  name: string
  isObserver: boolean
  /** Whether this participant has cast a vote this round. */
  hasVoted: boolean
  /** The chosen card value — only populated for self, or for everyone once
   *  the round is revealed. `null` otherwise (votes stay hidden). */
  vote: string | null
}

/** Authoritative room state, owned by the host and broadcast to all peers. */
export interface RoomState {
  roomId: string
  topic: string
  deckId: DeckId
  revealed: boolean
  round: number
  participants: Participant[]
}

/* ------------------------------------------------------------------ *
 * Wire protocol — messages exchanged over the PeerJS data channels.
 * Clients send actions to the host; the host broadcasts `state`.
 * ------------------------------------------------------------------ */

export type ClientMessage =
  | { type: 'hello'; name: string; isObserver: boolean }
  | { type: 'vote'; value: string }
  | { type: 'retract' }
  | { type: 'reveal' }
  | { type: 'reset' }
  | { type: 'setDeck'; deckId: DeckId }
  | { type: 'setTopic'; topic: string }
  | { type: 'setObserver'; isObserver: boolean }
  | { type: 'rename'; name: string }

export type HostMessage = { type: 'state'; state: RoomState }

export type PeerMessage = ClientMessage | HostMessage

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed'
