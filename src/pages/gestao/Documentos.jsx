import { useCallback, useEffect, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { deISO, formatarData, hojeISO } from '../../lib/datas'
import { useAutoSalvar, useFecharSalvando } from '../../lib/useAutoSalvar'
import Modal, { BotaoExcluir } from '../../components/Modal'
import StatusSalvamento from '../../components/StatusSalvamento'
import ArquivoAnexo, { abrirArquivo } from '../../components/ArquivoAnexo'
import Icone from '../../components/Icone'

const BUCKET = 'documentos'

export const CATEGORIAS_DOCUMENTO = {
  empresa: 'Empresa',
  certidao: 'Certidões',
  licenca: 'Licenças e alvarás',
  bancario: 'Bancário',
  outro: 'Outros',
}

// Sugestões para começar rápido — a validade de cada um é preenchida no próprio documento
const SUGESTOES = [
  { nome: 'Cartão CNPJ', categoria: 'empresa' },
  { nome: 'Contrato social', categoria: 'empresa' },
  { nome: 'Certificado MEI (CCMEI)', categoria: 'empresa' },
  { nome: 'Inscrição municipal', categoria: 'empresa' },
  { nome: 'Certidão negativa federal', categoria: 'certidao' },
  { nome: 'Certidão do FGTS', categoria: 'certidao' },
  { nome: 'Certidão negativa municipal', categoria: 'certidao' },
  { nome: 'Certidão negativa estadual', categoria: 'certidao' },
  { nome: 'Alvará de funcionamento', categoria: 'licenca' },
  { nome: 'Comprovante de conta PJ', categoria: 'bancario' },
]

const diasAte = (data) => Math.round((deISO(data) - deISO(hojeISO())) / 86400000)
const curta = (data) => formatarData(data, { day: '2-digit', month: '2-digit', year: '2-digit' })

export function situacaoDocumento(d) {
  if (!d.validade) return { classe: 'neutro', texto: 'Sem validade' }
  const dias = diasAte(d.validade)
  if (dias < 0) return { classe: 'vencido', texto: 'Vencido' }
  if (dias === 0) return { classe: 'pendente', texto: 'Vence hoje' }
  if (dias <= d.aviso_dias) return { classe: 'pendente', texto: `Vence em ${dias} dia${dias === 1 ? '' : 's'}` }
  return { classe: 'pago', texto: 'Válido' }
}

function DocumentoModal({ documento, aoFechar, aoMudar, aoExcluir }) {
  const [form, setForm] = useState(() => ({
    nome: documento.nome,
    categoria: documento.categoria,
    numero: documento.numero || '',
    emissao: documento.emissao || '',
    validade: documento.validade || '',
    aviso_dias: documento.aviso_dias ?? 30,
    observacoes: documento.observacoes || '',
  }))
  const [arquivo, setArquivo] = useState({ caminho: documento.arquivo_caminho, nome: documento.arquivo_nome })
  const [erro, setErro] = useState('')
  const campo = (chave) => ({ value: form[chave], onChange: (e) => setForm((f) => ({ ...f, [chave]: e.target.value })) })

  function montar(f) {
    if (!f.nome.trim()) return { erro: 'Dê um nome para o documento.' }
    if (f.emissao && f.validade && f.validade < f.emissao) return { erro: 'A validade não pode ser antes da emissão.' }
    const aviso = f.aviso_dias === '' ? 30 : Number(f.aviso_dias)
    if (!(Number.isInteger(aviso) && aviso >= 0 && aviso <= 365)) return { erro: 'O aviso vai de 0 a 365 dias.' }
    return {
      campos: {
        nome: f.nome.trim(),
        categoria: f.categoria,
        numero: f.numero.trim() || null,
        emissao: f.emissao || null,
        validade: f.validade || null,
        aviso_dias: aviso,
        observacoes: f.observacoes.trim() || null,
      },
    }
  }

  async function gravar(campos) {
    const { data, error } = await supabase.from('documentos').update(campos).eq('id', documento.id).select().single()
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
    const { error } = await supabase.from('documentos').delete().eq('id', documento.id)
    if (error) return setErro(traduzirErro(error))
    if (arquivo.caminho) await supabase.storage.from(BUCKET).remove([arquivo.caminho])
    aoExcluir(documento.id)
  }

  const situacao = situacaoDocumento({ ...documento, ...montar(form).campos })

  return (
    <Modal
      titulo="Documento"
      aoFechar={fechar}
      largura={580}
      rodape={
        <>
          <BotaoExcluir aoConfirmar={excluir} texto="Excluir documento" />
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
            <span>Nome</span>
            <input {...campo('nome')} required />
          </label>
          <label className="campo">
            <span>Tipo</span>
            <select {...campo('categoria')}>
              {Object.entries(CATEGORIAS_DOCUMENTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          <label className="campo campo-largo">
            <span>Número</span>
            <input {...campo('numero')} placeholder="CNPJ, número da certidão, protocolo…" />
          </label>
          <label className="campo">
            <span>Emissão</span>
            <input type="date" {...campo('emissao')} />
          </label>
          <label className="campo">
            <span>Validade</span>
            <input type="date" {...campo('validade')} />
            <small className="texto-suave">Vazio = não vence</small>
          </label>
          {form.validade && (
            <label className="campo">
              <span>Avisar quantos dias antes</span>
              <input type="number" min={0} max={365} {...campo('aviso_dias')} />
            </label>
          )}
          <label className="campo campo-largo">
            <span>Observações</span>
            <textarea rows={3} {...campo('observacoes')} placeholder="Onde emitir de novo, quem pediu, link do portal…" />
          </label>
        </div>

        <ArquivoAnexo
          bucket={BUCKET}
          tabela="documentos"
          id={documento.id}
          arquivo={arquivo}
          aoMudar={(data) => { setArquivo({ caminho: data.arquivo_caminho, nome: data.arquivo_nome }); aoMudar(data) }}
          aoErro={setErro}
        />

        {(erroValidacao || erro) && <p className="alerta alerta-erro">{erroValidacao || erro}</p>}
      </form>
    </Modal>
  )
}

function NovoDocumento({ existentes, aoFechar, aoCriar }) {
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  const jaTem = new Set(existentes.map((d) => d.nome.toLowerCase()))

  async function criar(dados) {
    if (!dados.nome.trim()) return
    setCriando(true)
    const { data, error } = await supabase.from('documentos').insert({ ...dados, nome: dados.nome.trim() }).select().single()
    setCriando(false)
    if (error) return setErro(traduzirErro(error))
    aoCriar(data)
  }

  const sugestoes = SUGESTOES.filter((s) => !jaTem.has(s.nome.toLowerCase()))

  return (
    <Modal
      titulo="Novo documento"
      aoFechar={aoFechar}
      largura={520}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-novo-documento" className="botao botao-principal" disabled={!nome.trim() || criando}>
            {criando ? 'Criando…' : 'Criar e preencher'}
          </button>
        </>
      }
    >
      <form id="form-novo-documento" className="formulario" onSubmit={(e) => { e.preventDefault(); criar({ nome, categoria: 'outro' }) }}>
        <label className="campo">
          <span>Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do documento" autoFocus />
        </label>
        {sugestoes.length > 0 && (
          <div className="campo">
            <span>Ou comece por uma sugestão</span>
            <div className="lista-sem-contrato">
              {sugestoes.map((s) => (
                <button key={s.nome} type="button" className="botao botao-secundario botao-pequeno" disabled={criando} onClick={() => criar(s)}>
                  {s.nome}
                </button>
              ))}
            </div>
          </div>
        )}
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function Documentos() {
  const [documentos, setDocumentos] = useState(null)
  const [editando, setEditando] = useState(null)
  const [criando, setCriando] = useState(false)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('documentos').select('*').order('nome')
    if (error) setErro(traduzirErro(error))
    setDocumentos(data || [])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (documentos === null) return <p className="texto-suave recuo espaco-topo">Carregando…</p>

  const atualizar = (novo) => setDocumentos((atual) => {
    const existe = atual.some((d) => d.id === novo.id)
    return (existe ? atual.map((d) => (d.id === novo.id ? novo : d)) : [...atual, novo])
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  })

  const termo = busca.trim().toLowerCase()
  const visiveis = documentos.filter((d) => !termo
    || d.nome.toLowerCase().includes(termo) || (d.numero || '').toLowerCase().includes(termo))
  const vencendo = documentos.filter((d) => situacaoDocumento(d).classe === 'pendente').length
  const vencidos = documentos.filter((d) => situacaoDocumento(d).classe === 'vencido').length

  return (
    <div className="secao-financeiro">
      <div className="barra-ferramentas">
        <div className="totais">
          <span>Documentos <strong>{documentos.length}</strong></span>
          {vencendo > 0 && <span>Vencendo <strong>{vencendo}</strong></span>}
          {vencidos > 0 && <span>Vencidos <strong className="negativo">{vencidos}</strong></span>}
        </div>
        <span className="espaco" />
        {documentos.length > 5 && (
          <label className="busca">
            <Icone nome="busca" tamanho={16} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar documento" aria-label="Buscar documento" />
          </label>
        )}
        <button className="botao botao-principal botao-pequeno" onClick={() => setCriando(true)}>
          <Icone nome="mais" tamanho={16} /> Novo documento
        </button>
      </div>

      {erro && <p className="alerta alerta-erro recuo">{erro}</p>}

      {documentos.length === 0 ? (
        <div className="cartao vazio recuo">
          <p>Nenhum documento guardado ainda.</p>
          <p>Comece pelo cartão CNPJ e pelo contrato social em “Novo documento”. As certidões com validade avisam antes de vencer.</p>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="texto-suave recuo">Nenhum documento encontrado para “{busca}”.</p>
      ) : (
        Object.entries(CATEGORIAS_DOCUMENTO).map(([categoria, titulo]) => {
          const lista = visiveis.filter((d) => d.categoria === categoria)
          if (lista.length === 0) return null
          return (
            <section key={categoria} className="grupo-documentos">
              <h3 className="titulo-secao recuo">{titulo}</h3>
              <div className="recuo cartao tabela-rolagem">
                <table className="tabela tabela-lancamentos">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Número</th>
                      <th>Validade</th>
                      <th>Situação</th>
                      <th aria-label="Arquivo" />
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((d) => {
                      const situacao = situacaoDocumento(d)
                      return (
                        <tr key={d.id} className="linha-clicavel" onClick={() => setEditando(d)}>
                          <td data-rotulo="Documento"><strong>{d.nome}</strong></td>
                          <td data-rotulo="Número">{d.numero || <span className="texto-suave">—</span>}</td>
                          <td data-rotulo="Validade">{d.validade ? curta(d.validade) : <span className="texto-suave">—</span>}</td>
                          <td data-rotulo="Situação"><span className={`selo-lancamento lanc-${situacao.classe}`}>{situacao.texto}</span></td>
                          <td className="acoes-linha" onClick={(e) => e.stopPropagation()}>
                            {d.arquivo_caminho
                              ? <button className="botao-link" onClick={async () => setErro(await abrirArquivo(BUCKET, d.arquivo_caminho))}><Icone nome="anexo" tamanho={14} /> Abrir</button>
                              : <span className="texto-suave">Sem arquivo</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      )}

      {criando && (
        <NovoDocumento
          existentes={documentos}
          aoFechar={() => setCriando(false)}
          aoCriar={(novo) => { setCriando(false); atualizar(novo); setEditando(novo) }}
        />
      )}
      {editando && (
        <DocumentoModal
          documento={editando}
          aoFechar={() => setEditando(null)}
          aoMudar={atualizar}
          aoExcluir={(id) => { setDocumentos((atual) => atual.filter((d) => d.id !== id)); setEditando(null) }}
        />
      )}
    </div>
  )
}
