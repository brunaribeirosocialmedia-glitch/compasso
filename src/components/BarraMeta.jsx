import { situacaoMeta } from '../lib/metas'

// Barra de progresso até a meta. A marca "hoje" mostra onde seria bom
// estar a esta altura do mês. Sem "detalhe", não exibe nenhum valor.
export default function BarraMeta({ atual, meta, esperado, detalhe }) {
  const s = situacaoMeta(atual, meta, esperado)
  return (
    <div className={`barra-meta meta-${s.chave}`}>
      <div className="barra-meta-topo">
        <span className="selo-meta">{s.nome}</span>
        {detalhe && <span className="texto-suave">{detalhe}</span>}
      </div>
      <div className="barra-meta-trilho" role="img" aria-label={s.nome}>
        <span className="barra-meta-preenchida" style={{ width: `${Math.min(s.fracao, 1) * 100}%` }} />
        {esperado > 0 && esperado < 1 && (
          <span className="barra-meta-ritmo" style={{ left: `${esperado * 100}%` }} title="Onde seria bom estar hoje" />
        )}
      </div>
    </div>
  )
}
