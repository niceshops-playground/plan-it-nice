import { getCard } from '../decks'
import type { DeckId, Participant } from '../types'

interface Props {
  participants: Participant[]
  selfId: string | null
  revealed: boolean
  deckId: DeckId
}

export default function Participants({ participants, selfId, revealed, deckId }: Props) {
  // Voters first, then observers; stable within each group by name.
  const sorted = [...participants].sort((a, b) => {
    if (a.isObserver !== b.isObserver) return a.isObserver ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  return (
    <section className="participants" aria-label="Participants">
      <h3 className="section-title">
        Participants <span className="count">{participants.length}</span>
      </h3>
      <ul className="participant-list">
        {sorted.map((p) => {
          const card = p.vote != null ? getCard(deckId, p.vote) : undefined
          return (
            <li key={p.id} className={`participant${p.id === selfId ? ' is-self' : ''}`}>
              <span className="participant-name">
                {p.name}
                {p.id === selfId && <span className="you-tag">you</span>}
                {p.isObserver && <span className="observer-tag">observer</span>}
              </span>
              <span className="participant-status">
                {p.isObserver ? (
                  <span className="status-eye" title="Observer">
                    👁
                  </span>
                ) : revealed ? (
                  <span className="vote-chip">{card?.label ?? '–'}</span>
                ) : p.hasVoted ? (
                  <span className="vote-chip voted" title="Voted">
                    ✓
                  </span>
                ) : (
                  <span className="vote-chip pending" title="Thinking…">
                    …
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
