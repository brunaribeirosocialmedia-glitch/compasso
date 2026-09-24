import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatarData, situacaoPrazo } from '../lib/datas'
import Icone from '../components/Icone'

function MinhasTarefas({ usuarioId }) {
  const [tarefas, setTarefas] = useState(null)

  useEffect(() => {
    supabase
      .from('tarefas')
      .select('id, titulo, prazo, cliente_id, clientes(nome, cor)')
      .eq('responsavel_id', usuarioId)
      .is('concluida_em', null)
      .order('prazo', { ascending: true, nullsFirst: false })
      .limit(10)
      .then(({ data }) => setTarefas(data || []))
  }, [usuarioId])

  if (!tarefas) return null
  return (
    <section className="cartao secao">
      <h2>Minhas próximas tarefas</h2>
      {tarefas.length === 0 ? (
        <p className="texto-suave">Nenhuma tarefa em aberto com você.</p>
      ) : (
        <ul className="lista-minhas">
          {tarefas.map((t) => {
            const situacao = situacaoPrazo(t.prazo)
            return (
              <li key={t.id}>
                <Link to={`/clientes/${t.cliente_id}/tarefas?tarefa=${t.id}`}>
                  <span className="ponto" style={{ background: t.clientes?.cor || 'var(--texto-suave)' }} />
                  <span className="minha-tarefa-titulo">{t.titulo}</span>
                  <span className="texto-suave minha-tarefa-cliente">{t.clientes?.nome}</span>
                  <span className={`prazo ${situacao}`}>
                    {t.prazo ? (situacao === 'hoje' ? 'Hoje' : formatarData(t.prazo)) : 'Sem prazo'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Inicio() {
  const { session, perfil, permissoes } = useAuth()
  const primeiroNome = (perfil?.nome || '').split(' ')[0]

  const atalhos = [
    { para: '/clientes', nome: 'Área do Cliente', icone: 'clientes', texto: 'Tarefas, Calendário e Bloco de Notas de cada cliente.' },
    permissoes.pode_prospeccao && { para: '/prospeccao', nome: 'Prospecção', icone: 'prospeccao', texto: 'Pipeline de vendas e perfil de cada prospect.' },
    permissoes.pode_financeiro && { para: '/financeiro', nome: 'Financeiro', icone: 'financeiro', texto: 'Faturamento, custos e calculadora de precificação.' },
    permissoes.admin && { para: '/equipe', nome: 'Equipe', icone: 'equipe', texto: 'Quem acessa o quê dentro do Compasso.' },
  ].filter(Boolean)

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <p className="sobretitulo">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}.</h1>
      </header>

      <div className="grade-atalhos">
        {atalhos.map((a) => (
          <Link key={a.para} to={a.para} className="cartao atalho">
            <span className="atalho-icone"><Icone nome={a.icone} /></span>
            <strong>{a.nome}</strong>
            <span className="texto-suave">{a.texto}</span>
          </Link>
        ))}
      </div>

      <MinhasTarefas usuarioId={session.user.id} />
    </div>
  )
}
