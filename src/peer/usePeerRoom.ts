import { useCallback, useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import type {
  ClientMessage,
  ConnectionStatus,
  DeckId,
  HostMessage,
  Participant,
  PeerMessage,
  Reaction,
  RevealPolicy,
  RoomState,
  RoundResult,
} from '../types'
import { mayFacilitate } from '../facilitation'
import { parseRoomSettings } from '../room-url'
import { getDeck } from '../decks'
import { computeStats, fmt } from '../stats'

/**
 * Topology: a star. The peer that creates a room is the *host* and owns the
 * authoritative {@link RoomState}; every other peer is a *client* that connects
 * to the host and renders whatever state the host broadcasts. All actions flow
 * client → host; the host applies them and rebroadcasts. Votes are kept on the
 * host and only shipped to clients once a round is revealed.
 *
 * Hardening: the host id is derived from the room code (`pin<CODE>`), so a host
 * that reloads reclaims the same id and clients reconnect to it automatically.
 * The host snapshots its room-level settings to sessionStorage so a reload
 * resumes topic/deck/round/policy (in-flight votes are dropped). Clients retry
 * the host link with backoff instead of dying on the first drop.
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

const REACTION_TTL = 2200 // ms an emoji stays on screen
const MAX_RECONNECT_ATTEMPTS = 12

export interface RoomConfig {
  roomId: string
  isHost: boolean
  name: string
  isObserver: boolean
  isModerator: boolean
}

export interface RoomApi {
  status: ConnectionStatus
  state: RoomState | null
  selfId: string | null
  isHost: boolean
  /** The current peer's own vote, tracked locally for instant card feedback. */
  selfVote: string | null
  /** Emoji reactions currently in flight, for the table to animate. */
  reactions: Reaction[]
  error: string | null
  vote: (value: string) => void
  retract: () => void
  reveal: () => void
  reset: () => void
  setDeck: (deckId: DeckId) => void
  setTopic: (topic: string) => void
  setObserver: (isObserver: boolean) => void
  setModerator: (isModerator: boolean) => void
  setRevealPolicy: (policy: RevealPolicy) => void
  rename: (name: string) => void
  throwEmoji: (to: string, emoji: string) => void
}

interface Member {
  id: string
  name: string
  isObserver: boolean
  isModerator: boolean
  vote: string | null
  conn: DataConnection | null
}

interface RoomMeta {
  hostId: string
  topic: string
  deckId: DeckId
  revealed: boolean
  round: number
  revealPolicy: RevealPolicy
  history: RoundResult[]
}

/** Summarise the just-revealed round into a log entry, or null if nothing was
 *  voted (an empty round isn't worth logging). */
function summariseRound(meta: RoomMeta, members: Map<string, Member>): RoundResult | null {
  const participants = [...members.values()].map((m) => ({
    id: m.id,
    name: m.name,
    isObserver: m.isObserver,
    isModerator: m.isModerator,
    hasVoted: m.vote != null,
    vote: m.vote,
  }))
  const stats = computeStats(meta.deckId, participants)
  if (stats.count === 0) return null
  const result = stats.consensus
    ? (stats.histogram[0]?.label ?? '–')
    : stats.median != null
      ? fmt(stats.median)
      : '–'
  return {
    round: meta.round,
    topic: meta.topic.trim(),
    deck: getDeck(meta.deckId).name,
    count: stats.count,
    average: stats.average,
    median: stats.median,
    low: stats.low,
    high: stats.high,
    consensus: stats.consensus,
    result,
  }
}

const makeMember = (
  id: string,
  name: string,
  isObserver: boolean,
  isModerator: boolean,
  conn: DataConnection | null,
): Member => ({ id, name: name.trim() || 'Guest', isObserver, isModerator, vote: null, conn })

const clearVotes = (members: Map<string, Member>) => {
  for (const m of members.values()) m.vote = null
}

/** Settings the host persists so a reload resumes the room. Votes and the
 *  participant list are deliberately excluded — they rebuild on reconnect. */
type RoomSnapshot = Pick<RoomMeta, 'topic' | 'deckId' | 'round' | 'revealPolicy' | 'history'>
const snapshotKey = (roomId: string) => `pin:room:${roomId}`

function loadSnapshot(roomId: string): RoomSnapshot | null {
  try {
    const raw = sessionStorage.getItem(snapshotKey(roomId))
    return raw ? (JSON.parse(raw) as RoomSnapshot) : null
  } catch {
    return null
  }
}

export function usePeerRoom(config: RoomConfig): RoomApi {
  const { roomId, isHost } = config

  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [state, setState] = useState<RoomState | null>(null)
  const [selfId, setSelfId] = useState<string | null>(null)
  const [selfVote, setSelfVote] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [error, setError] = useState<string | null>(null)

  // Initial identity is captured once; later changes go through actions so we
  // never tear down the peer connection.
  const initial = useRef(config)
  const peerRef = useRef<Peer | null>(null)
  const hostConnRef = useRef<DataConnection | null>(null) // client → host link
  const reactionSeq = useRef(0)

  // Host-only authoritative model.
  const membersRef = useRef<Map<string, Member>>(new Map())
  const metaRef = useRef<RoomMeta>({
    hostId: '',
    topic: '',
    deckId: 'fibonacci',
    revealed: false,
    round: 1,
    revealPolicy: 'anyone',
    history: [],
  })

  // Reset the local vote highlight whenever a new round starts. Guarded so we
  // only setState on an actual round change (react-hooks forbids an
  // unconditional setState in an effect).
  const lastRoundRef = useRef(1)
  useEffect(() => {
    if (state && state.round !== lastRoundRef.current) {
      lastRoundRef.current = state.round
      setSelfVote(null)
    }
  }, [state])

  /* ----------------------------- reactions -------------------------------- */

  const pushReaction = useCallback((reaction: Reaction) => {
    setReactions((prev) => [...prev, reaction])
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reaction.id))
    }, REACTION_TTL)
  }, [])

  /* ----------------------------- host helpers ----------------------------- */

  const buildPublicState = useCallback((): RoomState => {
    const m = metaRef.current
    const participants: Participant[] = [...membersRef.current.values()].map((mem) => ({
      id: mem.id,
      name: mem.name,
      isObserver: mem.isObserver,
      isModerator: mem.isModerator,
      hasVoted: mem.vote != null,
      vote: m.revealed ? mem.vote : null,
    }))
    return {
      roomId,
      hostId: m.hostId,
      topic: m.topic,
      deckId: m.deckId,
      revealed: m.revealed,
      round: m.round,
      revealPolicy: m.revealPolicy,
      participants,
      history: m.history,
    }
  }, [roomId])

  const persistSnapshot = useCallback(() => {
    const m = metaRef.current
    const snap: RoomSnapshot = {
      topic: m.topic,
      deckId: m.deckId,
      round: m.round,
      revealPolicy: m.revealPolicy,
      history: m.history,
    }
    try {
      sessionStorage.setItem(snapshotKey(roomId), JSON.stringify(snap))
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
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
    persistSnapshot()
    setState(next)
  }, [buildPublicState, persistSnapshot])

  // Broadcast a host message to every open client channel.
  const broadcast = useCallback((msg: HostMessage) => {
    for (const mem of membersRef.current.values()) {
      if (mem.conn && mem.conn.open) {
        try {
          mem.conn.send(msg)
        } catch {
          /* ignore dead channel */
        }
      }
    }
  }, [])

  const handleClientMessage = useCallback(
    (fromId: string, msg: ClientMessage) => {
      const members = membersRef.current
      const meta = metaRef.current
      const mem = members.get(fromId)
      // Whether this sender may run the round under the current reveal policy.
      const mayRun =
        !!mem &&
        mayFacilitate(meta.revealPolicy, {
          isHost: fromId === meta.hostId,
          isModerator: mem.isModerator,
        })

      switch (msg.type) {
        case 'hello': {
          members.set(
            fromId,
            makeMember(fromId, msg.name, !!msg.isObserver, !!msg.isModerator, mem?.conn ?? null),
          )
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
          if (mayRun) meta.revealed = true
          break
        }
        case 'reset': {
          if (mayRun) {
            // Log the round we're closing (only if it was revealed with votes).
            if (meta.revealed) {
              const entry = summariseRound(meta, members)
              if (entry) meta.history = [...meta.history, entry].slice(-100)
            }
            meta.revealed = false
            meta.round += 1
            clearVotes(members)
          }
          break
        }
        case 'setDeck': {
          if (mayRun) {
            meta.deckId = msg.deckId
            // Switching decks invalidates in-flight votes.
            meta.revealed = false
            clearVotes(members)
          }
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
        case 'setModerator': {
          if (mem) mem.isModerator = msg.isModerator
          break
        }
        case 'rename': {
          if (mem) mem.name = msg.name?.trim() || mem.name
          break
        }
        case 'setRevealPolicy': {
          // Only the host governs who may facilitate.
          if (fromId === meta.hostId) meta.revealPolicy = msg.policy
          break
        }
        case 'throw': {
          // Relay the emoji to everyone (and surface it locally on the host).
          if (members.has(msg.to)) {
            reactionSeq.current += 1
            const reaction: Reaction = {
              id: `${fromId}-${reactionSeq.current}`,
              from: fromId,
              to: msg.to,
              emoji: msg.emoji,
            }
            broadcast({ type: 'reaction', reaction })
            pushReaction(reaction)
          }
          return // transient — no state change to commit
        }
      }
      commit()
    },
    [commit, broadcast, pushReaction],
  )

  /* ------------------------------ lifecycle ------------------------------- */

  useEffect(() => {
    const me = initial.current
    const members = membersRef.current
    let disposed = false
    let reconnectAttempts = 0
    const timers = new Set<ReturnType<typeof setTimeout>>()

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t)
        if (!disposed) fn()
      }, ms)
      timers.add(t)
    }

    const handleHostData = (peerId: string, data: unknown) =>
      handleClientMessage(peerId, data as ClientMessage)

    const registerHostConnection = (conn: DataConnection) => {
      conn.on('data', (data) => handleHostData(conn.peer, data))
      conn.on('open', () => {
        const existing = membersRef.current.get(conn.peer)
        if (existing) existing.conn = conn
        else membersRef.current.set(conn.peer, makeMember(conn.peer, 'Guest', false, false, conn))
        commit()
      })
      const drop = () => {
        membersRef.current.delete(conn.peer)
        commit()
      }
      conn.on('close', drop)
      conn.on('error', drop)
    }

    // Client: (re)open the data channel to the host, retrying with backoff.
    const connectToHost = (peer: Peer) => {
      if (disposed) return
      const conn = peer.connect(peerIdFor(roomId), { reliable: true })
      hostConnRef.current = conn
      conn.on('open', () => {
        if (disposed) return
        reconnectAttempts = 0
        setStatus('connected')
        setError(null)
        conn.send({
          type: 'hello',
          name: me.name,
          isObserver: me.isObserver,
          isModerator: me.isModerator,
        } satisfies ClientMessage)
      })
      conn.on('data', (data) => {
        const msg = data as PeerMessage
        if (msg.type === 'state') setState(msg.state)
        else if (msg.type === 'reaction') pushReaction(msg.reaction)
      })
      conn.on('close', () => scheduleReconnect(peer))
      conn.on('error', () => scheduleReconnect(peer))
    }

    const scheduleReconnect = (peer: Peer) => {
      if (disposed || isHost) return
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        setError('Lost connection to the room. The host may have closed it.')
        setStatus('error')
        return
      }
      reconnectAttempts += 1
      setStatus('reconnecting')
      const delay = Math.min(1000 * reconnectAttempts, 5000)
      later(() => connectToHost(peer), delay)
    }

    // Build the peer and wire it up. Re-runnable so the host can retry claiming
    // its id after a reload (the broker frees it a moment later).
    const start = () => {
      if (disposed) return
      const peer = isHost
        ? new Peer(peerIdFor(roomId), { config: RTC_CONFIG, debug: 1 })
        : new Peer({ config: RTC_CONFIG, debug: 1 })
      peerRef.current = peer

      peer.on('open', (id) => {
        if (disposed) return
        setSelfId(id)
        if (isHost) {
          const meta = metaRef.current
          meta.hostId = id
          const snap = loadSnapshot(roomId)
          if (snap) {
            // Resume settings from before the reload; start a clean round.
            meta.topic = snap.topic
            meta.deckId = snap.deckId
            meta.round = snap.round
            meta.revealPolicy = snap.revealPolicy
            meta.history = snap.history ?? []
            meta.revealed = false
          } else {
            // Fresh host: seed from any settings carried in the room link.
            const url = parseRoomSettings(window.location.hash)
            if (url.deckId) meta.deckId = url.deckId
            if (url.revealPolicy) meta.revealPolicy = url.revealPolicy
            if (url.topic) meta.topic = url.topic
          }
          lastRoundRef.current = meta.round
          membersRef.current.set(id, makeMember(id, me.name, me.isObserver, me.isModerator, null))
          setStatus('connected')
          commit()
        } else {
          connectToHost(peer)
        }
      })

      if (isHost) peer.on('connection', registerHostConnection)

      peer.on('disconnected', () => {
        if (disposed) return
        setStatus('reconnecting')
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
          // Host reload race: the old id hasn't been freed yet. Retry a few
          // times before giving up.
          if (isHost && reconnectAttempts < 6) {
            reconnectAttempts += 1
            setStatus('reconnecting')
            peer.destroy()
            later(start, 1200)
            return
          }
          setError('That room code is already taken. Try creating a new room.')
        } else if (type === 'peer-unavailable') {
          // Host not up yet — keep retrying the client link.
          if (!isHost) {
            scheduleReconnect(peer)
            return
          }
          setError('Room not found. Double-check the code, or the host may have left.')
        } else if (type === 'browser-incompatible') {
          setError('This browser does not support WebRTC. Try a recent Chrome, Edge, or Firefox.')
        } else if (type === 'network' || type === 'socket-error' || type === 'server-error') {
          setError('Lost connection to the signalling server. Retrying…')
          return // transient; PeerJS emits 'disconnected' and we reconnect
        } else {
          setError(err.message || 'Connection error.')
        }
        setStatus('error')
      })
    }

    start()

    return () => {
      disposed = true
      for (const t of timers) clearTimeout(t)
      hostConnRef.current?.close()
      peerRef.current?.destroy()
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
  const setRevealPolicy = useCallback(
    (policy: RevealPolicy) => send({ type: 'setRevealPolicy', policy }),
    [send],
  )
  const setObserver = useCallback(
    (isObserver: boolean) => {
      if (isObserver) setSelfVote(null)
      send({ type: 'setObserver', isObserver })
    },
    [send],
  )
  const setModerator = useCallback(
    (isModerator: boolean) => send({ type: 'setModerator', isModerator }),
    [send],
  )
  const throwEmoji = useCallback(
    (to: string, emoji: string) => send({ type: 'throw', to, emoji }),
    [send],
  )

  return {
    status,
    state,
    selfId,
    isHost,
    selfVote,
    reactions,
    error,
    vote,
    retract,
    reveal,
    reset,
    setDeck,
    setTopic,
    setObserver,
    setModerator,
    setRevealPolicy,
    rename,
    throwEmoji,
  }
}
