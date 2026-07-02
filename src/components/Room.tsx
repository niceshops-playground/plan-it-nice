import { useEffect, useMemo, useState } from 'react'
import { usePeerRoom, type RoomConfig } from '../peer/usePeerRoom'
import { DECK_LIST, getDeck } from '../decks'
import { computeStats } from '../stats'
import { mayFacilitate } from '../facilitation'
import { buildRoomHash } from '../room-url'
import type { DeckId, RevealPolicy } from '../types'
import CardGrid from './CardGrid'
import Table from './Table'
import Results from './Results'
import SessionLog from './SessionLog'
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

  // The room hash carries deck / reveal-policy / topic so the Share link (and a
  // reload) reproduce the setup.
  const shareHash = state
    ? buildRoomHash(config.roomId, {
        deckId: state.deckId,
        revealPolicy: state.revealPolicy,
        topic: state.topic,
      })
    : `#/room/${config.roomId}`

  // Mirror it into the URL. replaceState doesn't fire hashchange, so this never
  // disturbs the active session.
  useEffect(() => {
    if (state && window.location.hash !== shareHash) {
      window.history.replaceState(null, '', shareHash)
    }
  }, [state, shareHash])

  const [copied, setCopied] = useState(false)
  const shareUrl = `${location.origin}${location.pathname}${shareHash}`
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
  const amModerator = self?.isModerator ?? config.isModerator
  // Who may reveal / reset / change the deck — same rule the host enforces.
  const canFacilitate = mayFacilitate(state.revealPolicy, {
    isHost: room.isHost,
    isModerator: amModerator,
  })
  const facilitateHint =
    state.revealPolicy === 'moderators'
      ? 'Only moderators can run the round in this room'
      : 'Only the host can run the round in this room'

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

      {status === 'reconnecting' && (
        <div className="reconnect-banner" role="status">
          Connection dropped — reconnecting…
        </div>
      )}

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
              disabled={!canFacilitate}
            >
              {DECK_LIST.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          {room.isHost && (
            <label className="deck-picker">
              <span className="muted">Reveal</span>
              <select
                value={state.revealPolicy}
                onChange={(e) => room.setRevealPolicy(e.target.value as RevealPolicy)}
                aria-label="Who can reveal cards"
              >
                <option value="anyone">Anyone</option>
                <option value="host">Host only</option>
                <option value="moderators">Moderators only</option>
              </select>
            </label>
          )}

          <div className="vote-progress" aria-live="polite">
            {state.revealed ? (
              <span>Revealed</span>
            ) : (
              <>
                <span>
                  {votedCount}/{voters.length} voted
                </span>
                {votedCount > 0 && !allVoted && (
                  <span className="vote-warning">⚠ {voters.length - votedCount} still deciding</span>
                )}
              </>
            )}
          </div>

          <div className="row gap">
            {!state.revealed ? (
              <button
                className="btn btn-primary"
                onClick={room.reveal}
                disabled={votedCount === 0 || !canFacilitate}
                title={
                  !canFacilitate
                    ? facilitateHint
                    : votedCount === 0
                      ? 'No votes yet'
                      : allVoted
                        ? 'Reveal all votes'
                        : `Reveal now — ${voters.length - votedCount} haven't voted yet`
                }
              >
                Reveal {allVoted ? '' : `(${votedCount})`}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={room.reset}
                disabled={!canFacilitate}
                title={!canFacilitate ? facilitateHint : 'Start a new round'}
              >
                New round
              </button>
            )}
          </div>
        </section>

        <Table
          participants={state.participants}
          selfId={selfId}
          hostId={state.hostId}
          revealed={state.revealed}
          deckId={state.deckId}
          reactions={room.reactions}
          onThrow={room.throwEmoji}
        />

        {state.revealed && stats ? (
          <Results stats={stats} />
        ) : amObserver ? (
          <section className="observer-note card-panel">
            <p className="muted">
              You’re observing.{' '}
              {canFacilitate ? 'Reveal the votes' : 'The facilitator reveals the votes'} when the
              team is ready.
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

        <SessionLog history={state.history} />
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
        <label className="checkbox">
          <input
            type="checkbox"
            checked={amModerator}
            onChange={(e) => room.setModerator(e.target.checked)}
          />
          <span>Moderator</span>
        </label>
        {room.isHost && <span className="host-badge">host</span>}
      </footer>
    </div>
  )
}
