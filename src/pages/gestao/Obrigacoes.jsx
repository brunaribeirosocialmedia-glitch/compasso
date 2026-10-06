import { useCallback, useEffect, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { deISO, formatarData, hojeISO, paraISO } from '../../lib/datas'
import { formatarMoeda, lerMoeda, paraCampoMoeda } from '../../lib/moeda'
import { useAutoSalvar, useFecharSalvando } from '../../lib/useAutoSalvar'
import Modal, { BotaoExcluir } from '../../components/Modal'
import StatusSalvamento from '../../components/StatusSalvamento'
import Icone from '../../components/Icone'

export const CATEGORIAS_OBRIGACAO = {
  imposto: 'Imposto',
  declaracao: 'Declaração',
  renovacao: 'Renovação',
  taxa: 'Taxa',
  outro: 'Outro',
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// Sugestões para começar rápido — tudo pode ser ajustado depois
const SUGESTOES = [
  { nome: 'DAS', categoria: 'imposto', recorrencia: 'mensal', dia: 20 },
  { nome: 'DEFIS', categoria: 'declaracao', recorrencia: 'anual', dia: 31, mes: 3 },
  { nome: 'DASN-SIMEI', categoria: 'declaracao', recorrencia: 'anual', dia: 31, mes: 5 },
  { nome: 'Alvará de funcionamento', categoria: 'renovacao', recorrencia: 'anual' },
  { nome: 'Certificado digital', categoria: 'renovacao', recorrencia: 'anual' },
  { nome: 'Domínio do site', categoria: 'renovacao', recorrencia: 'anual' },
]

const diasAte = (data) => Math.round((deISO(data) - deISO(hojeISO())) / 86400000)

export function seloVencimento(vencimento) {
  const dias = diasAte(vencimento)
  if (dias < 0) return { classe: 'vencido', texto: `Atrasada há ${-dias} dia${dias === -1 ? '' : 's'}` }
  if (dias === 0) return { classe: 'pendente', texto: 'Vence hoje' }
  if (dias <= 7) return { classe: 'pendente', texto: `Em ${dias} dia${dias === 1 ? '' : 's'}` }
  return { classe: 'neutro', texto: `Em ${dias} dias` }
}

// Dia do mês respeitando meses curtos (mesma regra do banco)
function diaNoMes(ano, mes, dia) {
  const ultimo = new Date(ano, mes, 0).getDate()
  return paraISO(new Date(ano, mes - 1, Math.min(dia, ultimo)))
}

export function descreverRecorrencia(o) {
  if (o.recorrencia === 'mensal') return o.dia ? `Todo mês, dia ${o.dia}` : 'Todo mês · falta o dia'
  if (o.recorrencia === 'anual') return o.dia && o.mes ? `Todo ano, ${o.dia} de ${MESES[o.mes - 1]}` : 'Todo ano · falta a data'
  return o.data_unica ? `Uma vez, ${formatarData(o.data_unica, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'Uma vez · falta a data'
}

function proximoVencimento(o) {
  const hoje = hojeISO()
  const [a, m] = hoje.split('-').map(Number)
  if (o.recorrencia === 'mensal' && o.dia) {
    const este = diaNoMes(a, m, o.dia)
    return este >= hoje ? este : diaNoMes(m === 12 ? a + 1 : a, m === 12 ? 1 : m + 1, o.dia)
  }
  if (o.recorrencia === 'anual' && o.dia && o.mes) {
    const este = diaNoMes(a, o.mes, o.dia)
    return este >= hoje ? este : diaNoMes(a + 1, o.mes, o.dia)
  }
  if (o.recorrencia === 'unica') return o.data_unica
  return null
}

const curta = (data) => formatarData(data, { day: '2-digit', month: '2-digit', year: '2-digit' })

// ---------------------------------------------------------------------
// Cadastro da obrigação (salva sozinho)
// ---------------------------------------------------------------------
function ObrigacaoModal({ obrigacao, aoFechar, aoMudar, aoExcluir }) {
  const [form, setForm] = useState(() => ({
    nome: obrigacao.nome,
    categoria: obrigacao.categoria,
    recorrencia: obrigacao.recorrencia,
    dia: obrigacao.dia ?? '',
    mes: obrigacao.mes ?? '',
    data_unica: obrigacao.data_unica || '',
    valor_estimado: paraCampoMoeda(obrigacao.valor_estimado),
    gera_despesa: obrigacao.gera_despesa,
    ativo: obrigacao.ativo,
    observacoes: obrigacao.observacoes || '',
  }))
  const [erro, setErro] = useState('')
  const definir = (chave, valor) => setForm((f) => ({ ...f, [chave]: valor }))
  const campo = (chave) => ({ value: form[chave], onChange: (e) => definir(chave, e.target.value) })

  function montar(f) {
    if (!f.nome.trim()) return { erro: 'Dê um nome para a obrigação.' }
    const valor = lerMoeda(f.valor_estimado)
    if (Number.isNaN(valor) || valor < 0) return { erro: 'Confira o valor: use números, como 86,05.' }
    const dia = f.dia === '' ? null : Number(f.dia)
    if (f.recorrencia !== 'unica' && dia != null && !(Number.isInteger(dia) && dia >= 1 && dia <= 31)) {
      return { erro: 'O dia vai de 1 a 31.' }
    }
    return {
      campos: {
        nome: f.nome.trim(),
        categoria: f.categoria,
        recorrencia: f.recorrencia,
        dia: f.recorrencia === 'unica' ? null : dia,
        mes: f.recorrencia === 'anual' && f.mes !== '' ? Number(f.mes) : null,
        data_unica: f.recorrencia === 'unica' ? f.data_unica || null : null,
        valor_estimado: valor,
        gera_despesa: f.gera_despesa,
        ativo: f.ativo,
        observacoes: f.observacoes.trim() || null,
      },
    }
  }

  async function gravar(campos) {
    const { data, error } = await supabase.from('obrigacoes').update(campos).eq('id', obrigacao.id).select().single()
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

  async function excluir() {
    const { error } = await supabase.from('obrigacoes').delete().eq('id', obrigacao.id)
    if (error) return setErro(traduzirErro(error))
    aoExcluir(obrigacao.id)
  }

  const semData = (form.recorrencia === 'mensal' && form.dia === '')
    || (form.recorrencia === 'anual' && (form.dia === '' || form.mes === ''))
    || (form.recorrencia === 'unica' && !form.data_unica)

  return (
    <Modal
      titulo="Obrigação"
      aoFechar={fechar}
      largura={600}
      rodape={
        <>
          <BotaoExcluir aoConfirmar={excluir} texto="Excluir obrigação" />
          <span className="espaco" />
          <StatusSalvamento estado={estado} />
          {estado === 'erro' && <button type="button" className="botao botao-secundario" onClick={salvarAgora}>Tentar de novo</button>}
          <button type="button" className="botao botao-principal" onClick={fechar}>Fechar</button>
        </>
      }
    >
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); salvarAgora() }}>
        <div className="grade-campos">
          <label className="campo">
            <span>Nome</span>
            <input {...campo('nome')} required />
          </label>
          <label className="campo">
            <span>Tipo</span>
            <select {...campo('categoria')}>
              {Object.entries(CATEGORIAS_OBRIGACAO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
        </div>

        <div className="campo">
          <span>Repete</span>
          <div className="status-tarefa" role="radiogroup" aria-label="Repetição">
            {[['mensal', 'Todo mês'], ['anual', 'Todo ano'], ['unica', 'Uma vez só']].map(([v, n]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.recorrencia === v}
                className={`status-opcao ${form.recorrencia === v ? 'marcado' : ''}`}
                onClick={() => definir('recorrencia', v)}
              >
                {form.recorrencia === v && <Icone nome="confirmar" tamanho={15} />}
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grade-campos">
          {form.recorrencia !== 'unica' && (
            <label className="campo">
              <span>Dia do vencimento</span>
              <input type="number" min={1} max={31} placeholder="Ex.: 20" {...campo('dia')} />
            </label>
          )}
          {form.recorrencia === 'anual' && (
            <label className="campo">
              <span>Mês</span>
              <select {...campo('mes')}>
                <option value="">—</option>
                {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
              </select>
            </label>
          )}
          {form.recorrencia === 'unica' && (
            <label className="campo">
              <span>Data</span>
              <input type="date" {...campo('data_unica')} />
            </label>
          )}
          <label className="campo">
            <span>Valor {form.recorrencia === 'unica' ? '' : 'de cada vez'}</span>
            <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" {...campo('valor_estimado')} /></div>
          </label>
          <label className="marcar marcar-campo campo-largo">
            <input type="checkbox" checked={form.gera_despesa} onChange={(e) => definir('gera_despesa', e.target.checked)} />
            Lançar no Financeiro (entra em Custos fixos no mês do vencimento)
          </label>
          <label className="campo campo-largo">
            <span>Observações</span>
            <textarea rows={3} {...campo('observacoes')} placeholder="Onde pagar, quem cuida, portal de acesso…" />
          </label>
          <label className="marcar campo-largo">
            <input type="checkbox" checked={form.ativo} onChange={(e) => definir('ativo', e.target.checked)} />
            Ativa (desmarque se a obrigação deixou de existir: os vencimentos param de aparecer)
          </label>
        </div>

        {semData && <p className="alerta alerta-aviso">Preencha a data do vencimento para ela aparecer em “A fazer”.</p>}
        {form.gera_despesa && lerMoeda(form.valor_estimado) == null && (
          <p className="alerta alerta-aviso">Sem valor, nada vai para o Financeiro. Você também pode informar o valor em cada vencimento.</p>
        )}
        <p className="texto-suave explicacao">Mudanças aqui refazem os vencimentos ainda pendentes deste mês em diante. Os que já foram feitos não mudam.</p>
        {(erroValidacao || erro) && <p className="alerta alerta-erro">{erroValidacao || erro}</p>}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Um vencimento (salva sozinho)
// ---------------------------------------------------------------------
function OcorrenciaModal({ ocorrencia, obrigacao, aoFechar, aoMudar, aoEditarCadastro }) {
  const [form, setForm] = useState(() => ({
    status: ocorrencia.status,
    valor: paraCampoMoeda(ocorrencia.valor),
    feito_em: ocorrencia.feito_em || '',
    observacoes: ocorrencia.observacoes || '',
  }))
  const [erro, setErro] = useState('')
  const definir = (chave, valor) => setForm((f) => ({ ...f, [chave]: valor }))

  function montar(f) {
    const valor = lerMoeda(f.valor)
    if (Number.isNaN(valor) || valor < 0) return { erro: 'Confira o valor: use números, como 86,05.' }
    return {
      campos: {
        status: f.status,
        valor,
        feito_em: f.status === 'feito' ? f.feito_em || null : null,
        observacoes: f.observacoes.trim() || null,
      },
    }
  }

  async function gravar(campos) {
    const { data, error } = await supabase.from('obrigacao_ocorrencias').update(campos).eq('id', ocorrencia.id).select().single()
    if (error) {
      setErro(traduzirErro(error))
      return false
    }
    setErro('')
    if (data.feito_em && data.feito_em !== form.feito_em) setForm((f) => ({ ...f, feito_em: data.feito_em }))
    aoMudar(data)
    return true
  }

  const { estado, erroValidacao, salvarAgora } = useAutoSalvar(form, { montar, gravar })
  const fechar = useFecharSalvando(salvarAgora, aoFechar)

  return (
    <Modal
      titulo={`${obrigacao.nome} · ${formatarData(ocorrencia.vencimento, { day: '2-digit', month: 'long', year: 'numeric' })}`}
      aoFechar={fechar}
      largura={520}
      rodape={
        <>
          <button type="button" className="botao botao-fantasma" onClick={async () => { if (await salvarAgora()) aoEditarCadastro() }}>Editar cadastro</button>
          <span className="espaco" />
          <StatusSalvamento estado={estado} />
          {estado === 'erro' && <button type="button" className="botao botao-secundario" onClick={salvarAgora}>Tentar de novo</button>}
          <button type="button" className="botao botao-principal" onClick={fechar}>Fechar</button>
        </>
      }
    >
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); salvarAgora() }}>
        <div className="campo">
          <span>Situação</span>
          <div className="status-tarefa" role="radiogroup" aria-label="Situação">
            {[['pendente', 'Pendente'], ['feito', 'Feito'], ['dispensada', 'Não precisou']].map(([v, n]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.status === v}
                className={`status-opcao ${form.status === v ? 'marcado' : ''}`}
                onClick={() => definir('status', v)}
              >
                {form.status === v && <Icone nome="confirmar" tamanho={15} />}
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="grade-campos">
          <label className="campo">
            <span>Valor</span>
            <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => definir('valor', e.target.value)} /></div>
          </label>
          {form.status === 'feito' && (
            <label className="campo">
              <span>Feito em</span>
              <input type="date" value={form.feito_em} onChange={(e) => definir('feito_em', e.target.value)} />
            </label>
          )}
          <label className="campo campo-largo">
            <span>Observações</span>
            <textarea rows={3} value={form.observacoes} onChange={(e) => definir('observacoes', e.target.value)} placeholder="Número do recibo, protocolo…" />
          </label>
        </div>
        {obrigacao.gera_despesa && (
          <p className="texto-suave explicacao">
            {ocorrencia.custo_fixo_id || lerMoeda(form.valor) != null
              ? 'Este vencimento está em Financeiro › Custos fixos. Marcar como feito lá ou aqui muda os dois.'
              : 'Informe o valor para ele entrar em Financeiro › Custos fixos.'}
          </p>
        )}
        {(erroValidacao || erro) && <p className="alerta alerta-erro">{erroValidacao || erro}</p>}
      </form>
    </Modal>
  )
}

function NovaObrigacao({ aoFechar, aoCriar }) {
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  async function criar(dados) {
    if (!dados.nome.trim()) return
    setCriando(true)
    const { data, error } = await supabase.from('obrigacoes').insert({ ...dados, nome: dados.nome.trim() }).select().single()
    setCriando(false)
    if (error) return setErro(traduzirErro(error))
    aoCriar(data)
  }

  return (
    <Modal
      titulo="Nova obrigação"
      aoFechar={aoFechar}
      largura={500}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-nova-obrigacao" className="botao botao-principal" disabled={!nome.trim() || criando}>
            {criando ? 'Criando…' : 'Criar e preencher'}
          </button>
        </>
      }
    >
      <form id="form-nova-obrigacao" className="formulario" onSubmit={(e) => { e.preventDefault(); criar({ nome }) }}>
        <label className="campo">
          <span>Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="DAS, alvará, anuidade do conselho…" autoFocus />
        </label>
        <div className="campo">
          <span>Ou comece por uma sugestão</span>
          <div className="lista-sem-contrato">
            {SUGESTOES.map((s) => (
              <button key={s.nome} type="button" className="botao botao-secundario botao-pequeno" disabled={criando} onClick={() => criar(s)}>
                {s.nome}
              </button>
            ))}
          </div>
          <small className="texto-suave">As sugestões já vêm com a data mais comum; confira se vale para a sua empresa.</small>
        </div>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function Obrigacoes() {
  const [obrigacoes, setObrigacoes] = useState(null)
  const [ocorrencias, setOcorrencias] = useState([])
  const [editando, setEditando] = useState(null)       // cadastro
  const [abrindo, setAbrindo] = useState(null)         // vencimento
  const [criando, setCriando] = useState(false)
  const [verFeitas, setVerFeitas] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    await supabase.rpc('gerar_obrigacoes')
    const desde = paraISO(new Date(Date.now() - 90 * 86400000))
    const [{ data: obs, error }, { data: oc }] = await Promise.all([
      supabase.from('obrigacoes').select('*').order('nome'),
      supabase.from('obrigacao_ocorrencias').select('*')
        .or(`status.eq.pendente,vencimento.gte.${desde}`).order('vencimento'),
    ])
    if (error) setErro(traduzirErro(error))
    setObrigacoes(obs || [])
    setOcorrencias(oc || [])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (obrigacoes === null) return <p className="texto-suave recuo espaco-topo">Carregando…</p>

  const porId = Object.fromEntries(obrigacoes.map((o) => [o.id, o]))
  const pendentes = ocorrencias.filter((o) => o.status === 'pendente' && porId[o.obrigacao_id])
  const feitas = ocorrencias.filter((o) => o.status !== 'pendente' && porId[o.obrigacao_id]).reverse()
  const hoje = hojeISO()
  const atrasadas = pendentes.filter((o) => o.vencimento < hoje).length
  const esteMes = pendentes.filter((o) => o.vencimento.slice(0, 7) === hoje.slice(0, 7)).length

  async function marcarFeito(oc) {
    setErro('')
    setOcorrencias((atual) => atual.map((x) => (x.id === oc.id ? { ...x, status: 'feito', feito_em: hoje } : x)))
    const { error } = await supabase.from('obrigacao_ocorrencias').update({ status: 'feito' }).eq('id', oc.id)
    if (error) setErro(traduzirErro(error))
    carregar()
  }

  const fecharCadastro = () => { setEditando(null); carregar() }

  return (
    <div className="secao-financeiro">
      <div className="barra-ferramentas">
        <div className="totais">
          <span>Atrasadas <strong className={atrasadas ? 'negativo' : ''}>{atrasadas}</strong></span>
          <span>Pendentes este mês <strong>{esteMes}</strong></span>
        </div>
        <span className="espaco" />
        <button className="botao botao-principal botao-pequeno" onClick={() => setCriando(true)}>
          <Icone nome="mais" tamanho={16} /> Nova obrigação
        </button>
      </div>

      {erro && <p className="alerta alerta-erro recuo">{erro}</p>}

      <section>
        <h3 className="titulo-secao recuo">A fazer</h3>
        {pendentes.length === 0 ? (
          <div className="cartao vazio recuo">
            <p>{obrigacoes.length === 0
              ? 'Nenhuma obrigação cadastrada. Comece pelo DAS ou por outra sugestão em “Nova obrigação”.'
              : 'Nada pendente até o fim do mês que vem.'}</p>
          </div>
        ) : (
          <div className="recuo cartao tabela-rolagem">
            <table className="tabela tabela-lancamentos">
              <thead>
                <tr>
                  <th>Obrigação</th>
                  <th>Vencimento</th>
                  <th>Situação</th>
                  <th className="direita">Valor</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {pendentes.map((oc) => {
                  const ob = porId[oc.obrigacao_id]
                  const selo = seloVencimento(oc.vencimento)
                  return (
                    <tr key={oc.id} className="linha-clicavel" onClick={() => setAbrindo(oc)}>
                      <td data-rotulo="Obrigação">
                        <strong>{ob.nome}</strong> <span className="texto-suave obrigacao-tipo">{CATEGORIAS_OBRIGACAO[ob.categoria]}</span>
                      </td>
                      <td data-rotulo="Vencimento">{curta(oc.vencimento)}</td>
                      <td data-rotulo="Situação"><span className={`selo-lancamento lanc-${selo.classe}`}>{selo.texto}</span></td>
                      <td data-rotulo="Valor" className="direita"><span className="valor">{formatarMoeda(oc.valor)}</span></td>
                      <td className="acoes-linha" onClick={(e) => e.stopPropagation()}>
                        <button className="botao-link" onClick={() => marcarFeito(oc)}>Marcar feito</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {obrigacoes.length > 0 && (
        <section className="espaco-topo">
          <h3 className="titulo-secao recuo">Cadastro</h3>
          <div className="recuo cartao tabela-rolagem">
            <table className="tabela tabela-lancamentos">
              <thead>
                <tr>
                  <th>Obrigação</th>
                  <th>Repete</th>
                  <th>Próximo vencimento</th>
                  <th>Financeiro</th>
                  <th className="direita">Valor</th>
                </tr>
              </thead>
              <tbody>
                {obrigacoes.map((o) => {
                  const proximo = o.ativo ? proximoVencimento(o) : null
                  return (
                    <tr key={o.id} className={`linha-clicavel ${o.ativo ? '' : 'inativo'}`} onClick={() => setEditando(o)}>
                      <td data-rotulo="Obrigação">
                        <strong>{o.nome}</strong> <span className="texto-suave obrigacao-tipo">{CATEGORIAS_OBRIGACAO[o.categoria]}</span>
                      </td>
                      <td data-rotulo="Repete">{o.ativo ? descreverRecorrencia(o) : 'Inativa'}</td>
                      <td data-rotulo="Próximo vencimento">{proximo ? curta(proximo) : <span className="texto-suave">—</span>}</td>
                      <td data-rotulo="Financeiro">{o.gera_despesa ? 'Lança em Custos fixos' : <span className="texto-suave">Não lança</span>}</td>
                      <td data-rotulo="Valor" className="direita"><span className="valor">{formatarMoeda(o.valor_estimado)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {feitas.length > 0 && (
        <section className="espaco-topo">
          <button className="botao-link recuo" onClick={() => setVerFeitas(!verFeitas)}>
            {verFeitas ? 'Esconder' : 'Ver'} feitas nos últimos 3 meses ({feitas.length})
          </button>
          {verFeitas && (
            <div className="recuo cartao tabela-rolagem espaco-topo">
              <table className="tabela tabela-lancamentos">
                <thead>
                  <tr>
                    <th>Obrigação</th>
                    <th>Vencimento</th>
                    <th>Situação</th>
                    <th className="direita">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {feitas.map((oc) => (
                    <tr key={oc.id} className="linha-clicavel" onClick={() => setAbrindo(oc)}>
                      <td data-rotulo="Obrigação"><strong>{porId[oc.obrigacao_id].nome}</strong></td>
                      <td data-rotulo="Vencimento">{curta(oc.vencimento)}</td>
                      <td data-rotulo="Situação">
                        {oc.status === 'feito'
                          ? <span className="selo-lancamento lanc-pago">Feito {oc.feito_em ? `em ${curta(oc.feito_em)}` : ''}</span>
                          : <span className="selo-lancamento lanc-cancelado">Não precisou</span>}
                      </td>
                      <td data-rotulo="Valor" className="direita"><span className="valor">{formatarMoeda(oc.valor)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {criando && (
        <NovaObrigacao
          aoFechar={() => setCriando(false)}
          aoCriar={(nova) => { setCriando(false); setObrigacoes((atual) => [...atual, nova]); setEditando(nova) }}
        />
      )}
      {editando && (
        <ObrigacaoModal
          obrigacao={editando}
          aoFechar={fecharCadastro}
          aoMudar={(nova) => setObrigacoes((atual) => atual.map((o) => (o.id === nova.id ? nova : o)))}
          aoExcluir={(id) => { setObrigacoes((atual) => atual.filter((o) => o.id !== id)); setEditando(null); carregar() }}
        />
      )}
      {abrindo && porId[abrindo.obrigacao_id] && (
        <OcorrenciaModal
          ocorrencia={abrindo}
          obrigacao={porId[abrindo.obrigacao_id]}
          aoFechar={() => { setAbrindo(null); carregar() }}
          aoMudar={(nova) => setOcorrencias((atual) => atual.map((o) => (o.id === nova.id ? nova : o)))}
          aoEditarCadastro={() => { const ob = porId[abrindo.obrigacao_id]; setAbrindo(null); setEditando(ob) }}
        />
      )}
    </div>
  )
}
