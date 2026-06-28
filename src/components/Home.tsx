import { useState } from 'react'
import { makeRoomCode, normalizeRoomCode } from '../room-code'
import Logo from './Logo'

interface Props {
  defaultName: string
  onCreate: (code: string) => void
  onJoin: (code: string) => void
}

export default function Home({ onCreate, onJoin }: Props) {
  const [joinCode, setJoinCode] = useState('')
  const code = normalizeRoomCode(joinCode)

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
        <button className="btn btn-primary btn-lg" onClick={() => onCreate(makeRoomCode())}>
          Create room
        </button>
      </section>

      <div className="or-divider">
        <span>or</span>
      </div>

      <section className="card-panel">
        <h2>Join with a code</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length >= 4) onJoin(code)
          }}
        >
          <input
            className="text-input code-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Room code"
            maxLength={12}
          />
          <button className="btn btn-secondary btn-lg" type="submit" disabled={code.length < 4}>
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
