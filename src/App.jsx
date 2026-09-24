import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import AreaProtegida from './components/AreaProtegida'
import Logo from './components/Logo'
import Login from './pages/Login'
import DefinirSenha from './pages/DefinirSenha'
import Inicio from './pages/Inicio'
import Clientes from './pages/Clientes'
import Equipe from './pages/Equipe'
import EmConstrucao from './pages/EmConstrucao'

function TelaCheia({ children }) {
  return (
    <div className="tela-acesso">
      <div className="cartao cartao-acesso">{children}</div>
    </div>
  )
}

export default function App() {
  const { session, perfil, carregando, precisaDefinirSenha, sair } = useAuth()

  if (carregando) {
    return <div className="carregando"><Logo tamanho={44} comNome={false} /></div>
  }

  if (!session) return <Login />
  if (precisaDefinirSenha) return <DefinirSenha />

  if (!perfil?.ativo) {
    return (
      <TelaCheia>
        <Logo tamanho={40} />
        <h1>Acesso desativado</h1>
        <p className="texto-suave">Seu acesso ao Compasso está desativado. Fale com a administração da B Mídia.</p>
        <button className="botao botao-secundario" onClick={sair}>Sair</button>
      </TelaCheia>
    )
  }

  // O roteador só é montado depois que o Supabase leu (e limpou) os links de acesso
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="clientes" element={<Clientes />} />
          <Route
            path="prospeccao"
            element={
              <AreaProtegida area="prospeccao">
                <EmConstrucao titulo="Prospecção" etapa={4} descricao="O pipeline de vendas, com a lista de prospects e o perfil de cada um, chega na etapa 4." />
              </AreaProtegida>
            }
          />
          <Route
            path="financeiro"
            element={
              <AreaProtegida area="financeiro">
                <EmConstrucao titulo="Financeiro" etapa={5} descricao="Faturamento, custos, colaboradores, pró-labore e a calculadora de precificação chegam na etapa 5." />
              </AreaProtegida>
            }
          />
          <Route path="equipe" element={<Equipe />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
