import { DECKS } from './decks'
import type { DeckId, RevealPolicy } from './types'

/** Room settings that can travel in the URL so a link recreates a room's setup
 *  (deck, who may facilitate, current topic) even after every peer has left. */
export interface RoomSettings {
  deckId?: DeckId
  revealPolicy?: RevealPolicy
  topic?: string
}

const isDeckId = (v: string | null): v is DeckId => v != null && v in DECKS
const REVEAL_POLICIES: RevealPolicy[] = ['anyone', 'host', 'moderators']
const isRevealPolicy = (v: string | null): v is RevealPolicy =>
  v != null && (REVEAL_POLICIES as string[]).includes(v)

/** Read the `?deck=…&reveal=…&topic=…` query out of a `#/room/CODE?…` hash.
 *  Unknown / malformed values are dropped rather than trusted. */
export function parseRoomSettings(hash: string): RoomSettings {
  const q = hash.indexOf('?')
  if (q === -1) return {}
  const params = new URLSearchParams(hash.slice(q + 1))
  const settings: RoomSettings = {}
  const deck = params.get('deck')
  if (isDeckId(deck)) settings.deckId = deck
  const reveal = params.get('reveal')
  if (isRevealPolicy(reveal)) settings.revealPolicy = reveal
  const topic = params.get('topic')?.trim()
  if (topic) settings.topic = topic
  return settings
}

/** Build the `#/room/CODE?…` hash carrying the given settings. */
export function buildRoomHash(code: string, settings: RoomSettings): string {
  const params = new URLSearchParams()
  if (settings.deckId) params.set('deck', settings.deckId)
  if (settings.revealPolicy) params.set('reveal', settings.revealPolicy)
  if (settings.topic?.trim()) params.set('topic', settings.topic.trim())
  const q = params.toString()
  return `#/room/${code}${q ? `?${q}` : ''}`
}
