import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { formatarData, hojeISO } from '../../lib/datas'
import { formatarMoeda, lerMoeda, paraCampoMoeda } from '../../lib/moeda'
import Modal, { BotaoExcluir } from '../../components/Modal'
import Icone from '../../components/Icone'
import { nomeMes, somarMeses, useFinanceiro } from './Financeiro'
import { CATEGORIAS_VARIAVEIS, ROTULOS_COLUNA, SECOES, STATUS_LANCAMENTO } from './secoes'

// Move uma data AAAA-MM-DD um mês para frente (31/jan → 28/fev)
function proximoMes(data) {
  if (!data) return null
  const [a, m, d] = data.split('-').map(Number)
  const ultimo = new Date(a, m + 1, 0).getDate()
  const nova = new Date(a, m, Math.min(d, ultimo))
  return `${nova.getFullYear()}-${String(nova.getMonth() + 1).padStart(2, '0')}-${String(nova.getDate()).padStart(2, '0')}`
}

export function SeloLancamento({ status }) {
  return <span className={`selo-lancamento lanc-${status}`}>{STATUS_LANCAMENTO[status]}</span>
}

// Formulário genérico, usado por todas as seções e pelas Entregas
export function FormularioLancamento({ config, item, apoio, competencia, aoFechar, aoSalvar }) {
  const novo = !item.id
  const [form, setForm] = useState(() => {
    const base = { ...config.padrao, ...item }
    return Object.fromEntries(config.campos.map((c) => {
      const v = base[c.chave]
      if (c.tipo === 'moeda') return [c.chave, paraCampoMoeda(v)]
      if (c.tipo === 'marcar') return [c.chave, Boolean(v)]
      return [c.chave, v ?? '']
    }))
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const definir = (chave, valor) => setForm((f) => ({ ...f, [chave]: valor }))

  const visiveis = config.campos.filter((c) => !c.mostrarSe || c.mostrarSe(form))

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const dados = {}
    for (const c of config.campos) {
      let v = form[c.chave]
      if (c.mostrarSe && !c.mostrarSe(form)) v = c.tipo === 'marcar' ? false : null
      else if (c.tipo === 'moeda') {
        v = lerMoeda(v)
        if (Number.isNaN(v) || v < 0) return setErro(`Confira o campo “${c.rotulo}”: use números, como 1.500,00.`)
      } else if (c.tipo !== 'marcar') v = typeof v === 'string' ? v.trim() || null : v
      if (c.obrigatorio && (v == null || v === '')) return setErro(`Preencha “${c.rotulo}”.`)
      dados[c.chave] = v
    }
    // ao marcar como pago sem data, usa hoje
    if (config.dataPago && dados.status === 'pago' && !dados[config.dataPago]) dados[config.dataPago] = hojeISO()

    setSalvando(true)
    const { error } = novo
      ? await supabase.from(config.tabela).insert({ ...dados, competencia })
      : await supabase.from(config.tabela).update(dados).eq('id', item.id)
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    aoSalvar()
    aoFechar()
  }

  async function excluir() {
    const { error } = await supabase.from(config.tabela).delete().eq('id', item.id)
    if (error) return setErro(traduzirErro(error))
    aoSalvar()
    aoFechar()
  }

  return (
    <Modal
      titulo={novo ? config.novo : config.titulo}
      aoFechar={aoFechar}
      largura={600}
      rodape={
        <>
          {!novo && <BotaoExcluir aoConfirmar={excluir} />}
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-lancamento" className="botao botao-principal" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="form-lancamento" className="formulario" onSubmit={salvar}>
        <p className="texto-suave competencia-form">Competência: <strong>{nomeMes(competencia)}</strong></p>
        <div className="grade-campos">
          {visiveis.map((c) => {
            const props = { value: form[c.chave], onChange: (e) => definir(c.chave, e.target.value) }
            let entrada
            if (c.tipo === 'moeda') {
              entrada = <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" {...props} autoFocus={c.chave === config.campos[0].chave} /></div>
            } else if (c.tipo === 'data') {
              entrada = <input type="date" {...props} />
            } else if (c.tipo === 'area') {
              entrada = <textarea rows={2} {...props} />
            } else if (c.tipo === 'status') {
              entrada = <select {...props}>{Object.entries(STATUS_LANCAMENTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
            } else if (c.tipo === 'select') {
              const opcoes = c.opcoes(apoio)
              entrada = (
                <select {...props}>
                  {!c.obrigatorio && <option value="">{c.vazio || '—'}</option>}
                  {Object.entries(opcoes).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              )
            } else if (c.tipo === 'marcar') {
              return (
                <label key={c.chave} className="marcar marcar-campo">
                  <input type="checkbox" checked={form[c.chave]} onChange={(e) => definir(c.chave, e.target.checked)} /> {c.rotulo}
                </label>
              )
            } else {
              entrada = (
                <>
                  <input {...props} placeholder={c.dica} list={c.sugestoes ? `sug-${c.chave}` : undefined} autoFocus={c.chave === config.campos[0].chave} />
                  {c.sugestoes && <datalist id={`sug-${c.chave}`}>{c.sugestoes.map((s) => <option key={s} value={s} />)}</datalist>}
                </>
              )
            }
            return (
              <label key={c.chave} className={`campo ${c.largura === 'toda' ? 'campo-largo' : ''}`}>
                <span>{c.rotulo}</span>
                {entrada}
              </label>
            )
          })}
        </div>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

function valorCelula(chave, item, apoio) {
  switch (chave) {
    case 'valor': return <span className="valor">{formatarMoeda(item.valor)}</span>
    case 'status': return <SeloLancamento status={item.status} />
    case 'cliente_id': return apoio.clientes.find((c) => c.id === item.cliente_id)?.nome || <span className="texto-suave">—</span>
    case 'entrega_id': return apoio.entregas.find((e) => e.id === item.entrega_id)?.descricao || <span className="texto-suave">Geral</span>
    case 'categoria': return CATEGORIAS_VARIAVEIS[item.categoria] || item.categoria || <span className="texto-suave">—</span>
    case 'tipo': return item.tipo === 'fixo' ? 'Fixo mensal' : 'Por entrega'
    case 'descricao_fixa': return <strong>Pró-labore</strong>
    case 'descricao': return <strong>{item.descricao || '—'}</strong>
    case 'colaborador': return <strong>{item.colaborador}</strong>
    default:
      if (chave.startsWith('data')) return item[chave] ? formatarData(item[chave], { day: '2-digit', month: '2-digit' }) : <span className="texto-suave">—</span>
      return item[chave] || <span className="texto-suave">—</span>
  }
}

export default function Lancamentos() {
  const { secao } = useParams()
  const config = SECOES[secao]
  const { competencia, clientes, versao, avisarMudanca } = useFinanceiro()
  const [itens, setItens] = useState(null)
  const [entregas, setEntregas] = useState([])
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const [copiando, setCopiando] = useState(false)

  const carregar = useCallback(async () => {
    if (!config) return
    const [{ data, error }, { data: ent }] = await Promise.all([
      supabase.from(config.tabela).select('*').eq('competencia', competencia).order('criado_em'),
      supabase.from('fin_entregas').select('id, descricao').eq('competencia', competencia).order('descricao'),
    ])
    if (error) setErro(traduzirErro(error))
    setItens(data || [])
    setEntregas(ent || [])
  }, [config, competencia])

  useEffect(() => { setItens(null) }, [config, competencia])   // troca de mês/seção: mostra "Carregando"
  useEffect(() => { carregar() }, [carregar, versao])            // depois de salvar: recarrega sem piscar

  if (!config) return <Navigate to="../visao-geral" replace />
  const apoio = { clientes, entregas }

  const ativos = (itens || []).filter((i) => i.status !== 'cancelado')
  const total = ativos.reduce((s, i) => s + Number(i.valor), 0)
  const pago = ativos.filter((i) => i.status === 'pago').reduce((s, i) => s + Number(i.valor), 0)

  async function marcarPago(item) {
    const dados = { status: 'pago' }
    if (!item[config.dataPago]) dados[config.dataPago] = hojeISO()
    const { error } = await supabase.from(config.tabela).update(dados).eq('id', item.id)
    if (error) setErro(traduzirErro(error))
    avisarMudanca()
  }

  async function copiarMesAnterior() {
    setCopiando(true)
    setErro('')
    const { data } = await supabase.from(config.tabela).select('*')
      .eq('competencia', somarMeses(competencia, -1)).neq('status', 'cancelado')
    const copias = (data || []).filter(config.repetir).map((item) => {
      const copia = { ...item, competencia, status: 'pendente' }
      for (const k of ['id', 'criado_em', 'atualizado_em', 'criado_por']) delete copia[k]
      if ('entrega_id' in copia) copia.entrega_id = null
      if ('data_vencimento' in copia) copia.data_vencimento = proximoMes(item.data_vencimento)
      copia[config.dataPago] = null
      return copia
    })
    if (copias.length === 0) {
      setCopiando(false)
      return setErro(`Não há lançamentos para repetir em ${nomeMes(somarMeses(competencia, -1))}.`)
    }
    const { error } = await supabase.from(config.tabela).insert(copias)
    setCopiando(false)
    if (error) return setErro(traduzirErro(error))
    avisarMudanca()
  }

  return (
    <div className="secao-financeiro">
      <div className="barra-ferramentas">
        <div className="totais">
          <span>Total <strong>{formatarMoeda(total)}</strong></span>
          <span>{config.rotuloPago} <strong>{formatarMoeda(pago)}</strong></span>
          <span>Pendente <strong>{formatarMoeda(total - pago)}</strong></span>
        </div>
        <span className="espaco" />
        {config.repetir && itens?.length === 0 && (
          <button className="botao botao-secundario botao-pequeno" onClick={copiarMesAnterior} disabled={copiando}>
            {copiando ? 'Copiando…' : 'Repetir do mês anterior'}
          </button>
        )}
        <button className="botao botao-principal botao-pequeno" onClick={() => setEditando({})}>
          <Icone nome="mais" tamanho={16} /> {config.novo}
        </button>
      </div>

      {erro && <p className="alerta alerta-erro recuo">{erro}</p>}

      {itens === null ? (
        <p className="texto-suave recuo">Carregando…</p>
      ) : itens.length === 0 ? (
        <div className="cartao vazio recuo">
          <p>{config.vazio}</p>
          {config.repetir && <p>Use “Repetir do mês anterior” para copiar o que se repete todo mês.</p>}
        </div>
      ) : (
        <div className="recuo cartao tabela-rolagem">
          <table className="tabela tabela-lancamentos">
            <thead>
              <tr>
                {config.colunas.map((c) => <th key={c} className={c === 'valor' ? 'direita' : ''}>{ROTULOS_COLUNA[c]}</th>)}
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} className={`linha-clicavel ${item.status === 'cancelado' ? 'inativo' : ''}`} onClick={() => setEditando(item)}>
                  {config.colunas.map((c) => (
                    <td key={c} data-rotulo={ROTULOS_COLUNA[c]} className={c === 'valor' ? 'direita' : ''}>{valorCelula(c, item, apoio)}</td>
                  ))}
                  <td className="acoes-linha" onClick={(e) => e.stopPropagation()}>
                    {item.status === 'pendente' && (
                      <button className="botao-link" onClick={() => marcarPago(item)}>{config.rotuloMarcar}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormularioLancamento
          config={config}
          item={editando}
          apoio={apoio}
          competencia={competencia}
          aoFechar={() => setEditando(null)}
          aoSalvar={avisarMudanca}
        />
      )}
    </div>
  )
}
