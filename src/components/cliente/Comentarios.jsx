import { useCallback, useEffect, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useTempoReal } from '../../lib/useTempoReal'
import { useAuth } from '../../contexts/AuthContext'
import Icone from '../Icone'

function quando(dataHora) {
  const d = new Date(dataHora)
  const hoje = new Date()
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === hoje.toDateString()) return `hoje, ${hora}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}, ${hora}`
}

export default function Comentarios({ tarefa, pessoas }) {
  const { session, permissoes } = useAuth()
  const [lista, setLista] = useState(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('tarefa_comentarios').select('*').eq('tarefa_id', tarefa.id).order('criado_em')
    setLista(data || [])
  }, [tarefa.id])

  useEffect(() => { carregar() }, [carregar])
  useTempoReal(['tarefa_comentarios'], tarefa.cliente_id, carregar)

  const nomeDe = (id) => {
    const p = pessoas.find((x) => x.id === id)
    return p ? (p.nome || p.email) : 'Alguém da equipe'
  }

  async function enviar() {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    setErro('')
    const { data, error } = await supabase
      .from('tarefa_comentarios')
      .insert({ tarefa_id: tarefa.id, cliente_id: tarefa.cliente_id, texto: texto.trim() })
      .select().single()
    setEnviando(false)
    if (error) return setErro(traduzirErro(error))
    setLista((atual) => [...(atual || []), data])
    setTexto('')
  }

  async function excluir(id) {
    setLista((atual) => atual.filter((c) => c.id !== id))
    const { error } = await supabase.from('tarefa_comentarios').delete().eq('id', id)
    if (error) { setErro(traduzirErro(error)); carregar() }
  }

  return (
    <div className="comentarios">
      {lista === null ? (
        <p className="texto-suave">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="texto-suave">Nenhum comentário ainda.</p>
      ) : (
        <ul>
          {lista.map((c) => (
            <li key={c.id}>
              <span className="avatar avatar-mini">{nomeDe(c.autor_id).charAt(0).toUpperCase()}</span>
              <div className="comentario-corpo">
                <div className="comentario-topo">
                  <strong>{nomeDe(c.autor_id)}</strong>
                  <small className="texto-suave">{quando(c.criado_em)}</small>
                  {(c.autor_id === session.user.id || permissoes.admin) && (
                    <button type="button" className="botao-icone mini" onClick={() => excluir(c.id)} aria-label="Excluir comentário">
                      <Icone nome="lixeira" tamanho={13} />
                    </button>
                  )}
                </div>
                <p>{c.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="comentario-novo">
        <textarea
          rows={2}
          placeholder="Escreva um comentário… (Enter envia, Shift+Enter quebra linha)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
        />
        <button type="button" className="botao botao-secundario botao-pequeno" onClick={enviar} disabled={!texto.trim() || enviando}>
          {enviando ? 'Enviando…' : 'Comentar'}
        </button>
      </div>
      {erro && <p className="alerta alerta-erro">{erro}</p>}
    </div>
  )
}
