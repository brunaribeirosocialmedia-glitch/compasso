import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useTempoReal } from '../../lib/useTempoReal'
import { useAuth } from '../../contexts/AuthContext'
import { useCliente } from '../../pages/AreaCliente'
import { formatarData, situacaoPrazo } from '../../lib/datas'
import { PRIORIDADES } from '../../lib/cores'
import Icone from '../Icone'
import TarefaModal from './TarefaModal'
import EditarColunas from './EditarColunas'

const ESPACO = 1024

// Calcula a posição (ordem) para inserir entre dois cartões
function ordemEntre(anterior, seguinte) {
  if (anterior != null && seguinte != null) return (anterior + seguinte) / 2
  if (anterior != null) return anterior + ESPACO
  if (seguinte != null) return seguinte - ESPACO
  return ESPACO
}

function Avatar({ pessoa }) {
  if (!pessoa) return null
  return (
    <span className="avatar avatar-mini" title={pessoa.nome || pessoa.email}>
      {(pessoa.nome || pessoa.email).charAt(0).toUpperCase()}
    </span>
  )
}

function CartaoTarefa({ tarefa, pessoa, aoAbrir, aoArrastar, fantasma }) {
  const situacao = situacaoPrazo(tarefa.prazo, tarefa.concluida_em)
  return (
    <article
      className={`cartao-tarefa ${tarefa.concluida_em ? 'concluida' : ''} ${fantasma ? 'fantasma' : ''}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', tarefa.id); e.dataTransfer.effectAllowed = 'move'; aoArrastar(tarefa.id) }}
      onDragEnd={() => aoArrastar(null)}
      onClick={() => aoAbrir(tarefa)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && aoAbrir(tarefa)}
    >
      {tarefa.prioridade && tarefa.prioridade !== 'baixa' && (
        <span className={`prioridade prioridade-${tarefa.prioridade}`}>{PRIORIDADES[tarefa.prioridade]}</span>
      )}
      <p className="cartao-tarefa-titulo">{tarefa.titulo}</p>
      {tarefa.etiquetas?.length > 0 && (
        <div className="etiquetas">
          {tarefa.etiquetas.map((e) => <span key={e} className="etiqueta-mini">{e}</span>)}
        </div>
      )}
      {(tarefa.prazo || pessoa) && (
        <div className="cartao-tarefa-rodape">
          {tarefa.prazo ? (
            <span className={`prazo ${situacao}`}>
              <Icone nome="calendario" tamanho={13} /> {situacao === 'hoje' ? 'Hoje' : formatarData(tarefa.prazo)}
            </span>
          ) : <span />}
          <Avatar pessoa={pessoa} />
        </div>
      )}
    </article>
  )
}

function NovaTarefaRapida({ aoCriar }) {
  const [aberta, setAberta] = useState(false)
  const [titulo, setTitulo] = useState('')

  async function enviar(e) {
    e.preventDefault()
    if (!titulo.trim()) return
    await aoCriar(titulo.trim())
    setTitulo('')
  }

  if (!aberta) {
    return (
      <button className="adicionar-tarefa" onClick={() => setAberta(true)}>
        <Icone nome="mais" tamanho={16} /> Adicionar tarefa
      </button>
    )
  }
  return (
    <form className="nova-tarefa" onSubmit={enviar}>
      <textarea
        autoFocus
        rows={2}
        placeholder="Título da tarefa"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) enviar(e)
          if (e.key === 'Escape') setAberta(false)
        }}
        onBlur={() => !titulo.trim() && setAberta(false)}
      />
      <div className="nova-tarefa-acoes">
        <button className="botao botao-principal botao-pequeno">Adicionar</button>
        <button type="button" className="botao-link" onClick={() => setAberta(false)}>Cancelar</button>
      </div>
    </form>
  )
}

export default function Tarefas() {
  const { cliente, pessoas } = useCliente()
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [colunas, setColunas] = useState([])
  const [tarefas, setTarefas] = useState(null)
  const [arrastando, setArrastando] = useState(null)
  const [alvo, setAlvo] = useState(null)          // { coluna, indice }
  const [editandoColunas, setEditandoColunas] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroPessoa, setFiltroPessoa] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from('tarefa_colunas').select('*').eq('cliente_id', cliente.id).order('ordem'),
      supabase.from('tarefas').select('*').eq('cliente_id', cliente.id).order('ordem'),
    ])
    setColunas(c || [])
    setTarefas(t || [])
  }, [cliente.id])

  useEffect(() => { carregar() }, [carregar])
  useTempoReal(['tarefas', 'tarefa_colunas'], cliente.id, carregar)

  const pessoaPorId = useMemo(() => Object.fromEntries(pessoas.map((p) => [p.id, p])), [pessoas])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (tarefas || []).filter((t) =>
      (!termo || t.titulo.toLowerCase().includes(termo) || t.etiquetas?.some((e) => e.toLowerCase().includes(termo))) &&
      (!filtroPessoa || (filtroPessoa === 'ninguem' ? !t.responsavel_id : t.responsavel_id === filtroPessoa))
    )
  }, [tarefas, busca, filtroPessoa])

  const tarefaAberta = tarefas?.find((t) => t.id === params.get('tarefa'))
  const abrir = (t) => setParams({ tarefa: t.id })
  const fechar = () => setParams({})

  async function criar(coluna, titulo) {
    const daColuna = tarefas.filter((t) => t.coluna_id === coluna.id)
    const ordem = ordemEntre(daColuna.at(-1)?.ordem, null)
    const { data, error } = await supabase
      .from('tarefas')
      .insert({ cliente_id: cliente.id, coluna_id: coluna.id, titulo, ordem })
      .select().single()
    if (error) return setErro(traduzirErro(error))
    setTarefas((atual) => [...atual, data])
  }

  function aoPassar(e, coluna) {
    e.preventDefault()
    const cartoes = [...e.currentTarget.querySelectorAll('.cartao-tarefa:not(.fantasma)')]
    const indice = cartoes.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return e.clientY < r.top + r.height / 2
    })
    const novo = { coluna: coluna.id, indice: indice === -1 ? cartoes.length : indice }
    if (alvo?.coluna !== novo.coluna || alvo?.indice !== novo.indice) setAlvo(novo)
  }

  async function aoSoltar(e, coluna) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || arrastando
    setAlvo(null)
    setArrastando(null)
    const tarefa = tarefas.find((t) => t.id === id)
    if (!tarefa || !alvo) return

    // posição calculada sobre a lista visível da coluna, sem a própria tarefa
    const visiveis = filtradas.filter((t) => t.coluna_id === coluna.id && t.id !== id)
    const indice = Math.min(alvo.indice, visiveis.length)
    const ordem = ordemEntre(visiveis[indice - 1]?.ordem, visiveis[indice]?.ordem)
    if (tarefa.coluna_id === coluna.id && tarefa.ordem === ordem) return

    const concluida = coluna.marca_concluida
    setTarefas((atual) => atual
      .map((t) => t.id === id
        ? { ...t, coluna_id: coluna.id, ordem, concluida_em: concluida ? (t.concluida_em || new Date().toISOString()) : null }
        : t)
      .sort((a, b) => a.ordem - b.ordem))
    const { error } = await supabase.from('tarefas').update({ coluna_id: coluna.id, ordem }).eq('id', id)
    if (error) { setErro(traduzirErro(error)); carregar() }
  }

  if (tarefas === null) return <p className="texto-suave recuo">Carregando…</p>

  return (
    <div className="tarefas">
      <div className="barra-ferramentas">
        <label className="busca">
          <Icone nome="busca" tamanho={16} />
          <input placeholder="Buscar tarefa ou etiqueta" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <select value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)} aria-label="Filtrar por responsável">
          <option value="">Todos os responsáveis</option>
          <option value={session.user.id}>Minhas tarefas</option>
          {pessoas.filter((p) => p.id !== session.user.id).map((p) => (
            <option key={p.id} value={p.id}>{p.nome || p.email}</option>
          ))}
          <option value="ninguem">Sem responsável</option>
        </select>
        <button className="botao botao-secundario botao-pequeno" onClick={() => setEditandoColunas(true)}>
          <Icone nome="config" tamanho={16} /> Colunas
        </button>
      </div>

      {erro && <p className="alerta alerta-erro recuo" onClick={() => setErro('')}>{erro}</p>}

      <div className="board">
        {colunas.map((coluna) => {
          const lista = filtradas.filter((t) => t.coluna_id === coluna.id)
          const ativa = arrastando && alvo?.coluna === coluna.id
          return (
            <section
              key={coluna.id}
              className={`coluna ${ativa ? 'recebendo' : ''}`}
              onDragOver={(e) => aoPassar(e, coluna)}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setAlvo(null)}
              onDrop={(e) => aoSoltar(e, coluna)}
            >
              <header className="coluna-topo">
                {coluna.cor && <span className="coluna-cor" style={{ background: coluna.cor }} />}
                <h3>{coluna.nome}</h3>
                <span className="contador">{lista.length}</span>
              </header>
              <div className="coluna-cartoes">
                {(() => {
                  // índices contam só os cartões que não estão sendo arrastados
                  let k = 0
                  const itens = lista.map((t) => {
                    const fantasma = t.id === arrastando
                    const marcador = !fantasma && ativa && alvo.indice === k
                    if (!fantasma) k++
                    return (
                      <div key={t.id} className="cartao-envoltorio">
                        {marcador && <div className="marcador-soltar" />}
                        <CartaoTarefa
                          tarefa={t}
                          fantasma={fantasma}
                          pessoa={pessoaPorId[t.responsavel_id]}
                          aoAbrir={abrir}
                          aoArrastar={setArrastando}
                        />
                      </div>
                    )
                  })
                  return (
                    <>
                      {itens}
                      {ativa && alvo.indice >= k && <div className="marcador-soltar" />}
                    </>
                  )
                })()}
              </div>
              <NovaTarefaRapida aoCriar={(titulo) => criar(coluna, titulo)} />
            </section>
          )
        })}
      </div>

      {tarefaAberta && (
        <TarefaModal
          tarefa={tarefaAberta}
          colunas={colunas}
          pessoas={pessoas}
          aoFechar={fechar}
          aoSalvar={(nova) => setTarefas((atual) => atual.map((t) => (t.id === nova.id ? nova : t)))}
          aoExcluir={(id) => { setTarefas((atual) => atual.filter((t) => t.id !== id)); fechar() }}
        />
      )}
      {editandoColunas && (
        <EditarColunas colunas={colunas} tarefas={tarefas} aoFechar={() => setEditandoColunas(false)} aoMudar={carregar} />
      )}
    </div>
  )
}
