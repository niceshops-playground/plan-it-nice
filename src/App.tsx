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
 */

interface Session {
  roomId: string
  isHost: boolean
  name: string
  isObserver: boolean
}

function readRoomFromHash(): string | null {
  const m = window.location.hash.match(/^#\/room\/([^/?]+)/)
  return m ? normalizeRoomCode(decodeURIComponent(m[1])) : null
}

const NAME_KEY = 'pin:name'

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(readRoomFromHash)
  const [session, setSession] = useState<Session | null>(null)
  const [pendingHost, setPendingHost] = useState(false)

  useEffect(() => {
    const onHash = () => {
      const code = readRoomFromHash()
      setRoomCode(code)
      if (!code) {
        setSession(null)
        setPendingHost(false)
      }
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

  const handleEnter = (name: string, isObserver: boolean) => {
    if (!roomCode) return
    localStorage.setItem(NAME_KEY, name)
    setSession({ roomId: roomCode, isHost: pendingHost, name, isObserver })
  }

  const handleLeave = () => {
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
        onEnter={handleEnter}
        onCancel={handleLeave}
      />
    )
  }

  return <Home onCreate={handleCreate} onJoin={handleJoinExisting} />
}
