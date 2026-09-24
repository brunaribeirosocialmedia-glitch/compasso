import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import Logo from './Logo'
import Icone from './Icone'

export default function Layout() {
  const { perfil, permissoes, sair } = useAuth()
  const { tema, alternarTema } = useTheme()
  const [menuAberto, setMenuAberto] = useState(false)

  const itens = [
    { para: '/', nome: 'Início', icone: 'inicio', fim: true },
    { para: '/clientes', nome: 'Área do Cliente', icone: 'clientes' },
    permissoes.pode_prospeccao && {
      para: '/prospeccao', nome: 'Prospecção', icone: 'prospeccao', trancada: !permissoes.prospeccao_liberada,
    },
    permissoes.pode_financeiro && {
      para: '/financeiro', nome: 'Financeiro', icone: 'financeiro', trancada: !permissoes.financeiro_liberado,
    },
    permissoes.admin && { para: '/equipe', nome: 'Equipe', icone: 'equipe' },
  ].filter(Boolean)

  return (
    <div className="app">
      <header className="topo-mobile">
        <Logo tamanho={26} />
        <button className="botao-icone" onClick={() => setMenuAberto(!menuAberto)} aria-label="Abrir menu">
          <Icone nome={menuAberto ? 'fechar' : 'menu'} />
        </button>
      </header>

      <aside className={`lateral ${menuAberto ? 'aberta' : ''}`}>
        <div className="lateral-logo"><Logo /></div>

        <nav className="navegacao">
          {itens.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.fim}
              className="nav-item"
              onClick={() => setMenuAberto(false)}
            >
              <Icone nome={item.icone} />
              <span>{item.nome}</span>
              {item.trancada !== undefined && (
                <span className="nav-cadeado" title={item.trancada ? 'Protegido por código' : 'Liberado'}>
                  <Icone nome={item.trancada ? 'cadeado' : 'cadeadoAberto'} tamanho={15} />
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="lateral-rodape">
          <div className="usuario">
            <span className="avatar">{(perfil?.nome || perfil?.email || '?').charAt(0).toUpperCase()}</span>
            <span className="usuario-info">
              <strong>{perfil?.nome || 'Sem nome'}</strong>
              <small>{permissoes.admin ? 'Administradora' : 'Equipe'}</small>
            </span>
          </div>
          <div className="lateral-acoes">
            <button className="botao-icone" onClick={alternarTema} title={tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}>
              <Icone nome={tema === 'escuro' ? 'sol' : 'lua'} tamanho={18} />
            </button>
            <button className="botao-icone" onClick={sair} title="Sair">
              <Icone nome="sair" tamanho={18} />
            </button>
          </div>
        </div>
      </aside>

      {menuAberto && <div className="veu" onClick={() => setMenuAberto(false)} />}

      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
