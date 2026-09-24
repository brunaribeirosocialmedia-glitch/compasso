import { useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useCliente } from '../../pages/AreaCliente'
import Modal from '../Modal'
import Icone from '../Icone'

export default function EditarColunas({ colunas, tarefas, aoFechar, aoMudar }) {
  const { cliente } = useCliente()
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState('')

  async function executar(promessa) {
    setErro('')
    const { error } = await promessa
    if (error) setErro(traduzirErro(error))
    aoMudar()
  }

  const renomear = (c, nome) => nome.trim() && nome !== c.nome &&
    executar(supabase.from('tarefa_colunas').update({ nome: nome.trim() }).eq('id', c.id))

  const alternarConcluida = (c) =>
    executar(supabase.from('tarefa_colunas').update({ marca_concluida: !c.marca_concluida }).eq('id', c.id))

  async function mover(indice, direcao) {
    const a = colunas[indice]
    const b = colunas[indice + direcao]
    if (!b) return
    await executar(Promise.all([
      supabase.from('tarefa_colunas').update({ ordem: b.ordem }).eq('id', a.id),
      supabase.from('tarefa_colunas').update({ ordem: a.ordem }).eq('id', b.id),
    ]).then((r) => r.find((x) => x.error) || { error: null }))
  }

  function excluir(c) {
    const qtd = tarefas.filter((t) => t.coluna_id === c.id).length
    if (qtd > 0) return setErro(`“${c.nome}” ainda tem ${qtd} tarefa(s). Mova-as para outra coluna antes de excluir.`)
    if (colunas.length === 1) return setErro('O board precisa de pelo menos uma coluna.')
    executar(supabase.from('tarefa_colunas').delete().eq('id', c.id))
  }

  async function adicionar(e) {
    e.preventDefault()
    if (!nova.trim()) return
    await executar(supabase.from('tarefa_colunas').insert({ cliente_id: cliente.id, nome: nova.trim() }))
    setNova('')
  }

  return (
    <Modal titulo="Colunas do board" aoFechar={aoFechar} largura={520}>
      <div className="formulario">
        <p className="texto-suave">
          Renomeie, reordene ou crie colunas. Tarefas movidas para uma coluna marcada como “conclui” ficam como concluídas.
        </p>
        <ul className="lista-colunas">
          {colunas.map((c, i) => (
            <li key={c.id}>
              <div className="ordem-botoes">
                <button className="botao-icone mini" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
                  <Icone nome="voltar" tamanho={14} />
                </button>
                <button className="botao-icone mini" onClick={() => mover(i, 1)} disabled={i === colunas.length - 1} aria-label="Descer">
                  <Icone nome="avancar" tamanho={14} />
                </button>
              </div>
              <input
                className="entrada-simples"
                defaultValue={c.nome}
                onBlur={(e) => renomear(c, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                aria-label="Nome da coluna"
              />
              <label className="marcar" title="Tarefas nesta coluna contam como concluídas">
                <input type="checkbox" checked={c.marca_concluida} onChange={() => alternarConcluida(c)} /> conclui
              </label>
              <button className="botao-icone mini" onClick={() => excluir(c)} aria-label={`Excluir ${c.nome}`}>
                <Icone nome="lixeira" tamanho={15} />
              </button>
            </li>
          ))}
        </ul>
        <form className="linha-form" onSubmit={adicionar}>
          <input className="entrada-simples" placeholder="Nova coluna" value={nova} onChange={(e) => setNova(e.target.value)} />
          <button className="botao botao-secundario botao-pequeno" disabled={!nova.trim()}>
            <Icone nome="mais" tamanho={16} /> Adicionar
          </button>
        </form>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </div>
    </Modal>
  )
}
