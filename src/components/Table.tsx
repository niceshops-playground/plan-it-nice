import { useState } from 'react'
import { getCard } from '../decks'
import type { DeckId, Participant, Reaction } from '../types'
import Logo from './Logo'

const EMOJIS = ['👍', '🎉', '🔥', '❤️', '😂', '🤔', '🐢', '🚀'] as const

interface Props {
  participants: Participant[]
  selfId: string | null
  hostId: string
  revealed: boolean
  deckId: DeckId
  reactions: Reaction[]
  onThrow: (toId: string, emoji: string) => void
}

export default function Table({
  participants,
  selfId,
  hostId,
  revealed,
  deckId,
  reactions,
  onThrow,
}: Props) {
  // Which seat currently has its emoji palette open (only one at a time).
  const [openFor, setOpenFor] = useState<string | null>(null)

  const voters = participants.filter((p) => !p.isObserver)
  const observers = participants.filter((p) => p.isObserver)

  const throwAt = (toId: string, emoji: string) => {
    onThrow(toId, emoji)
    setOpenFor(null)
  }

  const seatProps = (p: Participant) => ({
    p,
    isSelf: p.id === selfId,
    isHost: p.id === hostId,
    revealed,
    deckId,
    reactions: reactions.filter((r) => r.to === p.id),
    paletteOpen: openFor === p.id,
    onTogglePalette: () => setOpenFor((cur) => (cur === p.id ? null : p.id)),
    onThrow: throwAt,
  })

  return (
    <section className="table-area" aria-label="Players">
      <div className="felt">
        {voters.length === 0 ? (
          <p className="muted felt-empty">Waiting for players to join…</p>
        ) : (
          <ul className="seats">
            {voters.map((p) => (
              <Seat key={p.id} {...seatProps(p)} />
            ))}
          </ul>
        )}
      </div>

      {observers.length > 0 && (
        <ul className="observers" aria-label="Observers">
          {observers.map((p) => (
            <ObserverChip key={p.id} {...seatProps(p)} />
          ))}
        </ul>
      )}
    </section>
  )
}

interface SeatProps {
  p: Participant
  isSelf: boolean
  isHost: boolean
  revealed: boolean
  deckId: DeckId
  reactions: Reaction[]
  paletteOpen: boolean
  onTogglePalette: () => void
  onThrow: (toId: string, emoji: string) => void
}

function Seat({
  p,
  isSelf,
  isHost,
  revealed,
  deckId,
  reactions,
  paletteOpen,
  onTogglePalette,
  onThrow,
}: SeatProps) {
  const showCard = p.hasVoted || revealed
  const frontLabel = revealed ? (p.vote ? (getCard(deckId, p.vote)?.label ?? p.vote) : '–') : ''

  return (
    <li className={`seat${isSelf ? ' is-self' : ''}`}>
      <div className="seat-card-wrap">
        {showCard ? (
          <div className={`flip-card${revealed ? ' is-flipped' : ''}`}>
            <div className="flip-face flip-back">
              <Logo size={26} />
            </div>
            <div className="flip-face flip-front">
              <span className="flip-value">{frontLabel}</span>
            </div>
          </div>
        ) : (
          <div className="seat-empty" aria-hidden />
        )}

        <FloatingReactions reactions={reactions} />
      </div>

      <div className="seat-name">
        <span className="seat-name-text">{p.name}</span>
        {isHost && <span className="host-badge">host</span>}
        {isSelf && <span className="you-tag">you</span>}
      </div>

      <ReactButton open={paletteOpen} onToggle={onTogglePalette} onPick={(e) => onThrow(p.id, e)} />
    </li>
  )
}

function ObserverChip({ p, isSelf, isHost, reactions, paletteOpen, onTogglePalette, onThrow }: SeatProps) {
  return (
    <li className={`observer-chip${isSelf ? ' is-self' : ''}`}>
      <span className="observer-eye" aria-hidden>
        👁
      </span>
      <span className="seat-name-text">{p.name}</span>
      {isHost && <span className="host-badge">host</span>}
      {isSelf && <span className="you-tag">you</span>}
      <FloatingReactions reactions={reactions} />
      <ReactButton open={paletteOpen} onToggle={onTogglePalette} onPick={(e) => onThrow(p.id, e)} />
    </li>
  )
}

function ReactButton({
  open,
  onToggle,
  onPick,
}: {
  open: boolean
  onToggle: () => void
  onPick: (emoji: string) => void
}) {
  return (
    <div className="react">
      <button
        type="button"
        className="react-btn"
        aria-label="Throw an emoji"
        aria-expanded={open}
        onClick={onToggle}
      >
        😀
      </button>
      {open && (
        <div className="react-palette" role="menu">
          {EMOJIS.map((e) => (
            <button key={e} type="button" className="react-emoji" onClick={() => onPick(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FloatingReactions({ reactions }: { reactions: Reaction[] }) {
  if (reactions.length === 0) return null
  return (
    <div className="floaters" aria-hidden>
      {reactions.map((r) => (
        <span key={r.id} className="floater">
          {r.emoji}
        </span>
      ))}
    </div>
  )
}
