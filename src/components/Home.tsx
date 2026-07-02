import { useState } from 'react'
import {
  MIN_ROOM_CODE_LENGTH,
  makeRoomCode,
  normalizeRoomCode,
} from '../room-code'
import Logo from './Logo'

interface Props {
  onCreate: (code: string) => void
  onJoin: (code: string) => void
}

export default function Home({ onCreate, onJoin }: Props) {
  const [roomName, setRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const code = normalizeRoomCode(joinCode)
  const nameSlug = normalizeRoomCode(roomName)
  // A named room reuses the same code every time, so a team link is permanent.
  const createCode = () => onCreate(nameSlug || makeRoomCode())

  return (
    <main className="screen home">
      <header className="brand">
        <Logo size={56} />
        <div>
          <h1>Plan It Nice</h1>
          <p className="tagline">Serverless planning poker — peer-to-peer, no sign-up.</p>
        </div>
      </header>

      <section className="card-panel">
        <h2>Start a new room</h2>
        <p className="muted">
          You become the host. Share the room link and your team estimates together in real time.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createCode()
          }}
        >
          <input
            className="text-input"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Room name — e.g. your team (optional)"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Room name"
            maxLength={40}
          />
          {nameSlug && (
            <p className="muted room-name-hint">
              Room code: <strong>{nameSlug}</strong> — same link every time.
            </p>
          )}
          <button className="btn btn-primary btn-lg" type="submit">
            {nameSlug ? 'Create named room' : 'Create room'}
          </button>
        </form>
      </section>

      <div className="or-divider">
        <span>or</span>
      </div>

      <section className="card-panel">
        <h2>Join with a code</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length >= MIN_ROOM_CODE_LENGTH) onJoin(code)
          }}
        >
          <input
            className="text-input code-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="e.g. frontend-guild"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Room code"
            maxLength={12}
          />
          <button
            className="btn btn-secondary btn-lg"
            type="submit"
            disabled={code.length < MIN_ROOM_CODE_LENGTH}
          >
            Join room
          </button>
        </form>
      </section>

      <footer className="home-footer muted">
        <p>
          Votes travel directly between browsers over WebRTC. Nothing is stored on a server — when
          everyone leaves, the room is gone.
        </p>
      </footer>
    </main>
  )
}
