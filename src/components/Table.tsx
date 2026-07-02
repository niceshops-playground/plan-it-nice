import { useCallback, useEffect, useRef, useState } from 'react'
import { getCard } from '../decks'
import type { DeckId, Participant, Reaction } from '../types'
import Logo from './Logo'

// Reactions you set on *yourself* — an expression, floats up over your seat.
const REACT_EMOJIS = [
  '👍', '👎', '🎉', '🔥', '❤️', '😂', '🤣', '😍',
  '🤔', '🙌', '👏', '🚀', '💯', '✅', '⭐', '😎',
  '🥳', '🤯', '😴', '🫡', '🧠', '👀', '💪', '🙏',
  '😬', '🤷', '🥱', '🫠', '😇', '🤓', '🤗', '🤝',
  '🐢', '☕', '🍕', '🎯', '🤞', '🫶', '💩', '🤡',
] as const
// Things you *throw at someone else* — flies across the table onto their card.
const THROW_EMOJIS = [
  '🧻', '📄', '🍅', '🥚', '💩', '🍌', '🧦', '✏️',
  '🧨', '💣', '🪨', '🧀', '🍰', '🥧', '🧅', '🌶️',
  '🥊', '👟', '📎', '🗞️', '🧱', '⚽', '🏀', '🍆',
  '🥔', '🔨', '🎂', '🍩', '💐', '❄️', '💧', '🪤',
  '🧯', '🥁', '🎈', '🪃', '🧃', '🧊', '🦴', '🌮',
] as const

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

  // Live map of participant id → the DOM node a thrown emoji flies to/from
  // (the card for players, the chip for observers). Read at flight time so it
  // survives the flex-wrap layout moving seats around.
  const seatEls = useRef<Map<string, HTMLElement>>(new Map())
  const setSeatEl = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) seatEls.current.set(id, el)
      else seatEls.current.delete(id)
    },
    [],
  )
  const getSeatEl = useCallback((id: string) => seatEls.current.get(id) ?? null, [])

  const voters = participants.filter((p) => !p.isObserver)
  const observers = participants.filter((p) => p.isObserver)

  const throwAt = (toId: string, emoji: string) => {
    onThrow(toId, emoji)
    setOpenFor(null)
  }

  // Self-reactions float over their own seat; thrown objects (from ≠ to) are
  // animated across the table by ThrowLayer instead.
  const seatProps = (p: Participant) => ({
    p,
    isSelf: p.id === selfId,
    isHost: p.id === hostId,
    revealed,
    deckId,
    reactions: reactions.filter((r) => r.to === p.id && r.from === p.id),
    paletteOpen: openFor === p.id,
    onTogglePalette: () => setOpenFor((cur) => (cur === p.id ? null : p.id)),
    onThrow: throwAt,
    seatRef: setSeatEl(p.id),
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

      <ThrowLayer reactions={reactions} getSeatEl={getSeatEl} />
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
  seatRef: (el: HTMLElement | null) => void
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
  seatRef,
}: SeatProps) {
  const showCard = p.hasVoted || revealed
  const frontLabel = revealed ? (p.vote ? (getCard(deckId, p.vote)?.label ?? p.vote) : '–') : ''
  const triggerLabel = isSelf ? 'React' : `Throw something at ${p.name}`

  return (
    <li className={`seat${isSelf ? ' is-self' : ''}`}>
      <button
        type="button"
        className="seat-card-wrap seat-trigger"
        ref={seatRef}
        aria-label={triggerLabel}
        aria-expanded={paletteOpen}
        title={triggerLabel}
        onClick={onTogglePalette}
      >
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
      </button>

      <div className="seat-name">
        <span className="seat-name-text">{p.name}</span>
        {isHost && <span className="host-badge">host</span>}
        {p.isModerator && <span className="mod-badge">mod</span>}
        {isSelf && <span className="you-tag">you</span>}
      </div>

      <ReactPalette isSelf={isSelf} open={paletteOpen} onPick={(e) => onThrow(p.id, e)} />
    </li>
  )
}

function ObserverChip({
  p,
  isSelf,
  isHost,
  reactions,
  paletteOpen,
  onTogglePalette,
  onThrow,
  seatRef,
}: SeatProps) {
  return (
    <li className={`observer-chip${isSelf ? ' is-self' : ''}`} ref={seatRef}>
      <span className="observer-eye" aria-hidden>
        👁
      </span>
      <span className="seat-name-text">{p.name}</span>
      {isHost && <span className="host-badge">host</span>}
      {p.isModerator && <span className="mod-badge">mod</span>}
      {isSelf && <span className="you-tag">you</span>}
      <FloatingReactions reactions={reactions} />
      <div className="react">
        <button
          type="button"
          className="react-btn"
          aria-label={isSelf ? 'React' : `Throw something at ${p.name}`}
          aria-expanded={paletteOpen}
          onClick={onTogglePalette}
        >
          {isSelf ? '😀' : '🎯'}
        </button>
        <ReactPalette isSelf={isSelf} open={paletteOpen} onPick={(e) => onThrow(p.id, e)} />
      </div>
    </li>
  )
}

// Your own seat gets a "react about myself" palette; every other seat gets a
// "throw something at them" palette. Both post to the same target seat.
function ReactPalette({
  isSelf,
  open,
  onPick,
}: {
  isSelf: boolean
  open: boolean
  onPick: (emoji: string) => void
}) {
  // Always in the DOM so it can reveal on hover/focus (CSS); `is-open` covers
  // the click/tap path for touch devices with no hover.
  const emojis = isSelf ? REACT_EMOJIS : THROW_EMOJIS
  return (
    <div className={`react-palette${open ? ' is-open' : ''}`} role="menu">
      {emojis.map((e) => (
        <button key={e} type="button" className="react-emoji" onClick={() => onPick(e)}>
          {e}
        </button>
      ))}
    </div>
  )
}

// Self-reactions only (from === to): a gentle float over the seat.
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

/* -------------------------------------------------------------------------- *
 * ThrowLayer — a viewport-fixed overlay that animates each *thrown* emoji
 * (from ≠ to) flying from the thrower's seat, arcing across the table, and
 * splatting onto the target's card. Positions are read from the seat DOM nodes
 * at flight time, so it works regardless of where the flex layout puts seats.
 * -------------------------------------------------------------------------- */
function ThrowLayer({
  reactions,
  getSeatEl,
}: {
  reactions: Reaction[]
  getSeatEl: (id: string) => HTMLElement | null
}) {
  const thrown = reactions.filter((r) => r.from !== r.to)
  if (thrown.length === 0) return null
  return (
    <div className="throw-layer" aria-hidden>
      {thrown.map((r) => (
        <Projectile key={r.id} reaction={r} getSeatEl={getSeatEl} />
      ))}
    </div>
  )
}

function Projectile({
  reaction,
  getSeatEl,
}: {
  reaction: Reaction
  getSeatEl: (id: string) => HTMLElement | null
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    const toEl = getSeatEl(reaction.to)
    if (!el || !toEl) return
    const center = (n: HTMLElement) => {
      const r = n.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const to = center(toEl)
    const fromEl = getSeatEl(reaction.from)
    const from = fromEl ? center(fromEl) : to
    const at = (x: number, y: number, scale: number, rot: number) =>
      `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`

    if (prefersReducedMotion() || !fromEl) {
      // No motion (or no known thrower): just land + fade on the target.
      el.animate(
        [
          { transform: at(to.x, to.y, 1.4, 0), opacity: 1 },
          { transform: at(to.x, to.y, 1.15, 0), opacity: 0 },
        ],
        { duration: 900, easing: 'ease-out', fill: 'forwards' },
      )
      return
    }

    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 150 }
    const spin = to.x >= from.x ? 720 : -720
    el.animate(
      [
        { transform: at(from.x, from.y, 0.5, 0), opacity: 0, offset: 0 },
        { transform: at(from.x, from.y, 1, 0), opacity: 1, offset: 0.08 },
        { transform: at(mid.x, mid.y, 1.1, spin / 2), opacity: 1, offset: 0.5 },
        { transform: at(to.x, to.y, 1.55, spin), opacity: 1, offset: 0.82 }, // impact
        { transform: at(to.x, to.y, 1.25, spin), opacity: 1, offset: 0.9 },
        { transform: at(to.x, to.y, 1.15, spin), opacity: 0, offset: 1 },
      ],
      { duration: 1150, easing: 'cubic-bezier(0.3, 0.65, 0.4, 1)', fill: 'forwards' },
    )
  }, [reaction, getSeatEl])

  return (
    <span ref={ref} className="projectile">
      {reaction.emoji}
    </span>
  )
}
