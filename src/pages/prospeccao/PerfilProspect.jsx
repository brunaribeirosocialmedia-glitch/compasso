import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { FORMAS_PAGAMENTO, formatarMoeda, lerMoeda, paraCampoMoeda } from '../../lib/moeda'
import { CORES_CLIENTE } from '../../lib/cores'
import { BotaoExcluir } from '../../components/Modal'
import Icone from '../../components/Icone'
import { EscolhaStatus } from './comum'

const CAMPOS_TEXTO = ['empresa', 'responsavel', 'contato', 'servico_pretendido', 'data_pagamento', 'forma_pagamento']

function paraFormulario(p) {
  return {
    empresa: p.empresa || '',
    responsavel: p.responsavel || '',
    contato: p.contato || '',
    status: p.status,
    data_primeiro_contato: p.data_primeiro_contato,
    servico_pretendido: p.servico_pretendido || '',
    valor_estimado: paraCampoMoeda(p.valor_estimado),
    valor_fechado: paraCampoMoeda(p.valor_fechado),
    data_pagamento: p.data_pagamento || '',
    forma_pagamento: p.forma_pagamento || '',
  }
}

function Anotacoes({ prospectId }) {
  const { session } = useAuth()
  const [lista, setLista] = useState(null)
  const [pessoas, setPessoas] = useState({})
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('prospect_anotacoes').select('*')
      .eq('prospect_id', prospectId).order('criado_em', { ascending: false })
    setLista(data || [])
  }, [prospectId])

  useEffect(() => {
    carregar()
    supabase.from('perfis').select('id, nome, email').then(({ data }) =>
      setPessoas(Object.fromEntries((data || []).map((p) => [p.id, p.nome || p.email]))))
  }, [carregar])

  async function adicionar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    const { error } = await supabase.from('prospect_anotacoes').insert({ prospect_id: prospectId, texto: texto.trim() })
    if (error) return setErro(traduzirErro(error))
    setTexto('')
    carregar()
  }

  async function excluir(id) {
    const { error } = await supabase.from('prospect_anotacoes').delete().eq('id', id)
    if (error) return setErro(traduzirErro(error))
    carregar()
  }

  return (
    <section className="cartao secao">
      <h2>Anotações</h2>
      <form className="formulario" onSubmit={adicionar}>
        <textarea
          rows={3}
          placeholder="Como foi o contato, próximos passos, objeções…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && adicionar(e)}
        />
        <button className="botao botao-principal botao-pequeno alinhar-inicio" disabled={!texto.trim()}>Adicionar anotação</button>
      </form>
      {erro && <p className="alerta alerta-erro">{erro}</p>}
      {lista?.length === 0 && <p className="texto-suave">Nenhuma anotação ainda.</p>}
      <ol className="linha-do-tempo">
        {lista?.map((a) => (
          <li key={a.id}>
            <div className="linha-do-tempo-topo">
              <strong>{pessoas[a.autor_id] || 'Alguém da equipe'}</strong>
              <span className="texto-suave">
                {new Date(a.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              {a.autor_id === session.user.id && (
                <button className="botao-icone mini" onClick={() => excluir(a.id)} aria-label="Excluir anotação" title="Excluir">
                  <Icone nome="lixeira" tamanho={14} />
                </button>
              )}
            </div>
            <p>{a.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function PerfilProspect() {
  const { prospectId } = useParams()
  const navigate = useNavigate()
  const { permissoes } = useAuth()
  const [prospect, setProspect] = useState(undefined)
  const [form, setForm] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('prospects').select('*, clientes(id, nome)').eq('id', prospectId).maybeSingle().then(({ data }) => {
      setProspect(data)
      if (data) setForm(paraFormulario(data))
    })
  }, [prospectId])

  if (prospect === undefined) return <div className="pagina"><p className="texto-suave">Carregando…</p></div>
  if (prospect === null) {
    return (
      <div className="pagina">
        <div className="cartao vazio">
          <p>Prospect não encontrado.</p>
          <Link className="botao botao-secundario" to="/prospeccao">Voltar para a Prospecção</Link>
        </div>
      </div>
    )
  }

  const campo = (nome) => ({ value: form[nome], onChange: (e) => { setForm({ ...form, [nome]: e.target.value }); setAviso('') } })
  const alterado = JSON.stringify(form) !== JSON.stringify(paraFormulario(prospect))

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const valorEstimado = lerMoeda(form.valor_estimado)
    const valorFechado = lerMoeda(form.valor_fechado)
    if (Number.isNaN(valorEstimado) || Number.isNaN(valorFechado)) return setErro('Confira os valores: use números, como 1.500,00.')
    if (valorEstimado < 0 || valorFechado < 0) return setErro('Os valores não podem ser negativos.')

    const dados = {
      status: form.status,
      data_primeiro_contato: form.data_primeiro_contato,
      valor_estimado: valorEstimado,
      valor_fechado: valorFechado,
      ...Object.fromEntries(CAMPOS_TEXTO.map((k) => [k, form[k].trim() || null])),
    }
    setSalvando(true)
    const { data, error } = await supabase.from('prospects').update(dados).eq('id', prospect.id).select('*, clientes(id, nome)').single()
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    setProspect(data)
    setForm(paraFormulario(data))
    setAviso('Alterações salvas.')
  }

  async function virarCliente() {
    setErro('')
    const cor = CORES_CLIENTE[Math.floor(Math.random() * CORES_CLIENTE.length)]
    const { data: cliente, error } = await supabase.from('clientes').insert({ nome: prospect.empresa, cor }).select().single()
    if (error) return setErro(traduzirErro(error))
    const { data } = await supabase.from('prospects').update({ cliente_id: cliente.id }).eq('id', prospect.id).select('*, clientes(id, nome)').single()
    if (data) setProspect(data)
    setAviso(`Área do Cliente de ${cliente.nome} criada.`)
  }

  async function excluir() {
    const { error } = await supabase.from('prospects').delete().eq('id', prospect.id)
    if (error) return setErro(traduzirErro(error))
    navigate('/prospeccao')
  }

  const fechado = prospect.valor_fechado != null

  return (
    <div className="pagina">
      <Link to="/prospeccao" className="migalha"><Icone nome="voltar" tamanho={16} /> Prospecção</Link>

      <header className="pagina-topo linha-topo">
        <div>
          <h1>{prospect.empresa}</h1>
          <p className="texto-suave">
            {[prospect.responsavel, prospect.servico_pretendido].filter(Boolean).join(' · ') || 'Prospect'}
          </p>
        </div>
        {fechado && <span className="selo-status status-fechado">Fechado · {formatarMoeda(prospect.valor_fechado)}</span>}
      </header>

      <form className="perfil-prospect" onSubmit={salvar}>
        <section className="cartao secao">
          <h2>Dados do prospect</h2>
          <div className="campo">
            <span>Status</span>
            <EscolhaStatus valor={form.status} onChange={(status) => setForm({ ...form, status })} />
          </div>
          <div className="grade-campos">
            <label className="campo"><span>Nome da empresa</span><input {...campo('empresa')} required /></label>
            <label className="campo"><span>Nome do responsável</span><input {...campo('responsavel')} /></label>
            <label className="campo"><span>Contato</span><input {...campo('contato')} /></label>
            <label className="campo"><span>Data do primeiro contato</span><input type="date" {...campo('data_primeiro_contato')} required /></label>
          </div>
          <label className="campo"><span>Serviço pretendido</span><input {...campo('servico_pretendido')} /></label>
        </section>

        <section className="cartao secao">
          <h2>Negociação</h2>
          <div className="grade-campos">
            <label className="campo">
              <span>Valor estimado</span>
              <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" {...campo('valor_estimado')} /></div>
            </label>
            <label className="campo">
              <span>Valor fechado</span>
              <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" {...campo('valor_fechado')} /></div>
            </label>
            <label className="campo"><span>Data de pagamento</span><input type="date" {...campo('data_pagamento')} /></label>
            <label className="campo">
              <span>Forma de pagamento</span>
              <select {...campo('forma_pagamento')}>
                <option value="">—</option>
                {Object.entries(FORMAS_PAGAMENTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
          </div>
          <p className="texto-suave dica-campo">Preencher o valor fechado marca o prospect como fechado.</p>
        </section>

        <div className="barra-salvar">
          {erro && <p className="alerta alerta-erro">{erro}</p>}
          {aviso && <p className="alerta alerta-ok">{aviso}</p>}
          <span className="espaco" />
          {alterado && <span className="texto-suave">Alterações não salvas</span>}
          <button className="botao botao-principal" disabled={!alterado || salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>

      <Anotacoes prospectId={prospect.id} />

      <section className="cartao secao">
        <h2>Área do Cliente</h2>
        {prospect.clientes ? (
          <>
            <p className="texto-suave">Este prospect virou cliente.</p>
            <Link className="botao botao-secundario alinhar-inicio" to={`/clientes/${prospect.clientes.id}/configuracoes`}>
              Abrir {prospect.clientes.nome} <Icone nome="seta" tamanho={16} />
            </Link>
          </>
        ) : permissoes.admin ? (
          <>
            <p className="texto-suave">Fechou negócio? Crie a Área do Cliente com o nome desta empresa, pronta para Tarefas, Calendário e Bloco de Notas.</p>
            <button className="botao botao-secundario alinhar-inicio" onClick={virarCliente}>Virar cliente</button>
          </>
        ) : (
          <p className="texto-suave">Quando o negócio fechar, a administração pode criar a Área do Cliente por aqui.</p>
        )}
      </section>

      <div className="rodape-perigo">
        <BotaoExcluir aoConfirmar={excluir} texto="Excluir prospect" />
      </div>
    </div>
  )
}
