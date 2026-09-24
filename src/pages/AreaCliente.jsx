import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Icone from '../components/Icone'

const ClienteContext = createContext(null)
export const useCliente = () => useContext(ClienteContext)

export default function AreaCliente() {
  const { clienteId } = useParams()
  const { permissoes } = useAuth()
  const [cliente, setCliente] = useState(undefined)
  const [pessoas, setPessoas] = useState([])   // quem pode ser responsável
  const [membros, setMembros] = useState([])   // ids associados ao cliente

  const carregar = useCallback(async () => {
    const [{ data: c }, { data: m }, { data: p }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle(),
      supabase.from('cliente_membros').select('usuario_id').eq('cliente_id', clienteId),
      supabase.from('perfis').select('id, nome, email, papel, ativo').eq('ativo', true).order('nome'),
    ])
    const ids = (m || []).map((x) => x.usuario_id)
    setCliente(c)
    setMembros(ids)
    setPessoas((p || []).filter((x) => x.papel === 'admin' || ids.includes(x.id)))
  }, [clienteId])

  useEffect(() => { carregar() }, [carregar])

  if (cliente === undefined) return <div className="pagina"><p className="texto-suave">Carregando…</p></div>
  if (cliente === null) {
    return (
      <div className="pagina">
        <div className="cartao vazio">
          <p>Este cliente não existe ou você não tem acesso a ele.</p>
          <Link className="botao botao-secundario" to="/clientes">Voltar para a Área do Cliente</Link>
        </div>
      </div>
    )
  }

  const abas = [
    { para: 'tarefas', nome: 'Tarefas', icone: 'tarefas' },
    { para: 'calendario', nome: 'Calendário', icone: 'calendario' },
    { para: 'notas', nome: 'Bloco de Notas', icone: 'notas' },
    permissoes.admin && { para: 'configuracoes', nome: 'Configurações', icone: 'config' },
  ].filter(Boolean)

  return (
    <ClienteContext.Provider value={{ cliente, pessoas, membros, recarregarCliente: carregar }}>
      <div className="area-cliente">
        <header className="area-topo">
          <Link to="/clientes" className="migalha"><Icone nome="voltar" tamanho={16} /> Área do Cliente</Link>
          <div className="area-titulo">
            <span className="cliente-inicial" style={{ background: cliente.cor || 'var(--texto-suave)' }}>
              {cliente.nome.charAt(0).toUpperCase()}
            </span>
            <h1>{cliente.nome}</h1>
            {!cliente.ativo && <span className="etiqueta">Arquivado</span>}
          </div>
          <nav className="abas">
            {abas.map((a) => (
              <NavLink key={a.para} to={a.para} className="aba">
                <Icone nome={a.icone} tamanho={17} /> {a.nome}
              </NavLink>
            ))}
          </nav>
        </header>
        <div className="area-conteudo">
          <Outlet />
        </div>
      </div>
    </ClienteContext.Provider>
  )
}
