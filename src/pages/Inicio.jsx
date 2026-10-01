import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatarData, formatarHora, hojeISO, paraISO, situacaoPrazo } from '../lib/datas'
import { buscarMeta, competenciaDe, fechadoNoMes, ritmoEsperado } from '../lib/metas'
import BarraMeta from '../components/BarraMeta'
import { STATUS } from './prospeccao/comum'

const emDias = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return paraISO(d)
}

function TarefasAgencia({ clientes }) {
  const [tarefas, setTarefas] = useState(null)

  useEffect(() => {
    supabase.from('tarefas').select('id, prazo, cliente_id').is('concluida_em', null)
      .then(({ data }) => setTarefas(data || []))
  }, [])

  if (!tarefas) return <section className="cartao secao"><h2>Tarefas da agência</h2><p className="texto-suave">Carregando…</p></section>

  const hoje = hojeISO()
  const semana = emDias(7)
  const atrasadas = tarefas.filter((t) => t.prazo && t.prazo < hoje).length
  const deHoje = tarefas.filter((t) => t.prazo === hoje).length
  const proximas = tarefas.filter((t) => t.prazo && t.prazo > hoje && t.prazo <= semana).length

  const porCliente = Object.values(tarefas.reduce((acc, t) => {
    const c = (acc[t.cliente_id] ||= { id: t.cliente_id, abertas: 0, atrasadas: 0 })
    c.abertas++
    if (t.prazo && t.prazo < hoje) c.atrasadas++
    return acc
  }, {}))
    .sort((a, b) => b.atrasadas - a.atrasadas || b.abertas - a.abertas)
    .slice(0, 5)
  const maior = Math.max(1, ...porCliente.map((c) => c.abertas))

  return (
    <section className="cartao secao">
      <h2>Tarefas da agência</h2>
      <div className="contagens">
        <div className={`contagem ${atrasadas ? 'alerta-contagem' : ''}`}><strong>{atrasadas}</strong><span>atrasada{atrasadas === 1 ? '' : 's'}</span></div>
        <div className="contagem"><strong>{deHoje}</strong><span>vence{deHoje === 1 ? '' : 'm'} hoje</span></div>
        <div className="contagem"><strong>{proximas}</strong><span>nos próximos 7 dias</span></div>
      </div>

      {porCliente.length === 0 ? (
        <p className="texto-suave">Nenhuma tarefa em aberto. Tudo em dia!</p>
      ) : (
        <>
          <h3 className="subtitulo-painel">Clientes com mais pendências</h3>
          <ul className="lista-pendencias">
            {porCliente.map((c) => {
              const cliente = clientes[c.id]
              return (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}/tarefas`}>
                    <span className="pendencia-nome">
                      <span className="ponto" style={{ background: cliente?.cor || 'var(--texto-suave)' }} />
                      {cliente?.nome || 'Cliente'}
                    </span>
                    <span className="texto-suave pendencia-qtd">
                      {c.abertas} em aberto{c.atrasadas > 0 && <b className="atrasado"> · {c.atrasadas} atrasada{c.atrasadas === 1 ? '' : 's'}</b>}
                    </span>
                  </Link>
                  <div className="barra-proporcao"><span style={{ width: `${(c.abertas / maior) * 100}%`, background: cliente?.cor || 'var(--texto-suave)' }} /></div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function nomeDia(dia) {
  if (dia === hojeISO()) return 'Hoje'
  if (dia === emDias(1)) return 'Amanhã'
  return formatarData(dia, { weekday: 'long', day: 'numeric', month: 'short' })
}

function AgendaSemana({ clientes }) {
  const [itens, setItens] = useState(null)

  useEffect(() => {
    supabase.from('calendario_itens').select('*')
      .gte('dia', hojeISO()).lte('dia', emDias(6)).eq('concluida', false)
      .order('dia').order('inicio', { nullsFirst: true })
      .then(({ data }) => setItens(data || []))
  }, [])

  const dias = Object.entries((itens || []).reduce((acc, i) => {
    (acc[i.dia] ||= []).push(i)
    return acc
  }, {}))

  return (
    <section className="cartao secao">
      <h2>Agenda da semana</h2>
      {!itens ? (
        <p className="texto-suave">Carregando…</p>
      ) : dias.length === 0 ? (
        <p className="texto-suave">Nada marcado para os próximos 7 dias.</p>
      ) : (
        <div className="agenda-dias">
          {dias.map(([dia, lista]) => (
            <div key={dia} className="agenda-dia">
              <h3 className="subtitulo-painel">{nomeDia(dia)}</h3>
              <ul className="lista-minhas">
                {lista.map((i) => {
                  const cliente = clientes[i.cliente_id]
                  const para = i.origem === 'tarefa'
                    ? `/clientes/${i.cliente_id}/tarefas?tarefa=${i.id}`
                    : `/clientes/${i.cliente_id}/calendario`
                  return (
                    <li key={`${i.origem}-${i.id}`}>
                      <Link to={para}>
                        <span className="ponto" style={{ background: cliente?.cor || 'var(--texto-suave)' }} />
                        <span className="minha-tarefa-titulo">{i.titulo}</span>
                        <span className="texto-suave minha-tarefa-cliente">{cliente?.nome}</span>
                        <span className="texto-suave agenda-hora">
                          {i.origem === 'tarefa' ? 'Prazo' : i.dia_inteiro ? 'Dia todo' : formatarHora(i.inicio)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SemMeta({ para }) {
  return <p className="texto-suave">Sem meta definida. <Link to={para}>Definir meta</Link></p>
}

// Só a leitura "perto ou longe", sem nenhum valor
function ResumoProspeccao() {
  const [dados, setDados] = useState(null)

  useEffect(() => {
    const mes = competenciaDe()
    Promise.all([
      supabase.from('prospects').select('status').is('valor_fechado', null),
      buscarMeta('prospeccao', mes),
      fechadoNoMes(mes),
    ]).then(([{ data }, meta, fechado]) => setDados({ abertos: data || [], meta, fechado }))
  }, [])

  if (!dados) return null
  const total = dados.abertos.length

  return (
    <section className="cartao secao">
      <div className="linha-topo"><h2>Prospecção</h2><Link to="/prospeccao" className="botao-link">Abrir</Link></div>
      <h3 className="subtitulo-painel">Fechamentos do mês</h3>
      {dados.meta
        ? <BarraMeta atual={dados.fechado} meta={Number(dados.meta.valor)} esperado={ritmoEsperado(competenciaDe())} />
        : <SemMeta para="/prospeccao" />}

      <h3 className="subtitulo-painel">Funil em aberto</h3>
      {total === 0 ? (
        <p className="texto-suave">Nenhum prospect em negociação.</p>
      ) : (
        <>
          <div className="funil-barra" role="img" aria-label="Proporção de prospects frios, mornos e quentes">
            {Object.keys(STATUS).map((s) => {
              const qtd = dados.abertos.filter((p) => p.status === s).length
              return qtd > 0 && <span key={s} className={`status-${s}`} style={{ flexGrow: qtd }} />
            })}
          </div>
          <div className="legenda-grafico">
            {Object.entries(STATUS).map(([s, nome]) => (
              <span key={s}><i className={`amostra status-${s}`} /> {nome}</span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function ResumoFinanceiro() {
  const [dados, setDados] = useState(null)

  useEffect(() => {
    const mes = competenciaDe()
    Promise.all([
      supabase.from('fin_resumo_mensal').select('faturamento').eq('competencia', mes).maybeSingle(),
      buscarMeta('financeiro', mes),
    ]).then(([{ data }, meta]) => setDados({ faturamento: Number(data?.faturamento || 0), meta }))
  }, [])

  if (!dados) return null
  return (
    <section className="cartao secao">
      <div className="linha-topo"><h2>Financeiro</h2><Link to="/financeiro" className="botao-link">Abrir</Link></div>
      <h3 className="subtitulo-painel">Faturamento do mês</h3>
      {dados.meta
        ? <BarraMeta atual={dados.faturamento} meta={Number(dados.meta.valor)} esperado={ritmoEsperado(competenciaDe())} />
        : <SemMeta para="/financeiro" />}
    </section>
  )
}

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
  const [clientes, setClientes] = useState({})

  useEffect(() => {
    supabase.from('clientes').select('id, nome, cor')
      .then(({ data }) => setClientes(Object.fromEntries((data || []).map((c) => [c.id, c]))))
  }, [])

  const metas = permissoes.prospeccao_liberada || permissoes.financeiro_liberado

  return (
    <div className="pagina pagina-larga">
      <header className="pagina-topo">
        <p className="sobretitulo">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}.</h1>
      </header>

      <div className="painel">
        <TarefasAgencia clientes={clientes} />
        <AgendaSemana clientes={clientes} />
      </div>

      {metas && (
        <div className="painel">
          {permissoes.prospeccao_liberada && <ResumoProspeccao />}
          {permissoes.financeiro_liberado && <ResumoFinanceiro />}
        </div>
      )}

      <MinhasTarefas usuarioId={session.user.id} />
    </div>
  )
}
