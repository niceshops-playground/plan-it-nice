// Crockford-ish alphabet: no 0/O/1/I/L to keep codes easy to read aloud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Generate a random, human-friendly room code (default 6 chars). */
export function makeRoomCode(length = 6): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

/** Normalise user-typed codes: uppercase, strip anything not in the alphabet. */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((ch) => ALPHABET.includes(ch))
    .join('')
}
