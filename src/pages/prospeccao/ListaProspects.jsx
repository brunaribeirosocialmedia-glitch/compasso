import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { formatarData, hojeISO } from '../../lib/datas'
import { formatarMoeda } from '../../lib/moeda'
import Modal from '../../components/Modal'
import Icone from '../../components/Icone'
import { EscolhaStatus, STATUS } from './comum'

const ORDENACOES = {
  recentes: { nome: 'Contato mais recente', fn: (a, b) => b.data_primeiro_contato.localeCompare(a.data_primeiro_contato) },
  antigos: { nome: 'Contato mais antigo', fn: (a, b) => a.data_primeiro_contato.localeCompare(b.data_primeiro_contato) },
  empresa: { nome: 'Empresa (A–Z)', fn: (a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR') },
  temperatura: { nome: 'Mais quentes primeiro', fn: (a, b) => ['quente', 'morno', 'frio'].indexOf(a.status) - ['quente', 'morno', 'frio'].indexOf(b.status) },
  valor: { nome: 'Maior valor estimado', fn: (a, b) => (b.valor_estimado || 0) - (a.valor_estimado || 0) },
}

function NovoProspect({ aoFechar, aoCriar }) {
  const [form, setForm] = useState({
    empresa: '', responsavel: '', contato: '', status: 'frio',
    data_primeiro_contato: hojeISO(), servico_pretendido: '',
  })
  const [erro, setErro] = useState('')
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    const dados = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
    const { data, error } = await supabase.from('prospects').insert(dados).select().single()
    if (error) return setErro(traduzirErro(error))
    aoCriar(data)
  }

  return (
    <Modal
      titulo="Novo prospect"
      aoFechar={aoFechar}
      largura={560}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-prospect" className="botao botao-principal" disabled={!form.empresa.trim()}>Adicionar</button>
        </>
      }
    >
      <form id="form-prospect" className="formulario" onSubmit={salvar}>
        <label className="campo">
          <span>Nome da empresa</span>
          <input {...campo('empresa')} required autoFocus />
        </label>
        <div className="grade-campos">
          <label className="campo">
            <span>Nome do responsável</span>
            <input {...campo('responsavel')} />
          </label>
          <label className="campo">
            <span>Contato</span>
            <input {...campo('contato')} placeholder="WhatsApp, e-mail, @instagram" />
          </label>
          <label className="campo">
            <span>Data do primeiro contato</span>
            <input type="date" {...campo('data_primeiro_contato')} required />
          </label>
          <label className="campo">
            <span>Serviço pretendido</span>
            <input {...campo('servico_pretendido')} placeholder="Gestão de Instagram, pacote de reels…" />
          </label>
        </div>
        <div className="campo">
          <span>Status</span>
          <EscolhaStatus valor={form.status} onChange={(status) => setForm({ ...form, status })} />
        </div>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function ListaProspects() {
  const navigate = useNavigate()
  const [prospects, setProspects] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')          // '' | frio | morno | quente | fechados
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState('recentes')
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    supabase.from('prospects').select('*').then(({ data, error }) => {
      if (error) setErro(traduzirErro(error))
      setProspects(data || [])
    })
  }, [])

  const resumo = useMemo(() => {
    const lista = prospects || []
    const abertos = lista.filter((p) => p.valor_fechado == null)
    return {
      total: lista.length,
      porStatus: Object.fromEntries(Object.keys(STATUS).map((s) => [s, abertos.filter((p) => p.status === s).length])),
      emNegociacao: abertos.reduce((soma, p) => soma + Number(p.valor_estimado || 0), 0),
      fechados: lista.length - abertos.length,
      valorFechado: lista.reduce((soma, p) => soma + Number(p.valor_fechado || 0), 0),
    }
  }, [prospects])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (prospects || [])
      .filter((p) => {
        if (filtro === 'fechados') return p.valor_fechado != null
        if (filtro) return p.status === filtro && p.valor_fechado == null
        return true
      })
      .filter((p) => !termo || [p.empresa, p.responsavel, p.contato, p.servico_pretendido]
        .some((x) => (x || '').toLowerCase().includes(termo)))
      .sort(ORDENACOES[ordem].fn)
  }, [prospects, filtro, busca, ordem])

  async function mudarStatus(p, status) {
    setProspects((atual) => atual.map((x) => (x.id === p.id ? { ...x, status } : x)))
    const { error } = await supabase.from('prospects').update({ status }).eq('id', p.id)
    if (error) setErro(traduzirErro(error))
  }

  const filtros = [
    { valor: '', nome: 'Todos', qtd: resumo.total },
    ...Object.entries(STATUS).map(([v, nome]) => ({ valor: v, nome, qtd: resumo.porStatus[v] })),
    { valor: 'fechados', nome: 'Fechados', qtd: resumo.fechados },
  ]

  return (
    <div className="pagina pagina-larga">
      <header className="pagina-topo linha-topo">
        <div>
          <h1>Prospecção</h1>
          <p className="texto-suave">Pipeline de vendas da B Mídia.</p>
        </div>
        <button className="botao botao-principal" onClick={() => setCriando(true)}>
          <Icone nome="mais" tamanho={18} /> Novo prospect
        </button>
      </header>

      <div className="resumo-numeros">
        <div className="cartao numero">
          <span className="texto-suave">Em negociação</span>
          <strong>{resumo.total - resumo.fechados}</strong>
          <small className="texto-suave">{resumo.porStatus.quente} quente(s)</small>
        </div>
        <div className="cartao numero">
          <span className="texto-suave">Valor estimado em aberto</span>
          <strong>{formatarMoeda(resumo.emNegociacao)}</strong>
        </div>
        <div className="cartao numero">
          <span className="texto-suave">Fechados</span>
          <strong>{resumo.fechados}</strong>
          <small className="texto-suave">
            {resumo.total ? `${Math.round((100 * resumo.fechados) / resumo.total)}% de conversão` : '—'}
          </small>
        </div>
        <div className="cartao numero">
          <span className="texto-suave">Valor fechado</span>
          <strong>{formatarMoeda(resumo.valorFechado)}</strong>
        </div>
      </div>

      <div className="barra-lista">
        <div className="filtros-status">
          {filtros.map((f) => (
            <button key={f.valor} className={`filtro ${filtro === f.valor ? 'ativo' : ''}`} onClick={() => setFiltro(f.valor)}>
              {f.nome} <span>{f.qtd}</span>
            </button>
          ))}
        </div>
        <span className="espaco" />
        <label className="busca">
          <Icone nome="busca" tamanho={16} />
          <input placeholder="Buscar empresa, pessoa, serviço" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar">
          {Object.entries(ORDENACOES).map(([v, o]) => <option key={v} value={v}>{o.nome}</option>)}
        </select>
      </div>

      {erro && <p className="alerta alerta-erro">{erro}</p>}

      {prospects === null ? (
        <p className="texto-suave">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="cartao vazio">
          <p>{prospects.length === 0 ? 'Nenhum prospect ainda. Clique em “Novo prospect” para começar o pipeline.' : 'Nenhum prospect com esses filtros.'}</p>
        </div>
      ) : (
        <div className="cartao tabela-rolagem">
          <table className="tabela tabela-prospects">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Responsável</th>
                <th>Contato</th>
                <th>Status</th>
                <th>1º contato</th>
                <th>Serviço pretendido</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.id} className="linha-clicavel" onClick={() => navigate(p.id)}>
                  <td data-rotulo="Empresa">
                    <strong>{p.empresa}</strong>
                    {p.valor_fechado != null && <span className="etiqueta-mini fechado">fechado</span>}
                  </td>
                  <td data-rotulo="Responsável">{p.responsavel || <span className="texto-suave">—</span>}</td>
                  <td data-rotulo="Contato">{p.contato || <span className="texto-suave">—</span>}</td>
                  <td data-rotulo="Status" onClick={(e) => e.stopPropagation()}>
                    <select
                      className={`select-status status-${p.status}`}
                      value={p.status}
                      onChange={(e) => mudarStatus(p, e.target.value)}
                      aria-label={`Status de ${p.empresa}`}
                    >
                      {Object.entries(STATUS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </td>
                  <td data-rotulo="1º contato">{formatarData(p.data_primeiro_contato, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                  <td data-rotulo="Serviço">{p.servico_pretendido || <span className="texto-suave">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {criando && <NovoProspect aoFechar={() => setCriando(false)} aoCriar={(p) => navigate(p.id)} />}
    </div>
  )
}

