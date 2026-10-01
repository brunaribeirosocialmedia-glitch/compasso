import { useEffect, useRef, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { CORES_CLIENTE } from '../../lib/cores'
import { SeletorCor } from '../../pages/Clientes'
import Icone from '../Icone'

const chave = (nome) => nome.trim().toLowerCase()

// Mapa nome → etiqueta salva (sem diferenciar maiúsculas)
export const indexarEtiquetas = (lista) => Object.fromEntries(lista.map((e) => [chave(e.nome), e]))

export function Etiqueta({ nome, cor, children }) {
  return (
    <span className="etiqueta-cor" style={cor ? { '--cor-etiqueta': cor } : undefined}>
      {nome}
      {children}
    </span>
  )
}

function EditarEtiqueta({ etiqueta, aoVoltar, aoMudar }) {
  const [nome, setNome] = useState(etiqueta.nome)
  const [cor, setCor] = useState(etiqueta.cor)
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  async function salvar() {
    const { error } = await supabase.from('etiquetas').update({ nome: nome.trim(), cor }).eq('id', etiqueta.id)
    if (error) return setErro(error.code === '23505' ? 'Já existe uma etiqueta com esse nome.' : traduzirErro(error))
    aoMudar({ antigo: etiqueta.nome, novo: nome.trim() })
    aoVoltar()
  }

  async function excluir() {
    const { error } = await supabase.from('etiquetas').delete().eq('id', etiqueta.id)
    if (error) return setErro(traduzirErro(error))
    aoMudar({ antigo: etiqueta.nome, novo: null })
    aoVoltar()
  }

  return (
    <div className="editar-etiqueta">
      <label className="campo">
        <span>Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      </label>
      <div className="campo">
        <span>Cor</span>
        <SeletorCor cores={CORES_CLIENTE} valor={cor} onChange={setCor} />
      </div>
      <Etiqueta nome={nome.trim() || 'Prévia'} cor={cor} />
      <p className="texto-suave aviso-etiqueta">Mudanças valem para todas as tarefas, de todos os clientes.</p>
      {erro && <p className="alerta alerta-erro">{erro}</p>}
      <div className="editar-etiqueta-acoes">
        {confirmando ? (
          <>
            <button type="button" className="botao botao-perigo botao-pequeno" onClick={excluir}>Excluir de vez</button>
            <button type="button" className="botao-link" onClick={() => setConfirmando(false)}>Não</button>
          </>
        ) : (
          <button type="button" className="botao-link perigo" onClick={() => setConfirmando(true)}>Excluir etiqueta</button>
        )}
        <span className="espaco" />
        <button type="button" className="botao botao-secundario botao-pequeno" onClick={aoVoltar}>Voltar</button>
        <button type="button" className="botao botao-principal botao-pequeno" onClick={salvar} disabled={!nome.trim()}>Salvar</button>
      </div>
    </div>
  )
}

// Escolhe etiquetas da lista salva, cria novas (com cor) e edita as existentes
export function SeletorEtiquetas({ valor, onChange, etiquetas, aoMudarLista }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(null)
  const [corNova, setCorNova] = useState(CORES_CLIENTE[etiquetas.length % CORES_CLIENTE.length])
  const [erro, setErro] = useState('')
  const caixa = useRef(null)
  const porNome = indexarEtiquetas(etiquetas)

  // fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const fora = (e) => { if (!caixa.current?.contains(e.target)) { setAberto(false); setEditando(null) } }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const marcada = (nome) => valor.some((v) => chave(v) === chave(nome))
  const alternar = (nome) => onChange(marcada(nome) ? valor.filter((v) => chave(v) !== chave(nome)) : [...valor, nome])

  const termo = chave(texto)
  const visiveis = etiquetas.filter((e) => !termo || chave(e.nome).includes(termo))
  const podeCriar = termo && !porNome[termo]

  async function criar() {
    setErro('')
    const { data, error } = await supabase.from('etiquetas').insert({ nome: texto.trim(), cor: corNova }).select().single()
    if (error) return setErro(traduzirErro(error))
    await aoMudarLista()
    onChange([...valor, data.nome])
    setTexto('')
    setCorNova(CORES_CLIENTE[(etiquetas.length + 1) % CORES_CLIENTE.length])
  }

  // renomear/excluir: o banco atualiza as tarefas; aqui ajustamos o formulário aberto
  async function aoEditar({ antigo, novo }) {
    if (marcada(antigo)) onChange(valor.flatMap((v) => (chave(v) === chave(antigo) ? (novo ? [novo] : []) : [v])))
    await aoMudarLista()
  }

  return (
    <div className="seletor-etiquetas" ref={caixa}>
      <div className="etiquetas-escolhidas">
        {valor.map((nome) => (
          <Etiqueta key={nome} nome={nome} cor={porNome[chave(nome)]?.cor}>
            <button type="button" className="remover-etiqueta" onClick={() => alternar(nome)} aria-label={`Tirar ${nome}`}>
              <Icone nome="fechar" tamanho={12} />
            </button>
          </Etiqueta>
        ))}
        <button type="button" className="botao-link adicionar-etiqueta" onClick={() => setAberto(!aberto)}>
          <Icone nome="mais" tamanho={14} /> Etiqueta
        </button>
      </div>

      {aberto && (
        <div className="painel-etiquetas cartao">
          {editando ? (
            <EditarEtiqueta etiqueta={editando} aoVoltar={() => setEditando(null)} aoMudar={aoEditar} />
          ) : (
            <>
              <input
                placeholder="Buscar ou criar etiqueta"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (podeCriar) criar()
                  else if (porNome[termo]) alternar(porNome[termo].nome)
                }}
                autoFocus
              />
              <ul className="lista-etiquetas">
                {visiveis.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="opcao-etiqueta" onClick={() => alternar(e.nome)} aria-pressed={marcada(e.nome)}>
                      <span className="marca-etiqueta">{marcada(e.nome) && <Icone nome="confirmar" tamanho={14} />}</span>
                      <Etiqueta nome={e.nome} cor={e.cor} />
                    </button>
                    <button type="button" className="botao-icone mini" onClick={() => setEditando(e)} title="Editar nome e cor" aria-label={`Editar ${e.nome}`}>
                      <Icone nome="config" tamanho={15} />
                    </button>
                  </li>
                ))}
                {visiveis.length === 0 && !podeCriar && <li className="texto-suave">Nenhuma etiqueta salva ainda. Digite um nome para criar.</li>}
              </ul>
              {podeCriar && (
                <div className="criar-etiqueta">
                  <SeletorCor cores={CORES_CLIENTE} valor={corNova} onChange={setCorNova} />
                  <button type="button" className="botao botao-principal botao-pequeno" onClick={criar}>
                    Criar <Etiqueta nome={texto.trim()} cor={corNova} />
                  </button>
                </div>
              )}
              {erro && <p className="alerta alerta-erro">{erro}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
