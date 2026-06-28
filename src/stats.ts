import { getCard } from './decks'
import type { DeckId, Participant } from './types'

export interface VoteStats {
  /** Number of voters (excluding observers and non-voters). */
  count: number
  /** Mean of numeric votes, or null if no numeric votes were cast. */
  average: number | null
  /** Median of numeric votes, or null if none. */
  median: number | null
  /** Lowest and highest numeric card labels, for the spread display. */
  low: string | null
  high: string | null
  /** True when every numeric voter picked the same card → consensus. */
  consensus: boolean
  /** One bucket per distinct cast value, sorted for display (numeric asc,
   *  then specials). */
  histogram: HistogramBucket[]
}

export interface HistogramBucket {
  value: string
  label: string
  count: number
  numeric: number | null
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function computeStats(deckId: DeckId, participants: Participant[]): VoteStats {
  const votes = participants
    .filter((p) => !p.isObserver && p.vote != null)
    .map((p) => p.vote as string)

  // Histogram across every cast value (numeric and special alike).
  const counts = new Map<string, number>()
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1)

  const histogram: HistogramBucket[] = [...counts.entries()]
    .map(([value, count]) => {
      const card = getCard(deckId, value)
      return { value, label: card?.label ?? value, count, numeric: card?.numeric ?? null }
    })
    .sort((a, b) => {
      if (a.numeric != null && b.numeric != null) return a.numeric - b.numeric
      if (a.numeric != null) return -1
      if (b.numeric != null) return 1
      return a.label.localeCompare(b.label)
    })

  const numbers = votes
    .map((v) => getCard(deckId, v)?.numeric)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b)

  if (numbers.length === 0) {
    return {
      count: votes.length,
      average: null,
      median: null,
      low: null,
      high: null,
      consensus: votes.length > 1 && new Set(votes).size === 1,
      histogram,
    }
  }

  const sum = numbers.reduce((a, b) => a + b, 0)
  const lowCard = getCard(deckId, votes.find((v) => getCard(deckId, v)?.numeric === numbers[0])!)
  const highCard = getCard(
    deckId,
    votes.find((v) => getCard(deckId, v)?.numeric === numbers[numbers.length - 1])!,
  )

  return {
    count: votes.length,
    average: sum / numbers.length,
    median: median(numbers),
    low: lowCard?.label ?? String(numbers[0]),
    high: highCard?.label ?? String(numbers[numbers.length - 1]),
    consensus: new Set(numbers).size === 1 && new Set(votes).size === 1,
    histogram,
  }
}

/** Round to at most one decimal place and drop a trailing ".0". */
export function fmt(n: number | null): string {
  if (n == null) return '–'
  return (Math.round(n * 10) / 10).toString()
}
