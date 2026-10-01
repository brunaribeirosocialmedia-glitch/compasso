import { useCallback, useEffect, useRef, useState } from 'react'
import Icone from './Icone'

// Estado do salvamento: 'ocioso' → 'salvando' → 'salvo' (fica verde um instante)
export function useSalvar() {
  const [estado, setEstado] = useState('ocioso')
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  // fn devolve true quando salvou; qualquer outra coisa conta como erro
  const rodar = useCallback(async (fn) => {
    clearTimeout(timer.current)
    setEstado('salvando')
    const ok = (await fn()) === true
    setEstado(ok ? 'salvo' : 'ocioso')
    if (ok) timer.current = setTimeout(() => setEstado('ocioso'), 2200)
    return ok
  }, [])

  return { estado, rodar }
}

// Pausa curta antes de fechar uma janela, para dar tempo de ver o "Salvo"
export const pausaParaVer = () => new Promise((r) => setTimeout(r, 750))

export default function BotaoSalvar({
  estado, texto = 'Salvar', textoSalvando = 'Salvando…', textoSalvo = 'Salvo',
  className = '', disabled, ...props
}) {
  return (
    <button
      {...props}
      className={`botao botao-principal botao-salvar ${estado === 'salvo' ? 'salvo' : ''} ${className}`}
      disabled={disabled || estado !== 'ocioso'}
      aria-live="polite"
    >
      {estado === 'salvo' && <Icone nome="confirmar" tamanho={18} />}
      {estado === 'salvando' ? textoSalvando : estado === 'salvo' ? textoSalvo : texto}
    </button>
  )
}
