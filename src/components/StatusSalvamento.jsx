import Icone from './Icone'

// Indicador do salvamento automático, no rodapé das janelas (usa o estado de useAutoSalvar)
export default function StatusSalvamento({ estado }) {
  return (
    <span className={`status-salvamento ${estado}`} aria-live="polite">
      {estado === 'salvo' && <><Icone nome="confirmar" tamanho={14} /> Tudo salvo</>}
      {estado === 'pendente' && 'Alterações não salvas…'}
      {estado === 'salvando' && 'Salvando…'}
      {estado === 'erro' && 'Não foi possível salvar'}
    </span>
  )
}
