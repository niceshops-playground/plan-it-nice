import { useCallback, useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import type {
  ClientMessage,
  ConnectionStatus,
  DeckId,
  HostMessage,
  Participant,
  PeerMessage,
  RoomState,
} from '../types'

/**
 * Topology: a star. The peer that creates a room is the *host* and owns the
 * authoritative {@link RoomState}; every other peer is a *client* that connects
 * to the host and renders whatever state the host broadcasts. All actions flow
 * client → host; the host applies them and rebroadcasts. Votes are kept on the
 * host and only shipped to clients once a round is revealed.
 *
 * No TURN: we rely on the public PeerJS broker plus public STUN servers, which
 * is enough for most networks but will fail behind symmetric NATs.
 */

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
}

/** Namespace prefix so our room codes don't collide with other apps that use
 *  the same public broker. The full PeerJS id is `pin<ROOMCODE>`. */
const PEER_PREFIX = 'pin'
const peerIdFor = (roomId: string) => PEER_PREFIX + roomId

export interface RoomConfig {
  roomId: string
  isHost: boolean
  name: string
  isObserver: boolean
}

export interface RoomApi {
  status: ConnectionStatus
  state: RoomState | null
  selfId: string | null
  isHost: boolean
  /** The current peer's own vote, tracked locally for instant card feedback. */
  selfVote: string | null
  error: string | null
  vote: (value: string) => void
  retract: () => void
  reveal: () => void
  reset: () => void
  setDeck: (deckId: DeckId) => void
  setTopic: (topic: string) => void
  setObserver: (isObserver: boolean) => void
  rename: (name: string) => void
}

interface Member {
  id: string
  name: string
  isObserver: boolean
  vote: string | null
  conn: DataConnection | null
}

export function usePeerRoom(config: RoomConfig): RoomApi {
  const { roomId, isHost } = config

  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [state, setState] = useState<RoomState | null>(null)
  const [selfId, setSelfId] = useState<string | null>(null)
  const [selfVote, setSelfVote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Initial identity is captured once; later changes go through actions so we
  // never tear down the peer connection.
  const initial = useRef(config)
  const peerRef = useRef<Peer | null>(null)
  const hostConnRef = useRef<DataConnection | null>(null) // client → host link

  // Host-only authoritative model.
  const membersRef = useRef<Map<string, Member>>(new Map())
  const metaRef = useRef({ topic: '', deckId: 'fibonacci' as DeckId, revealed: false, round: 1 })

  // Reset the local vote highlight whenever a new round starts.
  const lastRoundRef = useRef(1)
  useEffect(() => {
    if (state && state.round !== lastRoundRef.current) {
      lastRoundRef.current = state.round
      setSelfVote(null)
    }
  }, [state])

  /* ----------------------------- host helpers ----------------------------- */

  const buildPublicState = useCallback((): RoomState => {
    const m = metaRef.current
    const participants: Participant[] = [...membersRef.current.values()].map((mem) => ({
      id: mem.id,
      name: mem.name,
      isObserver: mem.isObserver,
      hasVoted: mem.vote != null,
      vote: m.revealed ? mem.vote : null,
    }))
    return {
      roomId,
      topic: m.topic,
      deckId: m.deckId,
      revealed: m.revealed,
      round: m.round,
      participants,
    }
  }, [roomId])

  const commit = useCallback(() => {
    const next = buildPublicState()
    const msg: HostMessage = { type: 'state', state: next }
    for (const mem of membersRef.current.values()) {
      if (mem.conn && mem.conn.open) {
        try {
          mem.conn.send(msg)
        } catch {
          /* a dead channel will be cleaned up on its close/error event */
        }
      }
    }
    setState(next)
  }, [buildPublicState])

  const handleClientMessage = useCallback(
    (fromId: string, msg: ClientMessage) => {
      const members = membersRef.current
      const meta = metaRef.current
      const mem = members.get(fromId)

      switch (msg.type) {
        case 'hello': {
          members.set(fromId, {
            id: fromId,
            name: msg.name?.trim() || 'Guest',
            isObserver: !!msg.isObserver,
            vote: null,
            conn: mem?.conn ?? null,
          })
          break
        }
        case 'vote': {
          if (mem && !mem.isObserver) mem.vote = msg.value
          break
        }
        case 'retract': {
          if (mem) mem.vote = null
          break
        }
        case 'reveal': {
          meta.revealed = true
          break
        }
        case 'reset': {
          meta.revealed = false
          meta.round += 1
          for (const m of members.values()) m.vote = null
          break
        }
        case 'setDeck': {
          meta.deckId = msg.deckId
          // Switching decks invalidates in-flight votes.
          meta.revealed = false
          for (const m of members.values()) m.vote = null
          break
        }
        case 'setTopic': {
          meta.topic = msg.topic
          break
        }
        case 'setObserver': {
          if (mem) {
            mem.isObserver = msg.isObserver
            if (msg.isObserver) mem.vote = null
          }
          break
        }
        case 'rename': {
          if (mem) mem.name = msg.name?.trim() || mem.name
          break
        }
      }
      commit()
    },
    [commit],
  )

  /* ------------------------------ lifecycle ------------------------------- */

  useEffect(() => {
    const me = initial.current
    const members = membersRef.current
    let disposed = false

    const peer = isHost
      ? new Peer(peerIdFor(roomId), { config: RTC_CONFIG, debug: 1 })
      : new Peer({ config: RTC_CONFIG, debug: 1 })
    peerRef.current = peer

    const registerHostConnection = (conn: DataConnection) => {
      conn.on('data', (data) => handleClientMessage(conn.peer, data as ClientMessage))
      conn.on('open', () => {
        const existing = membersRef.current.get(conn.peer)
        if (existing) existing.conn = conn
        else
          membersRef.current.set(conn.peer, {
            id: conn.peer,
            name: 'Guest',
            isObserver: false,
            vote: null,
            conn,
          })
        commit()
      })
      const drop = () => {
        membersRef.current.delete(conn.peer)
        commit()
      }
      conn.on('close', drop)
      conn.on('error', drop)
    }

    peer.on('open', (id) => {
      if (disposed) return
      setSelfId(id)
      if (isHost) {
        // Seed the host as the first member.
        membersRef.current.set(id, {
          id,
          name: me.name,
          isObserver: me.isObserver,
          vote: null,
          conn: null,
        })
        metaRef.current.deckId = 'fibonacci'
        setStatus('connected')
        commit()
      } else {
        const conn = peer.connect(peerIdFor(roomId), { reliable: true })
        hostConnRef.current = conn
        conn.on('open', () => {
          if (disposed) return
          setStatus('connected')
          const hello: ClientMessage = {
            type: 'hello',
            name: me.name,
            isObserver: me.isObserver,
          }
          conn.send(hello)
        })
        conn.on('data', (data) => {
          const msg = data as PeerMessage
          if (msg.type === 'state') setState(msg.state)
        })
        conn.on('close', () => !disposed && setStatus('closed'))
        conn.on('error', () => !disposed && setStatus('error'))
      }
    })

    if (isHost) peer.on('connection', registerHostConnection)

    peer.on('disconnected', () => {
      if (disposed) return
      setStatus('reconnecting')
      // Reconnect to the broker (does not re-establish data channels, but lets
      // the host accept new joiners again).
      try {
        peer.reconnect()
      } catch {
        /* ignore */
      }
    })

    peer.on('error', (err: Error & { type?: string }) => {
      if (disposed) return
      const type = err.type
      if (type === 'unavailable-id') {
        setError('That room code is already taken. Try creating a new room.')
      } else if (type === 'peer-unavailable') {
        setError('Room not found. Double-check the code, or the host may have left.')
      } else if (type === 'browser-incompatible') {
        setError('This browser does not support WebRTC. Try a recent Chrome, Edge, or Firefox.')
      } else if (type === 'network' || type === 'socket-error' || type === 'server-error') {
        setError('Lost connection to the signalling server. Retrying…')
      } else {
        setError(err.message || 'Connection error.')
      }
      setStatus('error')
    })

    return () => {
      disposed = true
      hostConnRef.current?.close()
      peer.destroy()
      peerRef.current = null
      members.clear()
    }
    // We intentionally key the effect only on the room identity. Name/observer
    // changes are handled by actions, not by reconnecting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost])

  /* ------------------------------- actions -------------------------------- */

  // For the host, an action mutates the authoritative model directly. For a
  // client, it sends a message and lets the host echo the new state back.
  const send = useCallback(
    (msg: ClientMessage) => {
      if (isHost) {
        handleClientMessage(selfId ?? '', msg)
      } else {
        const conn = hostConnRef.current
        if (conn && conn.open) conn.send(msg)
      }
    },
    [isHost, selfId, handleClientMessage],
  )

  const vote = useCallback(
    (value: string) => {
      setSelfVote(value)
      send({ type: 'vote', value })
    },
    [send],
  )

  const retract = useCallback(() => {
    setSelfVote(null)
    send({ type: 'retract' })
  }, [send])

  const reveal = useCallback(() => send({ type: 'reveal' }), [send])
  const reset = useCallback(() => send({ type: 'reset' }), [send])
  const setDeck = useCallback((deckId: DeckId) => send({ type: 'setDeck', deckId }), [send])
  const setTopic = useCallback((topic: string) => send({ type: 'setTopic', topic }), [send])
  const rename = useCallback((name: string) => send({ type: 'rename', name }), [send])
  const setObserver = useCallback(
    (isObserver: boolean) => {
      if (isObserver) setSelfVote(null)
      send({ type: 'setObserver', isObserver })
    },
    [send],
  )

  return {
    status,
    state,
    selfId,
    isHost,
    selfVote,
    error,
    vote,
    retract,
    reveal,
    reset,
    setDeck,
    setTopic,
    setObserver,
    rename,
  }
}
