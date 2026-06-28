import { fmt, type VoteStats } from '../stats'
import type { Deck } from '../types'

interface Props {
  deck: Deck
  stats: VoteStats
}

export default function Results({ stats }: Props) {
  const max = Math.max(1, ...stats.histogram.map((b) => b.count))

  return (
    <section className="results card-panel" aria-label="Results">
      {stats.consensus && stats.count > 1 && (
        <div className="consensus-banner">🎉 Consensus!</div>
      )}

      <div className="stat-row">
        <Stat label="Average" value={fmt(stats.average)} />
        <Stat label="Median" value={fmt(stats.median)} />
        <Stat
          label="Spread"
          value={stats.low != null && stats.high != null ? `${stats.low} – ${stats.high}` : '–'}
        />
        <Stat label="Votes" value={String(stats.count)} />
      </div>

      <div className="histogram" role="img" aria-label="Vote distribution">
        {stats.histogram.map((b) => (
          <div className="histogram-col" key={b.value}>
            <div className="histogram-bar-wrap">
              <span className="histogram-count">{b.count}</span>
              <div
                className="histogram-bar"
                style={{ height: `${(b.count / max) * 100}%` }}
              />
            </div>
            <div className="histogram-label">{b.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
