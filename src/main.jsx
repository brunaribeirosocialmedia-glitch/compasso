import React from 'react'
import ReactDOM from 'react-dom/client'
import { configurado } from './lib/supabase'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'
import './styles.css'
import './styles-area-cliente.css'
import './styles-prospeccao.css'
import './styles-financeiro.css'

const raiz = ReactDOM.createRoot(document.getElementById('root'))

if (!configurado) {
  raiz.render(
    <div className="carregando">
      <p>Configuração do Supabase ausente. Preencha o arquivo <code>.env</code> (veja <code>.env.example</code>).</p>
    </div>
  )
} else {
  raiz.render(
    <React.StrictMode>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </React.StrictMode>
  )
}
