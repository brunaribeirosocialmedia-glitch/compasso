import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatarMoeda, lerMoeda } from '../../lib/moeda'
import { nomeMes, useFinanceiro } from './Financeiro'
import { Margem } from './Entregas'

const n = (v) => Number(v || 0)

function CampoMoeda({ rotulo, valor, onChange, dica }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => onChange(e.target.value)} /></div>
      {dica && <small className="texto-suave">{dica}</small>}
    </label>
  )
}

export default function Calculadora() {
  const { competencia, versao } = useFinanceiro()
  const [resumo, setResumo] = useState(null)
  const [entregas, setEntregas] = useState('')
  const [variaveis, setVariaveis] = useState('')
  const [ia, setIa] = useState('')
  const [cobrado, setCobrado] = useState('')
  const [margemAlvo, setMargemAlvo] = useState('40')
  const busca = `?mes=${competencia.slice(0, 7)}`

  useEffect(() => {
    supabase.from('fin_resumo_mensal').select('*').eq('competencia', competencia).maybeSingle()
      .then(({ data }) => setResumo(data || {}))
  }, [competencia, versao])

  if (resumo === null) return <p className="texto-suave recuo espaco-topo">Carregando…</p>

  // Mesma lógica da função fin_simular_preco do banco
  const baseFixa = n(resumo.base_fixa)
  const qtdEntregas = parseInt(entregas, 10) || n(resumo.total_entregas)
  const fixoPorEntrega = qtdEntregas > 0 ? Math.round((baseFixa / qtdEntregas) * 100) / 100 : null
  const v = lerMoeda(variaveis) || 0
  const custoIa = lerMoeda(ia) || 0
  const custoReal = fixoPorEntrega != null ? fixoPorEntrega + v + custoIa : null
  const valorCobrado = lerMoeda(cobrado)
  const margem = custoReal != null && valorCobrado ? valorCobrado - custoReal : null
  const margemPct = margem != null ? Math.round((1000 * margem) / valorCobrado) / 10 : null
  const alvo = Number(String(margemAlvo).replace(',', '.'))
  const precoSugerido = custoReal != null && alvo >= 0 && alvo < 100 ? Math.round((custoReal / (1 - alvo / 100)) * 100) / 100 : null

  return (
    <div className="calculadora">
      <section className="cartao secao">
        <h2>Calcular uma entrega</h2>
        <p className="texto-suave">
          Custos fixos de <strong>{nomeMes(competencia)}</strong> divididos pelo número de entregas do mês,
          mais os custos variáveis desta entrega. Nada aqui é salvo — é uma simulação.
        </p>

        <label className="campo">
          <span>Número de entregas no mês</span>
          <input
            type="number" min="1" inputMode="numeric"
            placeholder={resumo.total_entregas ? String(resumo.total_entregas) : 'Ex.: 20'}
            value={entregas} onChange={(e) => setEntregas(e.target.value)}
          />
          <small className="texto-suave">
            {resumo.total_entregas
              ? `${resumo.total_entregas} entrega(s) registrada(s) neste mês. Deixe em branco para usar esse número, ou digite outro para planejar.`
              : 'Nenhuma entrega registrada neste mês ainda: digite quantas você prevê.'}
          </small>
        </label>
        <div className="grade-campos">
          <CampoMoeda rotulo="Custos variáveis da entrega" valor={variaveis} onChange={setVariaveis} dica="Freelancer, produção, impulsionamento…" />
          <CampoMoeda rotulo="Gasto com IA nesta entrega" valor={ia} onChange={setIa} dica="Créditos, imagens, vídeos gerados…" />
          <CampoMoeda rotulo="Valor cobrado" valor={cobrado} onChange={setCobrado} dica="Opcional: para ver a margem" />
          <label className="campo">
            <span>Margem desejada</span>
            <div className="campo-moeda campo-porcento"><input inputMode="decimal" value={margemAlvo} onChange={(e) => setMargemAlvo(e.target.value)} /><span>%</span></div>
            <small className="texto-suave">Para sugerir um preço</small>
          </label>
        </div>
      </section>

      <section className="cartao secao conta">
        <h2>Custo real da entrega</h2>
        {baseFixa === 0 && (
          <p className="alerta alerta-aviso">
            Ainda não há custos fixos, colaboradores fixos ou pró-labore lançados em {nomeMes(competencia)}.
            Lance em <Link to={`../custos-fixos${busca}`}>Custos fixos</Link> para o rateio ficar real.
          </p>
        )}
        <ol className="passos">
          <li>
            <span>Custos fixos do mês</span>
            <b className="valor">{formatarMoeda(baseFixa)}</b>
            <small className="texto-suave">
              fixos {formatarMoeda(resumo.custos_fixos || 0)} + colaboradores {formatarMoeda(resumo.colaboradores_fixos || 0)} + pró-labore {formatarMoeda(resumo.pro_labore || 0)}
            </small>
          </li>
          <li>
            <span>÷ entregas no mês</span>
            <b className="valor">{qtdEntregas || '—'}</b>
          </li>
          <li className="subtotal">
            <span>= Custo fixo por entrega</span>
            <b className="valor">{fixoPorEntrega != null ? formatarMoeda(fixoPorEntrega) : '—'}</b>
          </li>
          <li>
            <span>+ Custos variáveis</span>
            <b className="valor">{formatarMoeda(v)}</b>
          </li>
          <li>
            <span>+ IA</span>
            <b className="valor">{formatarMoeda(custoIa)}</b>
          </li>
          <li className="total">
            <span>= Custo real</span>
            <b className="valor">{custoReal != null ? formatarMoeda(custoReal) : '—'}</b>
          </li>
        </ol>

        {custoReal == null ? (
          <p className="texto-suave">Informe o número de entregas do mês para calcular.</p>
        ) : (
          <div className="resultado-calculo">
            {margem != null && (
              <div>
                <span className="texto-suave">Cobrando {formatarMoeda(valorCobrado)}, sua margem é</span>
                <Margem valor={margem} percentual={margemPct} />
                {margem < 0 && <small className="negativo">Este preço não cobre o custo da entrega.</small>}
              </div>
            )}
            {precoSugerido != null && (
              <div>
                <span className="texto-suave">Para ter {String(alvo).replace('.', ',')}% de margem, cobre</span>
                <strong className="preco-sugerido">{formatarMoeda(precoSugerido)}</strong>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
