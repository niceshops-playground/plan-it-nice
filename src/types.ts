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

/** Who is allowed to reveal cards, start a new round, and change the deck.
 *  `anyone` = any participant; `host` = only the room creator. */
export type RevealPolicy = 'anyone' | 'host'

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
  /** Peer id of the host (room creator), so clients can badge the seat and
   *  enforce the reveal policy in the UI. */
  hostId: string
  topic: string
  deckId: DeckId
  revealed: boolean
  round: number
  revealPolicy: RevealPolicy
  participants: Participant[]
}

/** A transient emoji thrown from one participant at another. Not part of the
 *  persisted room state — it animates and disappears. */
export interface Reaction {
  id: string
  from: string
  to: string
  emoji: string
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
  | { type: 'setRevealPolicy'; policy: RevealPolicy }
  // A client asks the host to broadcast an emoji aimed at `to`.
  | { type: 'throw'; to: string; emoji: string }

export type HostMessage =
  | { type: 'state'; state: RoomState }
  // The host fans a thrown emoji out to everyone (including the sender).
  | { type: 'reaction'; reaction: Reaction }

export type PeerMessage = ClientMessage | HostMessage

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed'
