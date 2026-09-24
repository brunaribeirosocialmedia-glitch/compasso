import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CORES_CLIENTE } from '../lib/cores'
import Modal from '../components/Modal'
import Icone from '../components/Icone'

export function SeletorCor({ cores, valor, onChange }) {
  return (
    <div className="seletor-cor">
      {cores.map((c) => (
        <button
          key={c}
          type="button"
          className={`amostra-cor ${valor === c ? 'selecionada' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Cor ${c}`}
        />
      ))}
    </div>
  )
}

function NovoCliente({ aoFechar }) {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES_CLIENTE[0])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function criar(e) {
    e.preventDefault()
    setSalvando(true)
    const slug = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const { data, error } = await supabase.from('clientes').insert({ nome: nome.trim(), cor, slug: slug || null }).select().single()
    setSalvando(false)
    if (error) return setErro(error.code === '23505' ? 'Já existe um cliente com esse nome.' : traduzirErro(error))
    navigate(`/clientes/${data.id}/configuracoes`)
  }

  return (
    <Modal titulo="Novo cliente" aoFechar={aoFechar} largura={440}>
      <form className="formulario" onSubmit={criar}>
        <label className="campo">
          <span>Nome do cliente</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
        </label>
        <div className="campo">
          <span>Cor</span>
          <SeletorCor cores={CORES_CLIENTE} valor={cor} onChange={setCor} />
        </div>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
        <button className="botao botao-principal" disabled={salvando || !nome.trim()}>
          {salvando ? 'Criando…' : 'Criar e escolher a equipe'}
        </button>
      </form>
    </Modal>
  )
}

export default function Clientes() {
  const { permissoes } = useAuth()
  const [clientes, setClientes] = useState(null)
  const [criando, setCriando] = useState(false)
  const [verArquivados, setVerArquivados] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id, nome, cor, ativo').order('nome'),
      supabase.from('tarefas').select('cliente_id').is('concluida_em', null),
    ]).then(([{ data: lista }, { data: abertas }]) => {
      const contagem = {}
      abertas?.forEach((t) => { contagem[t.cliente_id] = (contagem[t.cliente_id] || 0) + 1 })
      setClientes((lista || []).map((c) => ({ ...c, abertas: contagem[c.id] || 0 })))
    })
  }, [])

  const visiveis = clientes?.filter((c) => c.ativo || verArquivados)
  const arquivados = clientes?.filter((c) => !c.ativo).length || 0

  return (
    <div className="pagina">
      <header className="pagina-topo linha-topo">
        <div>
          <h1>Área do Cliente</h1>
          <p className="texto-suave">
            {permissoes.admin ? 'Você vê todos os clientes.' : 'Clientes aos quais você está associada(o).'}
          </p>
        </div>
        {permissoes.admin && (
          <button className="botao botao-principal" onClick={() => setCriando(true)}>
            <Icone nome="mais" tamanho={18} /> Novo cliente
          </button>
        )}
      </header>

      {clientes === null ? (
        <p className="texto-suave">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="cartao vazio">
          <p>
            {permissoes.admin
              ? 'Nenhum cliente cadastrado ainda. Clique em “Novo cliente” para começar.'
              : 'Você ainda não foi associada(o) a nenhum cliente. Fale com a administração.'}
          </p>
        </div>
      ) : (
        <div className="grade-atalhos">
          {visiveis.map((c) => (
            <Link key={c.id} to={`/clientes/${c.id}/tarefas`} className={`cartao atalho cartao-cliente ${c.ativo ? '' : 'arquivado'}`}>
              <span className="cliente-inicial" style={{ background: c.cor || 'var(--texto-suave)' }}>
                {c.nome.charAt(0).toUpperCase()}
              </span>
              <strong>{c.nome}</strong>
              <span className="texto-suave">
                {c.ativo
                  ? `${c.abertas} tarefa(s) em aberto`
                  : 'Arquivado'}
              </span>
            </Link>
          ))}
        </div>
      )}

      {permissoes.admin && arquivados > 0 && (
        <button className="botao-link alinhar-inicio" onClick={() => setVerArquivados(!verArquivados)}>
          {verArquivados ? 'Esconder arquivados' : `Ver arquivados (${arquivados})`}
        </button>
      )}

      {criando && <NovoCliente aoFechar={() => setCriando(false)} />}
    </div>
  )
}
