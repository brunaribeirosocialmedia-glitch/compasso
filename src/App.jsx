import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import AreaProtegida from './components/AreaProtegida'
import Logo from './components/Logo'
import Login from './pages/Login'
import DefinirSenha from './pages/DefinirSenha'
import Inicio from './pages/Inicio'
import Clientes from './pages/Clientes'
import AreaCliente from './pages/AreaCliente'
import Tarefas from './components/cliente/Tarefas'
import Calendario from './components/cliente/Calendario'
import BlocoDeNotas from './components/cliente/BlocoDeNotas'
import Configuracoes from './components/cliente/Configuracoes'
// o quadro é pesado: só é baixado quando alguém abre a aba
const QuadroBranco = lazy(() => import('./components/cliente/QuadroBranco'))
import Equipe from './pages/Equipe'
import ListaProspects from './pages/prospeccao/ListaProspects'
import PerfilProspect from './pages/prospeccao/PerfilProspect'
import Financeiro from './pages/financeiro/Financeiro'
import VisaoGeral from './pages/financeiro/VisaoGeral'
import Lancamentos from './pages/financeiro/Lancamentos'
import Entregas from './pages/financeiro/Entregas'
import Calculadora from './pages/financeiro/Calculadora'
import Gestao from './pages/gestao/Gestao'
import Contratos from './pages/gestao/Contratos'
import Obrigacoes from './pages/gestao/Obrigacoes'
import Documentos from './pages/gestao/Documentos'
import PaginaAprovacao from './pages/PaginaAprovacao'

// Links antigos (#/financeiro/...) continuam funcionando
function RedirecionarFinanceiro() {
  const { pathname, search } = useLocation()
  return <Navigate to={pathname.replace('/financeiro', '/gestao/financeiro') + search} replace />
}

function TelaCheia({ children }) {
  return (
    <div className="tela-acesso">
      <div className="cartao cartao-acesso">{children}</div>
    </div>
  )
}

export default function App() {
  // Rota pública de aprovação do cliente (#/aprovar/<token>): é lida direto
  // do hash, ANTES do portão de login, para o cliente abrir sem conta.
  // Não mexe no fluxo de convite/recuperação do Supabase (hash diferente).
  const casa = (typeof window !== 'undefined' ? window.location.hash : '')
    .match(/^#\/aprovar\/([^/?#]+)/)
  if (casa) return <PaginaAprovacao token={decodeURIComponent(casa[1])} />

  return <AppAutenticado />
}

function AppAutenticado() {
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
          <Route path="clientes/:clienteId" element={<AreaCliente />}>
            <Route index element={<Navigate to="notas" replace />} />
            <Route path="tarefas" element={<Tarefas />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="notas" element={<BlocoDeNotas />} />
            <Route path="quadro" element={<Suspense fallback={<p className="texto-suave recuo">Carregando o quadro…</p>}><QuadroBranco /></Suspense>} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="prospeccao" element={<AreaProtegida area="prospeccao"><Outlet /></AreaProtegida>}>
            <Route index element={<ListaProspects />} />
            <Route path=":prospectId" element={<PerfilProspect />} />
          </Route>
          <Route path="gestao" element={<AreaProtegida area="financeiro"><Gestao /></AreaProtegida>}>
            <Route index element={<Navigate to="financeiro" replace />} />
            <Route path="financeiro" element={<Financeiro />}>
              <Route index element={<Navigate to="visao-geral" replace />} />
              <Route path="visao-geral" element={<VisaoGeral />} />
              <Route path="entregas" element={<Entregas />} />
              <Route path="calculadora" element={<Calculadora />} />
              <Route path=":secao" element={<Lancamentos />} />
            </Route>
            <Route path="contratos" element={<Contratos />} />
            <Route path="obrigacoes" element={<Obrigacoes />} />
            <Route path="documentos" element={<Documentos />} />
          </Route>
          <Route path="financeiro/*" element={<RedirecionarFinanceiro />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
