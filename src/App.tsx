import { useEffect, useState } from 'react'
import Home from './components/Home'
import JoinForm from './components/JoinForm'
import Room from './components/Room'
import { normalizeRoomCode } from './room-code'

/**
 * Tiny hash router. Two routes:
 *   #/                  → home (create / join)
 *   #/room/<CODE>       → a room
 * A `host` flag is carried in component state (not the URL) so a shared link
 * always joins as a participant, never accidentally as a second host.
 *
 * The active session is mirrored to sessionStorage so a reload (or a discarded
 * tab) drops you straight back into the same room with the same role, while
 * name/observer preferences live in localStorage so they persist across visits.
 */

interface Session {
  roomId: string
  isHost: boolean
  name: string
  isObserver: boolean
  isModerator: boolean
}

function readRoomFromHash(): string | null {
  const m = window.location.hash.match(/^#\/room\/([^/?]+)/)
  return m ? normalizeRoomCode(decodeURIComponent(m[1])) : null
}

const NAME_KEY = 'pin:name'
const OBSERVER_KEY = 'pin:observer'
const MODERATOR_KEY = 'pin:moderator'
const SESSION_KEY = 'pin:session'

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    // Only restore if the URL still points at the same room.
    const code = readRoomFromHash()
    return code && code === s.roomId ? s : null
  } catch {
    return null
  }
}

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(readRoomFromHash)
  const [session, setSession] = useState<Session | null>(loadSession)
  const [pendingHost, setPendingHost] = useState(false)

  useEffect(() => {
    const onHash = () => {
      const code = readRoomFromHash()
      setRoomCode(code)
      // Leaving the room, or navigating to a different one, ends the session.
      setSession((prev) => (prev && prev.roomId === code ? prev : null))
      if (!code) setPendingHost(false)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Create a room: pick a code, mark ourselves as the host, navigate.
  const handleCreate = (code: string) => {
    setPendingHost(true)
    window.location.hash = `#/room/${code}`
  }

  const handleJoinExisting = (code: string) => {
    setPendingHost(false)
    window.location.hash = `#/room/${code}`
  }

  const handleEnter = (name: string, isObserver: boolean, isModerator: boolean) => {
    if (!roomCode) return
    localStorage.setItem(NAME_KEY, name)
    localStorage.setItem(OBSERVER_KEY, String(isObserver))
    localStorage.setItem(MODERATOR_KEY, String(isModerator))
    const next: Session = { roomId: roomCode, isHost: pendingHost, name, isObserver, isModerator }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
    setSession(next)
  }

  const handleLeave = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    setPendingHost(false)
    window.location.hash = '#/'
  }

  if (session) {
    return <Room config={session} onLeave={handleLeave} />
  }

  if (roomCode) {
    return (
      <JoinForm
        roomCode={roomCode}
        isHost={pendingHost}
        defaultName={localStorage.getItem(NAME_KEY) ?? ''}
        defaultObserver={localStorage.getItem(OBSERVER_KEY) === 'true'}
        defaultModerator={localStorage.getItem(MODERATOR_KEY) === 'true'}
        onEnter={handleEnter}
        onCancel={handleLeave}
      />
    )
  }

  return <Home onCreate={handleCreate} onJoin={handleJoinExisting} />
}
