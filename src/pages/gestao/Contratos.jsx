import { useCallback, useEffect, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { deISO, formatarData, hojeISO } from '../../lib/datas'
import { FORMAS_PAGAMENTO, formatarMoeda, lerMoeda, paraCampoMoeda } from '../../lib/moeda'
import { useAutoSalvar, useFecharSalvando } from '../../lib/useAutoSalvar'
import Modal, { BotaoExcluir } from '../../components/Modal'
import StatusSalvamento from '../../components/StatusSalvamento'
import Icone from '../../components/Icone'

const BUCKET = 'contratos'

// Dias entre hoje e uma data AAAA-MM-DD (negativo = já passou)
const diasAte = (data) => Math.round((deISO(data) - deISO(hojeISO())) / 86400000)

// Situação do contrato, calculada a partir das datas
export function situacaoContrato(c) {
  if (c.status === 'encerrado') return { classe: 'cancelado', texto: 'Encerrado' }
  if (!c.fim) return { classe: 'pago', texto: 'Ativo' }
  const dias = diasAte(c.fim)
  if (dias < 0) {
    return c.renovacao_automatica
      ? { classe: 'pago', texto: 'Renovado automaticamente' }
      : { classe: 'vencido', texto: 'Vencido' }
  }
  if (dias <= c.aviso_previo_dias) {
    return { classe: 'pendente', texto: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias === 1 ? '' : 's'}` }
  }
  return { classe: 'pago', texto: 'Ativo' }
}

function vigencia(c) {
  const opcoes = { day: '2-digit', month: '2-digit', year: '2-digit' }
  const inicio = c.inicio ? formatarData(c.inicio, opcoes) : '—'
  if (!c.fim) return `${inicio} · sem prazo`
  return `${inicio} → ${formatarData(c.fim, opcoes)}`
}

async function abrirArquivo(caminho) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 120)
  if (error) return traduzirErro(error)
  window.open(data.signedUrl, '_blank', 'noopener')
  return ''
}

function paraFormulario(c) {
  return {
    cliente_id: c.cliente_id || '',
    servicos: c.servicos || '',
    valor_mensal: paraCampoMoeda(c.valor_mensal),
    dia_vencimento: c.dia_vencimento ?? '',
    forma_pagamento: c.forma_pagamento || '',
    inicio: c.inicio || '',
    fim: c.fim || '',
    renovacao_automatica: c.renovacao_automatica,
    aviso_previo_dias: c.aviso_previo_dias ?? 30,
    status: c.status,
    observacoes: c.observacoes || '',
  }
}

function ContratoModal({ contrato, clientes, aoFechar, aoMudar, aoExcluir }) {
  const [form, setForm] = useState(() => paraFormulario(contrato))
  const [arquivo, setArquivo] = useState({ caminho: contrato.arquivo_caminho, nome: contrato.arquivo_nome })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const definir = (chave, valor) => setForm((f) => ({ ...f, [chave]: valor }))
  const campo = (chave) => ({ value: form[chave], onChange: (e) => definir(chave, e.target.value) })

  function montar(f) {
    const valor = lerMoeda(f.valor_mensal)
    if (Number.isNaN(valor) || valor < 0) return { erro: 'Confira o valor mensal: use números, como 1.500,00.' }
    const dia = f.dia_vencimento === '' ? null : Number(f.dia_vencimento)
    if (dia != null && !(Number.isInteger(dia) && dia >= 1 && dia <= 31)) return { erro: 'O dia de vencimento vai de 1 a 31.' }
    const aviso = f.aviso_previo_dias === '' ? 30 : Number(f.aviso_previo_dias)
    if (!(Number.isInteger(aviso) && aviso >= 0 && aviso <= 365)) return { erro: 'O aviso de vencimento vai de 0 a 365 dias.' }
    if (f.inicio && f.fim && f.fim < f.inicio) return { erro: 'O fim do contrato não pode ser antes do início.' }
    const cliente = clientes.find((c) => c.id === f.cliente_id)
    return {
      campos: {
        cliente_id: f.cliente_id || null,
        nome_cliente: cliente?.nome || contrato.nome_cliente,
        servicos: f.servicos.trim() || null,
        valor_mensal: valor,
        dia_vencimento: dia,
        forma_pagamento: f.forma_pagamento || null,
        inicio: f.inicio || null,
        fim: f.fim || null,
        renovacao_automatica: f.renovacao_automatica,
        aviso_previo_dias: aviso,
        status: f.status,
        observacoes: f.observacoes.trim() || null,
      },
    }
  }

  async function gravar(campos) {
    const { data, error } = await supabase.from('contratos').update(campos).eq('id', contrato.id).select().single()
    if (error) {
      setErro(traduzirErro(error))
      return false
    }
    setErro('')
    aoMudar(data)
    return true
  }

  const { estado, erroValidacao, salvarAgora } = useAutoSalvar(form, { montar, gravar })
  const fechar = useFecharSalvando(salvarAgora, aoFechar)

  // O arquivo grava na hora, fora do salvamento automático
  async function enviarArquivo(e) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    if (!escolhido) return
    if (escolhido.size > 20 * 1024 * 1024) return setErro('O arquivo passa de 20 MB. Tente um PDF menor.')
    setEnviando(true)
    setErro('')
    const nomeSeguro = escolhido.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-')
    const caminho = `${contrato.id}/${Date.now()}-${nomeSeguro}`
    const { error: erroEnvio } = await supabase.storage.from(BUCKET).upload(caminho, escolhido, { contentType: escolhido.type || undefined })
    if (erroEnvio) {
      setEnviando(false)
      return setErro(traduzirErro(erroEnvio))
    }
    const { data, error } = await supabase.from('contratos')
      .update({ arquivo_caminho: caminho, arquivo_nome: escolhido.name }).eq('id', contrato.id).select().single()
    setEnviando(false)
    if (error) {
      await supabase.storage.from(BUCKET).remove([caminho])
      return setErro(traduzirErro(error))
    }
    if (arquivo.caminho) await supabase.storage.from(BUCKET).remove([arquivo.caminho])
    setArquivo({ caminho, nome: escolhido.name })
    aoMudar(data)
  }

  async function removerArquivo() {
    setErro('')
    const { data, error } = await supabase.from('contratos')
      .update({ arquivo_caminho: null, arquivo_nome: null }).eq('id', contrato.id).select().single()
    if (error) return setErro(traduzirErro(error))
    await supabase.storage.from(BUCKET).remove([arquivo.caminho])
    setArquivo({ caminho: null, nome: null })
    aoMudar(data)
  }

  async function excluir() {
    const { error } = await supabase.from('contratos').delete().eq('id', contrato.id)
    if (error) return setErro(traduzirErro(error))
    if (arquivo.caminho) await supabase.storage.from(BUCKET).remove([arquivo.caminho])
    aoExcluir(contrato.id)
  }

  const situacao = situacaoContrato({ ...contrato, ...montar(form).campos })

  return (
    <Modal
      titulo={`Contrato · ${clientes.find((c) => c.id === form.cliente_id)?.nome || contrato.nome_cliente}`}
      aoFechar={fechar}
      largura={640}
      rodape={
        <>
          <BotaoExcluir aoConfirmar={excluir} texto="Excluir contrato" />
          <span className="espaco" />
          <StatusSalvamento estado={estado} />
          {estado === 'erro' && <button type="button" className="botao botao-secundario" onClick={salvarAgora}>Tentar de novo</button>}
          <button type="button" className="botao botao-principal" onClick={fechar}>Fechar</button>
        </>
      }
    >
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); salvarAgora() }}>
        <p className="contrato-situacao"><span className={`selo-lancamento lanc-${situacao.classe}`}>{situacao.texto}</span></p>
        <div className="grade-campos">
          <label className="campo">
            <span>Cliente</span>
            <select {...campo('cliente_id')}>
              {!form.cliente_id && <option value="">{contrato.nome_cliente} (cliente removido)</option>}
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativo ? '' : ' (inativo)'}</option>)}
            </select>
          </label>
          <label className="campo">
            <span>Situação</span>
            <select {...campo('status')}>
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </label>
          <label className="campo campo-largo">
            <span>Serviços contratados</span>
            <textarea rows={3} {...campo('servicos')} placeholder="Gestão de Instagram, 12 posts e 4 reels por mês…" />
          </label>
          <label className="campo">
            <span>Valor mensal</span>
            <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" {...campo('valor_mensal')} /></div>
          </label>
          <label className="campo">
            <span>Dia do pagamento</span>
            <input type="number" min={1} max={31} placeholder="Ex.: 10" {...campo('dia_vencimento')} />
          </label>
          <label className="campo">
            <span>Forma de pagamento</span>
            <select {...campo('forma_pagamento')}>
              <option value="">—</option>
              {Object.entries(FORMAS_PAGAMENTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          <span />
          <label className="campo">
            <span>Início</span>
            <input type="date" {...campo('inicio')} />
          </label>
          <label className="campo">
            <span>Fim</span>
            <input type="date" {...campo('fim')} />
            <small className="texto-suave">Vazio = sem prazo definido</small>
          </label>
          <label className="marcar marcar-campo">
            <input type="checkbox" checked={form.renovacao_automatica} onChange={(e) => definir('renovacao_automatica', e.target.checked)} />
            Renova automaticamente
          </label>
          <label className="campo">
            <span>Avisar quantos dias antes do fim</span>
            <input type="number" min={0} max={365} {...campo('aviso_previo_dias')} />
          </label>
          <label className="campo campo-largo">
            <span>Observações</span>
            <textarea rows={3} {...campo('observacoes')} placeholder="Multa por rescisão, reajuste anual, combinados…" />
          </label>
        </div>

        <div className="campo">
          <span>Arquivo do contrato</span>
          <div className="contrato-arquivo">
            {arquivo.caminho ? (
              <>
                <button type="button" className="botao-link" onClick={async () => setErro(await abrirArquivo(arquivo.caminho))}>
                  <Icone nome="anexo" tamanho={15} /> {arquivo.nome}
                </button>
                <span className="espaco" />
                <label className="botao botao-secundario botao-pequeno">
                  {enviando ? 'Enviando…' : 'Trocar'}
                  <input type="file" hidden onChange={enviarArquivo} disabled={enviando} accept=".pdf,image/*,.doc,.docx" />
                </label>
                <button type="button" className="botao botao-fantasma botao-pequeno" onClick={removerArquivo}>Remover</button>
              </>
            ) : (
              <label className="botao botao-secundario botao-pequeno">
                <Icone nome="anexo" tamanho={15} /> {enviando ? 'Enviando…' : 'Anexar arquivo'}
                <input type="file" hidden onChange={enviarArquivo} disabled={enviando} accept=".pdf,image/*,.doc,.docx" />
              </label>
            )}
          </div>
          <small className="texto-suave">PDF, imagem ou Word, até 20 MB. Só quem tem a Gestão liberada consegue abrir.</small>
        </div>

        {(erroValidacao || erro) && <p className="alerta alerta-erro">{erroValidacao || erro}</p>}
      </form>
    </Modal>
  )
}

function NovoContrato({ clientes, semContrato, aoFechar, aoCriar }) {
  const [clienteId, setClienteId] = useState(semContrato[0]?.id || clientes[0]?.id || '')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  async function criar(e) {
    e.preventDefault()
    const cliente = clientes.find((c) => c.id === clienteId)
    if (!cliente) return
    setCriando(true)
    const { data, error } = await supabase.from('contratos')
      .insert({ cliente_id: cliente.id, nome_cliente: cliente.nome, inicio: hojeISO() }).select().single()
    setCriando(false)
    if (error) return setErro(traduzirErro(error))
    aoCriar(data)
  }

  return (
    <Modal
      titulo="Novo contrato"
      aoFechar={aoFechar}
      largura={460}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-novo-contrato" className="botao botao-principal" disabled={!clienteId || criando}>
            {criando ? 'Criando…' : 'Criar e preencher'}
          </button>
        </>
      }
    >
      <form id="form-novo-contrato" className="formulario" onSubmit={criar}>
        <label className="campo">
          <span>Cliente</span>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} autoFocus>
            {semContrato.length > 0 && (
              <optgroup label="Sem contrato ativo">
                {semContrato.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </optgroup>
            )}
            <optgroup label="Já têm contrato ativo">
              {clientes.filter((c) => !semContrato.includes(c)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </optgroup>
          </select>
        </label>
        <p className="texto-suave">Depois de criar, o resto do contrato salva sozinho enquanto você preenche.</p>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function Contratos() {
  const [contratos, setContratos] = useState(null)
  const [clientes, setClientes] = useState([])
  const [editando, setEditando] = useState(null)
  const [criando, setCriando] = useState(false)
  const [verEncerrados, setVerEncerrados] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const [{ data: lista, error }, { data: cli }] = await Promise.all([
      supabase.from('contratos').select('*').order('nome_cliente'),
      supabase.from('clientes').select('id, nome, cor, ativo').order('nome'),
    ])
    if (error) setErro(traduzirErro(error))
    setContratos(lista || [])
    setClientes(cli || [])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const atualizar = (novo) => setContratos((atual) => {
    const existe = atual.some((c) => c.id === novo.id)
    return (existe ? atual.map((c) => (c.id === novo.id ? novo : c)) : [...atual, novo])
      .sort((a, b) => a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR'))
  })

  if (contratos === null) return <p className="texto-suave recuo espaco-topo">Carregando…</p>

  const ativos = contratos.filter((c) => c.status === 'ativo')
  const encerrados = contratos.filter((c) => c.status === 'encerrado')
  const comContrato = new Set(ativos.map((c) => c.cliente_id))
  const semContrato = clientes.filter((c) => c.ativo && !comContrato.has(c.id))
  const totalMensal = ativos.reduce((s, c) => s + Number(c.valor_mensal || 0), 0)
  const atencao = ativos.filter((c) => ['pendente', 'vencido'].includes(situacaoContrato(c).classe)).length

  const tabela = (lista) => (
    <div className="recuo cartao tabela-rolagem">
      <table className="tabela tabela-lancamentos">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Serviços</th>
            <th>Vigência</th>
            <th>Situação</th>
            <th className="direita">Valor mensal</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c) => {
            const situacao = situacaoContrato(c)
            const cliente = clientes.find((x) => x.id === c.cliente_id)
            return (
              <tr key={c.id} className={`linha-clicavel ${c.status === 'encerrado' ? 'inativo' : ''}`} onClick={() => setEditando(c)}>
                <td data-rotulo="Cliente">
                  <strong className="contrato-cliente">
                    <span className="bolinha-cliente" style={{ background: cliente?.cor || 'var(--borda-forte)' }} />
                    {cliente?.nome || c.nome_cliente}
                    {c.arquivo_caminho && <Icone nome="anexo" tamanho={14} />}
                  </strong>
                </td>
                <td data-rotulo="Serviços" className="contrato-servicos">{c.servicos || <span className="texto-suave">—</span>}</td>
                <td data-rotulo="Vigência">{vigencia(c)}</td>
                <td data-rotulo="Situação"><span className={`selo-lancamento lanc-${situacao.classe}`}>{situacao.texto}</span></td>
                <td data-rotulo="Valor mensal" className="direita"><span className="valor">{formatarMoeda(c.valor_mensal)}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="secao-financeiro">
      <div className="barra-ferramentas">
        <div className="totais">
          <span>Contratos ativos <strong>{ativos.length}</strong></span>
          <span>Soma mensal <strong>{formatarMoeda(totalMensal)}</strong></span>
          {atencao > 0 && <span>Precisam de atenção <strong>{atencao}</strong></span>}
        </div>
        <span className="espaco" />
        <button className="botao botao-principal botao-pequeno" onClick={() => setCriando(true)} disabled={clientes.length === 0}>
          <Icone nome="mais" tamanho={16} /> Novo contrato
        </button>
      </div>

      {erro && <p className="alerta alerta-erro recuo">{erro}</p>}

      {ativos.length === 0 ? (
        <div className="cartao vazio recuo">
          <p>Nenhum contrato ativo ainda.</p>
          <p>Quando um prospect vira cliente na Prospecção, o contrato aparece aqui sozinho. Para clientes antigos, use “Novo contrato”.</p>
        </div>
      ) : tabela(ativos)}

      {semContrato.length > 0 && (
        <section className="recuo espaco-topo">
          <h3 className="titulo-secao">Clientes sem contrato ativo</h3>
          <div className="lista-sem-contrato">
            {semContrato.map((c) => (
              <button key={c.id} className="botao botao-secundario botao-pequeno" onClick={async () => {
                const { data, error } = await supabase.from('contratos')
                  .insert({ cliente_id: c.id, nome_cliente: c.nome, inicio: hojeISO() }).select().single()
                if (error) return setErro(traduzirErro(error))
                atualizar(data)
                setEditando(data)
              }}>
                <span className="bolinha-cliente" style={{ background: c.cor || 'var(--borda-forte)' }} />
                {c.nome} <Icone nome="mais" tamanho={14} />
              </button>
            ))}
          </div>
        </section>
      )}

      {encerrados.length > 0 && (
        <section className="espaco-topo">
          <button className="botao-link recuo" onClick={() => setVerEncerrados(!verEncerrados)}>
            {verEncerrados ? 'Esconder' : 'Ver'} contratos encerrados ({encerrados.length})
          </button>
          {verEncerrados && <div className="espaco-topo">{tabela(encerrados)}</div>}
        </section>
      )}

      {criando && (
        <NovoContrato
          clientes={clientes.filter((c) => c.ativo)}
          semContrato={semContrato}
          aoFechar={() => setCriando(false)}
          aoCriar={(novo) => { atualizar(novo); setCriando(false); setEditando(novo) }}
        />
      )}
      {editando && (
        <ContratoModal
          contrato={editando}
          clientes={clientes}
          aoFechar={() => setEditando(null)}
          aoMudar={atualizar}
          aoExcluir={(id) => { setContratos((atual) => atual.filter((c) => c.id !== id)); setEditando(null) }}
        />
      )}
    </div>
  )
}
