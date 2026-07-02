// Lowercase, no 0/o/1/i/l so a random code is easy to read aloud.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** Generate a random, human-friendly room code (default 6 chars). */
export function makeRoomCode(length = 6): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

/** Longest a room code (random or a custom team name) may be. */
export const MAX_ROOM_CODE_LENGTH = 40
/** Shortest usable code — also the "Join" button's enable threshold. */
export const MIN_ROOM_CODE_LENGTH = 3

/**
 * Canonicalise any input into a room code / peer-id-safe slug: lowercase, runs
 * of anything but a-z0-9 collapsed to a single hyphen, edge hyphens trimmed.
 * This lets a team type a memorable name ("Frontend Guild" → "frontend-guild")
 * and still land in the same room as anyone else who types the same thing.
 * The result feeds the PeerJS id `pin<code>`, which permits `-` between
 * alphanumerics — the trimming/collapsing keeps it valid.
 */
export function normalizeRoomCode(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ROOM_CODE_LENGTH)
}
