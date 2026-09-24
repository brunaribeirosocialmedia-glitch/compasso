import { useState } from 'react'
import { supabase, traduzirErro, linkDeAcesso } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import Logo from '../components/Logo'
import Icone from '../components/Icone'

export default function Login() {
  const { tema, alternarTema } = useTheme()
  const [modo, setModo] = useState('entrar') // 'entrar' | 'recuperar'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(linkDeAcesso.erro ? traduzirErro(linkDeAcesso.erro) : '')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) setErro(traduzirErro(error))
  }

  async function recuperar(e) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    })
    setEnviando(false)
    if (error) setErro(traduzirErro(error))
    else setAviso('Pronto! Se este e-mail faz parte da equipe, você vai receber um link para criar sua senha.')
  }

  return (
    <div className="tela-acesso">
      <button className="botao-icone tema-flutuante" onClick={alternarTema} title="Alternar tema">
        <Icone nome={tema === 'escuro' ? 'sol' : 'lua'} tamanho={18} />
      </button>

      <form className="cartao cartao-acesso" onSubmit={modo === 'entrar' ? entrar : recuperar}>
        <Logo tamanho={40} />
        <h1>{modo === 'entrar' ? 'Entrar' : 'Primeiro acesso ou senha esquecida'}</h1>
        {modo === 'recuperar' && (
          <p className="texto-suave">Informe seu e-mail e enviaremos um link para você criar uma nova senha.</p>
        )}

        <label className="campo">
          <span>E-mail</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>

        {modo === 'entrar' && (
          <label className="campo">
            <span>Senha</span>
            <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </label>
        )}

        {erro && <p className="alerta alerta-erro" role="alert">{erro}</p>}
        {aviso && <p className="alerta alerta-ok">{aviso}</p>}

        <button className="botao botao-principal" disabled={enviando}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Enviar link'}
        </button>

        <button
          type="button"
          className="botao-link"
          onClick={() => { setModo(modo === 'entrar' ? 'recuperar' : 'entrar'); setErro(''); setAviso('') }}
        >
          {modo === 'entrar' ? 'Primeiro acesso ou esqueceu a senha?' : 'Voltar para o login'}
        </button>
      </form>
    </div>
  )
}
