import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icone from '../components/Icone'

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Inicio() {
  const { perfil, permissoes } = useAuth()
  const primeiroNome = (perfil?.nome || '').split(' ')[0]

  const atalhos = [
    { para: '/clientes', nome: 'Área do Cliente', icone: 'clientes', texto: 'Tarefas, Calendário e Bloco de Notas de cada cliente.' },
    permissoes.pode_prospeccao && { para: '/prospeccao', nome: 'Prospecção', icone: 'prospeccao', texto: 'Pipeline de vendas e perfil de cada prospect.' },
    permissoes.pode_financeiro && { para: '/financeiro', nome: 'Financeiro', icone: 'financeiro', texto: 'Faturamento, custos e calculadora de precificação.' },
    permissoes.admin && { para: '/equipe', nome: 'Equipe', icone: 'equipe', texto: 'Quem acessa o quê dentro do Compasso.' },
  ].filter(Boolean)

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <p className="sobretitulo">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}.</h1>
      </header>

      <div className="grade-atalhos">
        {atalhos.map((a) => (
          <Link key={a.para} to={a.para} className="cartao atalho">
            <span className="atalho-icone"><Icone nome={a.icone} /></span>
            <strong>{a.nome}</strong>
            <span className="texto-suave">{a.texto}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
