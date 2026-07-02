import { useState } from 'react'
import Logo from './Logo'

interface Props {
  roomCode: string
  isHost: boolean
  defaultName: string
  defaultObserver?: boolean
  defaultModerator?: boolean
  onEnter: (name: string, isObserver: boolean, isModerator: boolean) => void
  onCancel: () => void
}

export default function JoinForm({
  roomCode,
  isHost,
  defaultName,
  defaultObserver = false,
  defaultModerator = false,
  onEnter,
  onCancel,
}: Props) {
  const [name, setName] = useState(defaultName)
  const [isObserver, setIsObserver] = useState(defaultObserver)
  // The room creator facilitates by default.
  const [isModerator, setIsModerator] = useState(defaultModerator || isHost)
  const trimmed = name.trim()

  return (
    <main className="screen join">
      <header className="brand">
        <Logo size={48} />
        <h1>Plan It Nice</h1>
      </header>

      <section className="card-panel">
        <h2>{isHost ? 'Create room' : 'Join room'}</h2>
        <p className="muted">
          Room code: <strong className="room-code-chip">{roomCode}</strong>
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmed) onEnter(trimmed, isObserver, isModerator)
          }}
        >
          <label className="field">
            <span>Your name</span>
            <input
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              autoFocus
              maxLength={40}
            />
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={isObserver}
              onChange={(e) => setIsObserver(e.target.checked)}
            />
            <span>
              Join as observer
              <small className="muted"> — watch without voting</small>
            </span>
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={isModerator}
              onChange={(e) => setIsModerator(e.target.checked)}
            />
            <span>
              Moderator
              <small className="muted"> — may reveal, start rounds and change the deck</small>
            </span>
          </label>

          <div className="row gap">
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" disabled={!trimmed}>
              {isHost ? 'Open room' : 'Join'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
