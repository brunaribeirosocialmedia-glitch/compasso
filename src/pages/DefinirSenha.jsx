import { useState } from 'react'
import { supabase, traduzirErro } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

export default function DefinirSenha() {
  const { session, perfil, atualizarPerfil, concluirDefinicaoSenha } = useAuth()
  const [nome, setNome] = useState(perfil?.nome || '')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.')
    if (senha !== confirmacao) return setErro('As senhas não conferem.')
    setEnviando(true)
    setErro('')
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (!error && nome.trim() && nome.trim() !== perfil?.nome) await atualizarPerfil({ nome: nome.trim() })
    setEnviando(false)
    if (error) setErro(traduzirErro(error))
    else concluirDefinicaoSenha()
  }

  return (
    <div className="tela-acesso">
      <form className="cartao cartao-acesso" onSubmit={salvar}>
        <Logo tamanho={40} />
        <h1>Crie sua senha</h1>
        <p className="texto-suave">{session?.user?.email}</p>

        <label className="campo">
          <span>Como quer ser chamada(o)?</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        </label>
        <label className="campo">
          <span>Nova senha</span>
          <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoFocus />
        </label>
        <label className="campo">
          <span>Repita a senha</span>
          <input type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
        </label>

        {erro && <p className="alerta alerta-erro" role="alert">{erro}</p>}

        <button className="botao botao-principal" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar e entrar'}
        </button>
      </form>
    </div>
  )
}
