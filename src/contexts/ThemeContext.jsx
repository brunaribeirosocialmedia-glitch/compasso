import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

function lerTemaSalvo() {
  try { return localStorage.getItem('compasso-tema') || 'escuro' } catch { return 'escuro' }
}

export function ThemeProvider({ children }) {
  const { perfil, atualizarPerfil } = useAuth()
  const [tema, setTema] = useState(lerTemaSalvo)

  // Ao entrar, segue a preferência salva no perfil (vale em qualquer aparelho)
  useEffect(() => {
    if (perfil?.tema) setTema(perfil.tema)
  }, [perfil?.tema])

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    try { localStorage.setItem('compasso-tema', tema) } catch { /* navegador sem armazenamento */ }
  }, [tema])

  const alternarTema = () => {
    const novo = tema === 'escuro' ? 'claro' : 'escuro'
    setTema(novo)
    if (perfil) atualizarPerfil({ tema: novo })
  }

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
