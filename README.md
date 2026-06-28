# Plan It Nice

**Serverless, peer-to-peer planning poker for agile estimation.** No backend, no
accounts, no data stored anywhere — votes travel directly between browsers over
WebRTC. Share a room link and estimate together in real time.

Built with React 19 + Vite + TypeScript as an installable PWA, styled in the
niceshops orange.

## Features

- 🃏 **Four decks** — Fibonacci, Modified Fibonacci, T-shirt sizes, Powers of 2
  (each with `?` and ☕ cards).
- 🙈 **Hidden votes** — nobody sees anyone else's card until you reveal.
- 📊 **Reveal stats** — average, median, spread (low–high), vote count, a
  distribution histogram, and a consensus celebration when everyone agrees.
- 🃏 **Poker table** — everyone gets a seat; cards sit face-down (with names)
  until the reveal, then flip face-up together.
- 🎉 **Throw emojis** — tap a player to fling 👍🎉🔥❤️😂🤔🐢🚀 at their seat.
- 🔁 **Rounds** — reset and re-estimate as many times as you like.
- 👀 **Observers** — facilitators and stakeholders can watch without voting.
- 🔒 **Reveal policy** — the host can let anyone flip the cards (default) or
  lock reveal / new round / deck changes to the host only.
- 💾 **Survives a reload** — your name/observer choice is remembered, and a
  reload drops you back into the same room; a host that reloads reclaims the
  same room code and keeps the topic, deck, round, and settings.
- 🔗 **Just a link** — one peer hosts the room; everyone else joins via the
  shared code/link.
- 📱 **Installable PWA** — works offline as an app shell and installs to your
  home screen / desktop.

## How it works

Plan It Nice has **no server of its own**. It uses
[PeerJS](https://peerjs.com/) over WebRTC in a **star topology**:

- The person who creates a room is the **host** and owns the authoritative room
  state.
- Everyone else is a **client** that connects directly to the host.
- Actions (votes, reveal, new round, deck changes) flow from clients to the
  host, which applies them and broadcasts the updated state back out.
- Votes are held on the host and only sent to clients **after** a round is
  revealed.

Signalling uses the **public PeerJS broker** and **public Google/Twilio STUN**
servers. There is intentionally **no TURN server** configured (see
[Limitations](#limitations)).

> The room lives in the host's browser tab. The host can safely **reload** — it
> reclaims the same room code (`pin<CODE>`) and clients reconnect automatically,
> with the topic/deck/round/settings restored from sessionStorage (in-flight
> votes for the current round are dropped). But if the host fully **closes** the
> tab, the room ends. For a long session, keep the host tab open.

## Getting started

Requirements: Node.js 20+.

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build      # type-check and produce a production build in dist/
npm run preview    # preview the production build locally
npm run typecheck  # type-check only
npm run lint       # run ESLint
npm run format     # run Prettier
```

## Deploying to GitHub Pages

This repo ships a GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that builds the
app and publishes `dist/` to GitHub Pages on every push to `main`.

**Enable Pages once, in the repository settings:**

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or re-run the **Deploy to GitHub Pages** workflow from the
   **Actions** tab). When it finishes, your site is live at
   **`https://<owner>.github.io/plan-it-nice/`**.

The Vite `base` is set to `/plan-it-nice/` to match that path. If you serve the
app from a different path (e.g. a custom domain at the root), build with
`VITE_BASE=/ npm run build`.

## Limitations

- **No TURN server.** WebRTC will fail to connect between some networks behind
  symmetric NATs or strict corporate firewalls. To support those, add a TURN
  server to the `iceServers` list in
  [`src/peer/usePeerRoom.ts`](src/peer/usePeerRoom.ts).
- **Host-dependent room.** State lives in the host's tab. A host *reload* is
  recovered (same room code reclaimed, settings restored, clients reconnect),
  but if the host *closes* the tab the room ends.
- **Public broker.** Signalling uses the shared public PeerJS broker, which is
  best-effort and unauthenticated. Room codes are random and namespaced, but
  this is not a security boundary — don't put secrets in topic names.

## Tech

React 19 · Vite 6 · TypeScript · PeerJS (WebRTC) · vite-plugin-pwa ·
GitHub Actions · Dependabot.

## License

MIT
