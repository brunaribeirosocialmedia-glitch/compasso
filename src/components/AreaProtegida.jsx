import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Icone from './Icone'

const nomes = { prospeccao: 'Prospecção', financeiro: 'Financeiro' }

// Envolve Prospecção e Financeiro: pede o código antes de mostrar o conteúdo.
// A proteção de verdade está no banco (RLS); esta tela é a porta de entrada.
export default function AreaProtegida({ area, children }) {
  const { permissoes, atualizarPermissoes } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [expiraEm, setExpiraEm] = useState(null)

  const pode = area === 'prospeccao' ? permissoes.pode_prospeccao : permissoes.pode_financeiro
  const liberada = area === 'prospeccao' ? permissoes.prospeccao_liberada : permissoes.financeiro_liberado

  // Busca até quando vale o desbloqueio e tranca sozinho ao expirar
  useEffect(() => {
    if (!liberada) return
    let timer
    supabase.from('desbloqueios').select('expira_em').eq('area', area).maybeSingle().then(({ data }) => {
      if (!data) return
      const fim = new Date(data.expira_em)
      setExpiraEm(fim)
      timer = setTimeout(atualizarPermissoes, Math.max(fim - Date.now(), 0) + 1000)
    })
    return () => clearTimeout(timer)
  }, [liberada, area, atualizarPermissoes])

  if (!pode) return <Navigate to="/" replace />

  async function desbloquear(e) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    const { data, error } = await supabase.rpc('desbloquear_area', { p_area: area, p_codigo: codigo })
    setEnviando(false)
    setCodigo('')
    if (error || !data?.ok) {
      setErro(data?.erro || 'Não foi possível verificar o código.')
      return
    }
    await atualizarPermissoes()
  }

  async function bloquear() {
    await supabase.rpc('bloquear_area', { p_area: area })
    setExpiraEm(null)
    await atualizarPermissoes()
  }

  if (!liberada) {
    return (
      <div className="tela-codigo">
        <form className="cartao cartao-codigo" onSubmit={desbloquear}>
          <span className="selo-cadeado"><Icone nome="cadeado" tamanho={26} /></span>
          <h1>{nomes[area]}</h1>
          <p className="texto-suave">Área protegida. Digite o código de acesso para continuar.</p>
          <label className="campo">
            <span>Código de acesso</span>
            <input
              type="password"
              autoComplete="off"
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
            />
          </label>
          {erro && <p className="alerta alerta-erro" role="alert">{erro}</p>}
          <button className="botao botao-principal" disabled={enviando || !codigo}>
            {enviando ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <>
      <div className="faixa-protegida">
        <span>
          <Icone nome="cadeadoAberto" tamanho={15} /> {nomes[area]} liberado
          {expiraEm && ` até ${expiraEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
        </span>
        <button className="botao-link" onClick={bloquear}>Trancar agora</button>
      </div>
      {children}
    </>
  )
}
