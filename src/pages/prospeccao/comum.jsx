export const STATUS = {
  frio: 'Frio',
  morno: 'Morno',
  quente: 'Quente',
}

export function SeloStatus({ status }) {
  return <span className={`selo-status status-${status}`}>{STATUS[status]}</span>
}

// Botões Frio / Morno / Quente
export function EscolhaStatus({ valor, onChange }) {
  return (
    <div className="escolha-status" role="radiogroup" aria-label="Status">
      {Object.entries(STATUS).map(([v, nome]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          className={`selo-status status-${v} ${valor === v ? 'marcado' : ''}`}
          onClick={() => onChange(v)}
        >
          {nome}
        </button>
      ))}
    </div>
  )
}
