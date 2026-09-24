import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const LINK_CONVITE = 'https://supabase.com/dashboard/project/kfcmcwxnqfofmworbojt/auth/users'

function Chave({ ligada, onChange, disabled, rotulo }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligada}
      aria-label={rotulo}
      className={`chave ${ligada ? 'ligada' : ''}`}
      onClick={() => onChange(!ligada)}
      disabled={disabled}
    >
      <span />
    </button>
  )
}

export default function Equipe() {
  const { session, permissoes, atualizarPermissoes } = useAuth()
  const [membros, setMembros] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('perfis').select('*').order('nome').then(({ data }) => setMembros(data || []))
  }, [])

  if (!permissoes.admin) return <Navigate to="/" replace />

  async function alterar(membro, campos) {
    setErro('')
    const anterior = membros
    setMembros(membros.map((m) => (m.id === membro.id ? { ...m, ...campos } : m)))
    const { error } = await supabase.from('perfis').update(campos).eq('id', membro.id)
    if (error) {
      setMembros(anterior)
      setErro(traduzirErro(error))
    } else if (membro.id === session.user.id) {
      atualizarPermissoes()
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Equipe</h1>
        <p className="texto-suave">
          Defina quem pode entrar na Prospecção e no Financeiro. Mesmo com a permissão, a pessoa precisa digitar o código da área.
        </p>
      </header>

      {erro && <p className="alerta alerta-erro">{erro}</p>}

      <div className="cartao tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Papel</th>
              <th>Prospecção</th>
              <th>Financeiro</th>
              <th>Ativo</th>
            </tr>
          </thead>
          <tbody>
            {membros === null && (
              <tr><td colSpan={5} className="texto-suave">Carregando…</td></tr>
            )}
            {membros?.map((m) => {
              const souEu = m.id === session.user.id
              return (
                <tr key={m.id} className={m.ativo ? '' : 'inativo'}>
                  <td>
                    <strong>{m.nome || 'Sem nome'}{souEu && ' (você)'}</strong>
                    <small className="texto-suave bloco">{m.email}</small>
                  </td>
                  <td>
                    <select
                      value={m.papel}
                      disabled={souEu}
                      onChange={(e) => alterar(m, { papel: e.target.value })}
                      aria-label={`Papel de ${m.nome}`}
                    >
                      <option value="membro">Equipe</option>
                      <option value="admin">Administração</option>
                    </select>
                  </td>
                  <td>
                    <Chave rotulo={`Prospecção para ${m.nome}`} ligada={m.pode_prospeccao} onChange={(v) => alterar(m, { pode_prospeccao: v })} />
                  </td>
                  <td>
                    <Chave rotulo={`Financeiro para ${m.nome}`} ligada={m.pode_financeiro} onChange={(v) => alterar(m, { pode_financeiro: v })} />
                  </td>
                  <td>
                    <Chave rotulo={`${m.nome} ativo`} ligada={m.ativo} disabled={souEu} onChange={(v) => alterar(m, { ativo: v })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="cartao dica">
        <strong>Adicionar alguém à equipe</strong>
        <p className="texto-suave">
          Por enquanto, os convites são enviados pelo painel do Supabase: <em>Add user → Send invitation</em>.
          A pessoa recebe um e-mail, cria a senha e aparece nesta lista.
        </p>
        <a className="botao botao-secundario" href={LINK_CONVITE} target="_blank" rel="noreferrer">Abrir painel de convites</a>
      </div>
    </div>
  )
}
