import { useMemo, useState } from 'react'
import { usePeerRoom, type RoomConfig } from '../peer/usePeerRoom'
import { DECK_LIST, getDeck } from '../decks'
import { computeStats } from '../stats'
import type { DeckId } from '../types'
import CardGrid from './CardGrid'
import Participants from './Participants'
import Results from './Results'
import Logo from './Logo'

interface Props {
  config: RoomConfig
  onLeave: () => void
}

export default function Room({ config, onLeave }: Props) {
  const room = usePeerRoom(config)
  const { state, status, selfId, selfVote, error } = room

  const self = useMemo(
    () => state?.participants.find((p) => p.id === selfId) ?? null,
    [state, selfId],
  )
  const deck = getDeck(state?.deckId ?? 'fibonacci')
  const stats = useMemo(
    () => (state ? computeStats(state.deckId, state.participants) : null),
    [state],
  )

  const [copied, setCopied] = useState(false)
  const shareUrl = `${location.origin}${location.pathname}#/room/${config.roomId}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the code is shown in the header regardless */
    }
  }

  if (error && status === 'error') {
    return (
      <main className="screen room-error">
        <Logo size={48} />
        <h2>Can’t connect</h2>
        <p className="error-text">{error}</p>
        <button className="btn btn-primary" onClick={onLeave}>
          Back to start
        </button>
      </main>
    )
  }

  if (!state) {
    return (
      <main className="screen loading">
        <Logo size={48} />
        <div className="spinner" aria-hidden />
        <p className="muted">
          {status === 'reconnecting' ? 'Reconnecting…' : 'Connecting to the room…'}
        </p>
      </main>
    )
  }

  const voters = state.participants.filter((p) => !p.isObserver)
  const votedCount = voters.filter((p) => p.hasVoted).length
  const allVoted = voters.length > 0 && votedCount === voters.length
  const amObserver = self?.isObserver ?? config.isObserver

  return (
    <div className="room">
      <header className="room-header">
        <div className="room-header-left">
          <Logo size={32} />
          <div className="room-id">
            <span className="room-id-label">Room</span>
            <strong>{state.roomId}</strong>
          </div>
        </div>

        <div className="room-header-right">
          <button className="btn btn-secondary btn-sm" onClick={copyLink}>
            {copied ? '✓ Link copied' : 'Share link'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      <main className="room-main">
        <section className="topic-bar">
          <input
            className="topic-input"
            value={state.topic}
            onChange={(e) => room.setTopic(e.target.value)}
            placeholder="What are we estimating? (e.g. PROJ-128 — Login rate limiting)"
            aria-label="Estimation topic"
          />
        </section>

        <section className="controls">
          <label className="deck-picker">
            <span className="muted">Deck</span>
            <select
              value={state.deckId}
              onChange={(e) => room.setDeck(e.target.value as DeckId)}
            >
              {DECK_LIST.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <div className="vote-progress" aria-live="polite">
            {state.revealed ? (
              <span>Revealed</span>
            ) : (
              <span>
                {votedCount}/{voters.length} voted
              </span>
            )}
          </div>

          <div className="row gap">
            {!state.revealed ? (
              <button
                className="btn btn-primary"
                onClick={room.reveal}
                disabled={votedCount === 0}
                title={votedCount === 0 ? 'No votes yet' : 'Reveal all votes'}
              >
                Reveal {allVoted ? '' : `(${votedCount})`}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={room.reset}>
                New round
              </button>
            )}
          </div>
        </section>

        {state.revealed && stats ? (
          <Results deck={deck} stats={stats} />
        ) : amObserver ? (
          <section className="observer-note card-panel">
            <p className="muted">
              You’re observing. Reveal the votes when the team is ready, then start a new round.
            </p>
          </section>
        ) : (
          <CardGrid
            cards={deck.cards}
            selected={selfVote}
            disabled={state.revealed}
            onPick={(value) => (selfVote === value ? room.retract() : room.vote(value))}
          />
        )}

        <Participants
          participants={state.participants}
          selfId={selfId}
          revealed={state.revealed}
          deckId={state.deckId}
        />
      </main>

      <footer className="room-footer">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={amObserver}
            onChange={(e) => room.setObserver(e.target.checked)}
          />
          <span>Observer mode</span>
        </label>
        {status === 'reconnecting' && <span className="muted">· reconnecting…</span>}
        {room.isHost && <span className="host-badge">host</span>}
      </footer>
    </div>
  )
}
