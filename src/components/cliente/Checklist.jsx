import { useState } from 'react'
import Icone from '../Icone'

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

// Lista de itens marcáveis. Controlada: recebe os itens e devolve a lista nova em onChange.
export default function Checklist({ itens, onChange, mostrarMarcar = true }) {
  const [novo, setNovo] = useState('')
  const feitos = itens.filter((i) => i.feito).length

  function adicionar(e) {
    e.preventDefault()
    if (!novo.trim()) return
    onChange([...itens, { id: novoId(), texto: novo.trim(), feito: false }])
    setNovo('')
  }

  const alternar = (id) => onChange(itens.map((i) => (i.id === id ? { ...i, feito: !i.feito } : i)))
  const remover = (id) => onChange(itens.filter((i) => i.id !== id))
  const renomear = (id, texto) => {
    const item = itens.find((i) => i.id === id)
    if (!texto.trim() || texto.trim() === item.texto) return
    onChange(itens.map((i) => (i.id === id ? { ...i, texto: texto.trim() } : i)))
  }

  return (
    <div className="checklist">
      {mostrarMarcar && itens.length > 0 && (
        <div className="checklist-progresso">
          <div className="barra-proporcao"><span style={{ width: `${(feitos / itens.length) * 100}%` }} /></div>
          <small className="texto-suave">{feitos}/{itens.length}</small>
        </div>
      )}
      <ul>
        {itens.map((i) => (
          <li key={i.id} className={i.feito ? 'feito' : ''}>
            {mostrarMarcar && (
              <input type="checkbox" checked={i.feito} onChange={() => alternar(i.id)} aria-label={`Marcar “${i.texto}”`} />
            )}
            <input
              className="entrada-simples"
              defaultValue={i.texto}
              onBlur={(e) => renomear(i.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              aria-label="Item do checklist"
            />
            <button type="button" className="botao-icone mini" onClick={() => remover(i.id)} aria-label={`Remover “${i.texto}”`}>
              <Icone nome="fechar" tamanho={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="linha-form">
        <input
          className="entrada-simples"
          placeholder="Novo item"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar(e)}
        />
        <button type="button" className="botao botao-secundario botao-pequeno" onClick={adicionar} disabled={!novo.trim()}>
          <Icone nome="mais" tamanho={16} /> Adicionar
        </button>
      </div>
    </div>
  )
}
