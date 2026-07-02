import { useState } from 'react'
import { fmt } from '../stats'
import type { RoundResult } from '../types'

/** Plain-text line for the clipboard export, e.g.
 *  "PROJ-128 — 5 (spread 3–8), agreed, 6 votes". */
function toLine(r: RoundResult): string {
  const label = r.topic || `Round ${r.round}`
  const spread =
    r.low != null && r.high != null && r.low !== r.high ? ` (spread ${r.low}–${r.high})` : ''
  const agreed = r.consensus ? ', agreed' : ''
  return `${label} — ${r.result}${spread}${agreed}, ${r.count} vote${r.count === 1 ? '' : 's'}`
}

export default function SessionLog({ history }: { history: RoundResult[] }) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  if (history.length === 0) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(history.map(toLine).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — non-fatal */
    }
  }

  return (
    <section className="session-log card-panel" aria-label="Session log">
      <div className="session-log-head">
        <button
          type="button"
          className="session-log-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '▾' : '▸'} Session log ({history.length})
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {open && (
        <ol className="session-log-list">
          {[...history].reverse().map((r) => (
            <li key={r.round} className="session-log-row">
              <span className="session-log-topic">{r.topic || `Round ${r.round}`}</span>
              <span className="session-log-result">
                {r.consensus && (
                  <span className="agree-badge" title="Consensus">
                    🎉
                  </span>
                )}
                <strong>{r.result}</strong>
                {r.average != null && <span className="muted"> · avg {fmt(r.average)}</span>}
                <span className="muted">
                  {' '}
                  · {r.count} vote{r.count === 1 ? '' : 's'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
