import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Clientes() {
  const { permissoes } = useAuth()
  const [clientes, setClientes] = useState(null)

  useEffect(() => {
    supabase.from('clientes').select('id, nome, cor, ativo').order('nome').then(({ data }) => setClientes(data || []))
  }, [])

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Área do Cliente</h1>
        <p className="texto-suave">
          {permissoes.admin ? 'Você vê todos os clientes.' : 'Clientes aos quais você está associada(o).'}
        </p>
      </header>

      {clientes === null ? (
        <p className="texto-suave">Carregando…</p>
      ) : clientes.length === 0 ? (
        <div className="cartao vazio">
          <span className="etiqueta">Etapa 3</span>
          <p>
            {permissoes.admin
              ? 'Nenhum cliente cadastrado ainda. O cadastro de clientes, Tarefas, Calendário e Bloco de Notas chegam na próxima etapa.'
              : 'Você ainda não foi associada(o) a nenhum cliente.'}
          </p>
        </div>
      ) : (
        <div className="grade-atalhos">
          {clientes.map((c) => (
            <div key={c.id} className="cartao atalho">
              <span className="cliente-cor" style={{ background: c.cor || 'var(--texto-suave)' }} />
              <strong>{c.nome}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
