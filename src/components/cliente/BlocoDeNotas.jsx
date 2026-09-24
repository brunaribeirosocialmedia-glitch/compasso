import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useTempoReal } from '../../lib/useTempoReal'
import { useCliente } from '../../pages/AreaCliente'
import { CORES_NOTA } from '../../lib/cores'
import Modal, { BotaoExcluir } from '../Modal'
import Icone from '../Icone'

function EditorNota({ nota, aoFechar, aoMudar }) {
  const [titulo, setTitulo] = useState(nota.titulo || '')
  const [conteudo, setConteudo] = useState(nota.conteudo || '')
  const [estado, setEstado] = useState('salvo') // 'salvo' | 'salvando' | 'pendente' | 'erro'
  const [erro, setErro] = useState('')
  const [tarefaId, setTarefaId] = useState(nota.tarefa_id)
  const ultimo = useRef({ titulo: nota.titulo || '', conteudo: nota.conteudo || '' })

  // salva sozinho 800 ms depois da última digitação
  useEffect(() => {
    if (titulo === ultimo.current.titulo && conteudo === ultimo.current.conteudo) return
    setEstado('pendente')
    const t = setTimeout(async () => {
      setEstado('salvando')
      const { error } = await supabase.from('notas').update({ titulo: titulo.trim() || null, conteudo }).eq('id', nota.id)
      if (error) { setEstado('erro'); setErro(traduzirErro(error)); return }
      ultimo.current = { titulo, conteudo }
      setEstado('salvo')
      aoMudar()
    }, 800)
    return () => clearTimeout(t)
  }, [titulo, conteudo, nota.id, aoMudar])

  async function atualizar(campos) {
    const { error } = await supabase.from('notas').update(campos).eq('id', nota.id)
    if (error) setErro(traduzirErro(error))
    aoMudar()
  }

  async function virarTarefa() {
    const { data, error } = await supabase.rpc('converter_nota_em_tarefa', { p_nota_id: nota.id })
    if (error) return setErro(traduzirErro(error))
    setTarefaId(data)
    aoMudar()
  }

  async function excluir() {
    const { error } = await supabase.from('notas').delete().eq('id', nota.id)
    if (error) return setErro(traduzirErro(error))
    aoMudar()
    aoFechar()
  }

  // nota nova fechada sem nada escrito não fica ocupando espaço
  // e o que foi digitado no último segundo é salvo antes de fechar
  async function fechar() {
    if (!titulo.trim() && !conteudo.trim() && !tarefaId) {
      await supabase.from('notas').delete().eq('id', nota.id)
    } else if (titulo !== ultimo.current.titulo || conteudo !== ultimo.current.conteudo) {
      await supabase.from('notas').update({ titulo: titulo.trim() || null, conteudo }).eq('id', nota.id)
    }
    aoMudar()
    aoFechar()
  }

  return (
    <Modal
      titulo="Nota"
      aoFechar={fechar}
      largura={680}
      rodape={
        <>
          <BotaoExcluir aoConfirmar={excluir} texto="Excluir nota" />
          <span className="espaco" />
          <span className="texto-suave estado-salvamento">
            {{ salvo: 'Salvo', salvando: 'Salvando…', pendente: 'Editando…', erro: 'Erro ao salvar' }[estado]}
          </span>
          {tarefaId ? (
            <Link className="botao botao-secundario" to={`../tarefas?tarefa=${tarefaId}`}>Ver tarefa <Icone nome="seta" tamanho={16} /></Link>
          ) : (
            <button className="botao botao-principal" onClick={virarTarefa} disabled={estado !== 'salvo' || !(titulo.trim() || conteudo.trim())}>
              Transformar em tarefa
            </button>
          )}
        </>
      }
    >
      <div className="formulario">
        <input className="titulo-nota" placeholder="Título (opcional)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <textarea
          className="conteudo-nota"
          placeholder="Escreva livremente: ideias, rascunhos, referências…"
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          autoFocus={!nota.conteudo}
          rows={12}
        />
        <div className="linha-opcoes">
          <div className="seletor-cor">
            {CORES_NOTA.map((c) => (
              <button
                key={c.nome}
                type="button"
                className={`amostra-cor ${nota.cor === c.valor ? 'selecionada' : ''} ${c.valor ? '' : 'sem-cor'}`}
                style={c.valor ? { background: c.valor } : undefined}
                onClick={() => atualizar({ cor: c.valor })}
                title={c.nome}
                aria-label={`Cor ${c.nome}`}
              />
            ))}
          </div>
          <button className={`botao botao-pequeno ${nota.fixada ? 'botao-principal' : 'botao-secundario'}`} onClick={() => atualizar({ fixada: !nota.fixada })}>
            <Icone nome="alfinete" tamanho={15} /> {nota.fixada ? 'Fixada' : 'Fixar no topo'}
          </button>
        </div>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </div>
    </Modal>
  )
}

export default function BlocoDeNotas() {
  const { cliente, pessoas } = useCliente()
  const [notas, setNotas] = useState(null)
  const [abertaId, setAbertaId] = useState(null)
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('notas').select('*').eq('cliente_id', cliente.id)
      .order('fixada', { ascending: false }).order('atualizado_em', { ascending: false })
    setNotas(data || [])
  }, [cliente.id])

  useEffect(() => { carregar() }, [carregar])
  useTempoReal(['notas'], cliente.id, carregar)

  async function criar() {
    const { data, error } = await supabase.from('notas').insert({ cliente_id: cliente.id }).select().single()
    if (!error) {
      setNotas((atual) => [data, ...atual])
      setAbertaId(data.id)
    }
  }

  const termo = busca.trim().toLowerCase()
  const visiveis = (notas || []).filter((n) =>
    !termo || (n.titulo || '').toLowerCase().includes(termo) || n.conteudo.toLowerCase().includes(termo))
  const aberta = notas?.find((n) => n.id === abertaId)
  const autor = (id) => pessoas.find((p) => p.id === id)?.nome

  if (notas === null) return <p className="texto-suave recuo">Carregando…</p>

  return (
    <div className="bloco-notas">
      <div className="barra-ferramentas">
        <label className="busca">
          <Icone nome="busca" tamanho={16} />
          <input placeholder="Buscar nas notas" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <span className="espaco" />
        <button className="botao botao-principal botao-pequeno" onClick={criar}>
          <Icone nome="mais" tamanho={16} /> Nova nota
        </button>
      </div>

      {visiveis.length === 0 ? (
        <div className="cartao vazio recuo">
          <p>{busca ? 'Nenhuma nota encontrada.' : 'O Bloco de Notas está vazio. Anote ideias soltas aqui antes de virarem tarefas.'}</p>
        </div>
      ) : (
        <div className="grade-notas">
          {visiveis.map((n) => (
            <button
              key={n.id}
              className="cartao nota"
              style={n.cor ? { '--cor-nota': n.cor } : undefined}
              data-cor={n.cor ? '' : undefined}
              onClick={() => setAbertaId(n.id)}
            >
              <div className="nota-topo">
                {n.titulo && <strong>{n.titulo}</strong>}
                {n.fixada && <span className="nota-fixada" title="Fixada"><Icone nome="alfinete" tamanho={14} /></span>}
              </div>
              <p className="nota-previa">{n.conteudo || <em className="texto-suave">Nota vazia</em>}</p>
              <div className="nota-rodape">
                <span>{new Date(n.atualizado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}{autor(n.autor_id) ? ` · ${autor(n.autor_id)}` : ''}</span>
                {n.tarefa_id && <span className="etiqueta-mini">virou tarefa</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {aberta && <EditorNota key={aberta.id} nota={aberta} aoFechar={() => setAbertaId(null)} aoMudar={carregar} />}
    </div>
  )
}
