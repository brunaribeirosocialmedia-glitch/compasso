import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatarData, formatarHora, hojeISO, paraISO, situacaoPrazo, situacaoTarefa } from '../lib/datas'
import { buscarMeta, competenciaDe, fechadoNoMes, ritmoEsperado } from '../lib/metas'
import BarraMeta from '../components/BarraMeta'
import Icone from '../components/Icone'
import LegendaTarefas from '../components/LegendaTarefas'
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

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Domingo a sábado da semana de hoje, deslocada em "semanas"
function diasDaSemana(semanas) {
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - inicio.getDay() + semanas * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(d.getDate() + i)
    return paraISO(d)
  })
}

// Calendário da semana com todos os clientes: eventos e prazos de tarefas
// (inclusive as concluídas), coloridos pela situação de cada tarefa
function AgendaSemana({ clientes }) {
  const [semana, setSemana] = useState(0)
  const [itens, setItens] = useState(null)
  const dias = diasDaSemana(semana)
  const hoje = hojeISO()

  useEffect(() => {
    const [primeiro, , , , , , ultimo] = diasDaSemana(semana)
    setItens(null)
    supabase.from('calendario_itens').select('*')
      .gte('dia', primeiro).lte('dia', ultimo)
      .order('dia').order('dia_inteiro', { ascending: false }).order('inicio')
      .then(({ data }) => setItens(data || []))
  }, [semana])

  const porDia = (itens || []).reduce((acc, i) => {
    (acc[i.dia] ||= []).push(i)
    return acc
  }, {})

  const titulo = `${formatarData(dias[0], { day: 'numeric', month: 'short' })} a ${formatarData(dias[6], { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <section className="cartao secao agenda-semana">
      <div className="agenda-topo">
        <h2>Agenda da semana</h2>
        <div className="navegacao-mes">
          <button className="botao-icone" onClick={() => setSemana(semana - 1)} aria-label="Semana anterior"><Icone nome="voltar" /></button>
          <span className="agenda-periodo">{titulo}</span>
          <button className="botao-icone" onClick={() => setSemana(semana + 1)} aria-label="Próxima semana"><Icone nome="avancar" /></button>
          {semana !== 0 && <button className="botao botao-secundario botao-pequeno" onClick={() => setSemana(0)}>Esta semana</button>}
        </div>
        <LegendaTarefas />
      </div>

      <div className="grade-semana-rolagem">
        <div className="grade-semana">
          {dias.map((dia, i) => (
            <div key={dia} className={`semana-dia ${dia === hoje ? 'hoje' : ''}`}>
              <div className="semana-dia-topo">
                <span>{DIAS_SEMANA[i]}</span>
                <strong className="dia-numero-semana">{Number(dia.slice(8))}</strong>
              </div>
              {(porDia[dia] || []).map((item) => {
                const cliente = clientes[item.cliente_id]
                const tarefa = item.origem === 'tarefa'
                const para = tarefa
                  ? `/clientes/${item.cliente_id}/tarefas?tarefa=${item.id}`
                  : `/clientes/${item.cliente_id}/calendario`
                return (
                  <Link
                    key={`${item.origem}-${item.id}`}
                    to={para}
                    className={`item-agenda item-semana item-${item.origem} ${tarefa ? `tarefa-${situacaoTarefa(item.dia, item.concluida)}` : ''}`}
                    title={`${item.titulo} · ${cliente?.nome || ''}`}
                  >
                    <span className="item-semana-titulo">
                      {!tarefa && !item.dia_inteiro && <b>{formatarHora(item.inicio)}</b>}
                      {item.titulo}
                    </span>
                    <span className="item-semana-cliente">
                      <i className="ponto" style={{ background: cliente?.cor || 'var(--texto-suave)' }} />
                      {cliente?.nome}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {itens?.length === 0 && <p className="texto-suave">Nada marcado nesta semana.</p>}
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

  // cria as tarefas da rotina mensal que faltam; se criou alguma, recarrega os painéis
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    supabase.rpc('gerar_rotina_do_mes').then(({ data }) => data > 0 && setVersao((v) => v + 1))
  }, [])

  const metas = permissoes.prospeccao_liberada || permissoes.financeiro_liberado

  return (
    <div className="pagina pagina-larga">
      <header className="pagina-topo">
        <p className="sobretitulo">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}.</h1>
      </header>

      <AgendaSemana key={`agenda-${versao}`} clientes={clientes} />

      <div className="painel" key={`tarefas-${versao}`}>
        <TarefasAgencia clientes={clientes} />
        <MinhasTarefas usuarioId={session.user.id} />
      </div>

      {metas && (
        <div className="painel">
          {permissoes.prospeccao_liberada && <ResumoProspeccao />}
          {permissoes.financeiro_liberado && <ResumoFinanceiro />}
        </div>
      )}
    </div>
  )
}
