import type { Card } from '../types'

interface Props {
  cards: Card[]
  selected: string | null
  disabled: boolean
  onPick: (value: string) => void
}

export default function CardGrid({ cards, selected, disabled, onPick }: Props) {
  return (
    <section className="card-grid" aria-label="Estimation cards">
      {cards.map((card) => {
        const isSelected = selected === card.value
        return (
          <button
            key={card.value}
            type="button"
            className={`poker-card${isSelected ? ' is-selected' : ''}`}
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onPick(card.value)}
          >
            <span className="poker-card-value">{card.label}</span>
          </button>
        )
      })}
    </section>
  )
}
