import { SITUACOES_TAREFA } from '../lib/datas'

// Legenda das cores de evento e tarefas, igual nos dois calendários
export default function LegendaTarefas() {
  return (
    <div className="legenda-tarefas">
      <span className="legenda"><i className="ponto ponto-evento" /> Evento</span>
      {Object.entries(SITUACOES_TAREFA).map(([chave, nome]) => (
        <span key={chave} className="legenda"><i className={`ponto tarefa-${chave}`} /> {nome}</span>
      ))}
    </div>
  )
}
