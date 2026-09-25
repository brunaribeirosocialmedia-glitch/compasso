import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatarMoeda } from '../../lib/moeda'
import { nomeMes, somarMeses, useFinanceiro } from './Financeiro'

const n = (v) => Number(v || 0)

// Gráfico de barras agrupadas: faturamento × custo total, um eixo (R$)
function GraficoMeses({ meses }) {
  const [foco, setFoco] = useState(null)
  const [comoTabela, setComoTabela] = useState(false)

  const maximo = Math.max(1, ...meses.flatMap((m) => [m.faturamento, m.custo]))
  // escala "redonda" para as linhas de grade
  const passo = 10 ** Math.floor(Math.log10(maximo))
  const topo = Math.ceil(maximo / passo) * passo
  const grades = [0, 0.25, 0.5, 0.75, 1].map((f) => f * topo)

  const L = 64, T = 12, A = 200, largura = 640, altura = T + A + 28
  const grupo = (largura - L - 8) / meses.length
  const barra = Math.min(28, (grupo - 18) / 2)
  const y = (v) => T + A - (v / topo) * A
  const compacto = (v) => v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${v.toLocaleString('pt-BR')}`

  // retângulo com cantos arredondados só no topo, ancorado na base
  const coluna = (x, v) => {
    const h = Math.max(0, (v / topo) * A)
    if (h === 0) return ''
    const r = Math.min(4, h, barra / 2)
    const b = T + A
    return `M${x},${b} V${b - h + r} Q${x},${b - h} ${x + r},${b - h} H${x + barra - r} Q${x + barra},${b - h} ${x + barra},${b - h + r} V${b} Z`
  }

  return (
    <section className="cartao secao grafico">
      <div className="grafico-topo">
        <h2>Últimos 6 meses</h2>
        <div className="legenda-grafico" aria-hidden={comoTabela}>
          <span><i className="amostra serie-faturamento" /> Faturamento</span>
          <span><i className="amostra serie-custo" /> Custo total</span>
        </div>
        <button className="botao-link" onClick={() => setComoTabela(!comoTabela)}>
          {comoTabela ? 'Ver gráfico' : 'Ver como tabela'}
        </button>
      </div>

      {comoTabela ? (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Mês</th><th className="direita">Faturamento</th><th className="direita">Custo total</th><th className="direita">Resultado</th></tr></thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.competencia}>
                  <td>{nomeMes(m.competencia)}</td>
                  <td className="direita valor">{formatarMoeda(m.faturamento)}</td>
                  <td className="direita valor">{formatarMoeda(m.custo)}</td>
                  <td className="direita valor">{formatarMoeda(m.faturamento - m.custo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grafico-area">
          <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Faturamento e custo total dos últimos 6 meses">
            {grades.map((g) => (
              <g key={g}>
                <line x1={L} x2={largura - 8} y1={y(g)} y2={y(g)} className={g === 0 ? 'eixo' : 'grade'} />
                <text x={L - 8} y={y(g) + 4} className="rotulo-eixo" textAnchor="end">{compacto(g)}</text>
              </g>
            ))}
            {meses.map((m, i) => {
              const x0 = L + i * grupo + (grupo - (barra * 2 + 2)) / 2
              return (
                <g key={m.competencia} onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
                  <rect x={L + i * grupo} y={T} width={grupo} height={A} className={`faixa-foco ${foco === i ? 'ativa' : ''}`} />
                  <path d={coluna(x0, m.faturamento)} className="serie-faturamento" />
                  <path d={coluna(x0 + barra + 2, m.custo)} className="serie-custo" />
                  <text x={L + i * grupo + grupo / 2} y={altura - 8} className={`rotulo-eixo ${m.atual ? 'atual' : ''}`} textAnchor="middle">
                    {nomeMes(m.competencia, { month: 'short' }).replace('.', '')}
                  </text>
                </g>
              )
            })}
          </svg>
          {foco !== null && (
            <div className="dica-grafico" style={{ left: `${((L + foco * grupo + grupo / 2) / largura) * 100}%` }}>
              <strong>{nomeMes(meses[foco].competencia)}</strong>
              <span><i className="amostra serie-faturamento" /> Faturamento <b>{formatarMoeda(meses[foco].faturamento)}</b></span>
              <span><i className="amostra serie-custo" /> Custo total <b>{formatarMoeda(meses[foco].custo)}</b></span>
              <span>Resultado <b>{formatarMoeda(meses[foco].faturamento - meses[foco].custo)}</b></span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function VisaoGeral() {
  const { competencia, versao } = useFinanceiro()
  const [resumos, setResumos] = useState(null)
  const busca = `?mes=${competencia.slice(0, 7)}`

  useEffect(() => {
    supabase.from('fin_resumo_mensal').select('*')
      .gte('competencia', somarMeses(competencia, -5)).lte('competencia', competencia)
      .then(({ data }) => setResumos(data || []))
  }, [competencia, versao])

  const meses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const c = somarMeses(competencia, i - 5)
    const r = resumos?.find((x) => x.competencia === c)
    return { competencia: c, faturamento: n(r?.faturamento), custo: n(r?.custo_total), atual: i === 5 }
  }), [resumos, competencia])

  if (resumos === null) return <p className="texto-suave recuo espaco-topo">Carregando…</p>

  const r = resumos.find((x) => x.competencia === competencia) || {}
  const resultado = n(r.faturamento) - n(r.custo_total)
  const composicao = [
    { nome: 'Custos fixos', valor: n(r.custos_fixos), para: 'custos-fixos' },
    { nome: 'Colaboradores (fixos)', valor: n(r.colaboradores_fixos), para: 'colaboradores' },
    { nome: 'Pró-labore', valor: n(r.pro_labore), para: 'pro-labore' },
    { nome: 'Custos variáveis', valor: n(r.custos_variaveis), para: 'custos-variaveis', detalhe: n(r.gastos_ia) > 0 ? `inclui ${formatarMoeda(r.gastos_ia)} de IA` : null },
    { nome: 'Colaboradores (por entrega)', valor: n(r.colaboradores_por_entrega), para: 'colaboradores' },
  ]
  const maiorParte = Math.max(1, ...composicao.map((c) => c.valor))

  return (
    <div className="visao-geral">
      <div className="resumo-numeros">
        <div className="cartao numero">
          <span className="texto-suave">Faturamento</span>
          <strong>{formatarMoeda(r.faturamento || 0)}</strong>
          <small className="texto-suave">{formatarMoeda(r.faturamento_recebido || 0)} recebido</small>
        </div>
        <div className="cartao numero">
          <span className="texto-suave">Custo total</span>
          <strong>{formatarMoeda(r.custo_total || 0)}</strong>
          <small className="texto-suave">{formatarMoeda(r.gastos_ia || 0)} com IA</small>
        </div>
        <div className="cartao numero">
          <span className="texto-suave">Resultado do mês</span>
          <strong className={resultado < 0 ? 'negativo' : ''}>{formatarMoeda(resultado)}</strong>
          <small className={resultado < 0 ? 'negativo' : 'texto-suave'}>
            {resultado < 0 ? '▼ custos maiores que o faturamento' : r.faturamento ? `▲ ${Math.round((100 * resultado) / n(r.faturamento))}% do faturamento` : '—'}
          </small>
        </div>
        <div className="cartao numero">
          <span className="texto-suave">Custo fixo por entrega</span>
          <strong>{r.custo_fixo_por_entrega != null ? formatarMoeda(r.custo_fixo_por_entrega) : '—'}</strong>
          <small className="texto-suave">
            {r.total_entregas ? `${formatarMoeda(r.base_fixa)} ÷ ${r.total_entregas} entrega(s)` : <Link to={`../entregas${busca}`}>registre as entregas do mês</Link>}
          </small>
        </div>
      </div>

      <div className="colunas-visao">
        <section className="cartao secao">
          <h2>Para onde foi o dinheiro</h2>
          {n(r.custo_total) === 0 ? (
            <p className="texto-suave">Nenhum custo lançado em {nomeMes(competencia)}.</p>
          ) : (
            <ul className="composicao">
              {composicao.filter((c) => c.valor > 0).map((c) => (
                <li key={c.nome}>
                  <Link to={`../${c.para}${busca}`} className="composicao-linha">
                    <span>{c.nome}{c.detalhe && <small className="texto-suave"> · {c.detalhe}</small>}</span>
                    <b className="valor">{formatarMoeda(c.valor)}</b>
                  </Link>
                  <div className="barra-proporcao"><span style={{ width: `${(c.valor / maiorParte) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <GraficoMeses meses={meses} />
      </div>
    </div>
  )
}
