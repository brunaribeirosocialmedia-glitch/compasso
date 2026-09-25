import { createContext, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Icone from '../../components/Icone'

const FinanceiroContext = createContext(null)
export const useFinanceiro = () => useContext(FinanceiroContext)

// competência = 1º dia do mês, no formato AAAA-MM-01
function competenciaAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function somarMeses(competencia, delta) {
  const [a, m] = competencia.split('-').map(Number)
  const d = new Date(a, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export const nomeMes = (competencia, opcoes = { month: 'long', year: 'numeric' }) => {
  const [a, m] = competencia.split('-').map(Number)
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', opcoes)
}

const ABAS = [
  { para: 'visao-geral', nome: 'Visão geral' },
  { para: 'faturamento', nome: 'Faturamento' },
  { para: 'custos-fixos', nome: 'Custos fixos' },
  { para: 'custos-variaveis', nome: 'Custos variáveis' },
  { para: 'colaboradores', nome: 'Colaboradores' },
  { para: 'pro-labore', nome: 'Pró-labore' },
  { para: 'entregas', nome: 'Entregas' },
  { para: 'calculadora', nome: 'Calculadora' },
]

export default function Financeiro() {
  const [params, setParams] = useSearchParams()
  const mesUrl = params.get('mes')
  const competencia = /^\d{4}-\d{2}$/.test(mesUrl || '') ? `${mesUrl}-01` : competenciaAtual()
  const [clientes, setClientes] = useState([])
  const [versao, setVersao] = useState(0) // muda quando algo é salvo, para as telas recarregarem

  useEffect(() => {
    supabase.from('clientes').select('id, nome, cor, ativo').order('nome').then(({ data }) => setClientes(data || []))
  }, [])

  const mudarMes = (delta) => setParams({ mes: somarMeses(competencia, delta).slice(0, 7) })
  const busca = `?mes=${competencia.slice(0, 7)}`

  return (
    <FinanceiroContext.Provider value={{ competencia, clientes, versao, avisarMudanca: () => setVersao((v) => v + 1) }}>
      <div className="area-cliente">
        <header className="area-topo">
          <div className="linha-topo financeiro-topo">
            <h1>Financeiro</h1>
            <div className="navegacao-mes">
              <button className="botao-icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="voltar" /></button>
              <h2>{nomeMes(competencia)}</h2>
              <button className="botao-icone" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="avancar" /></button>
              {competencia !== competenciaAtual() && (
                <button className="botao botao-secundario botao-pequeno" onClick={() => setParams({})}>Mês atual</button>
              )}
            </div>
          </div>
          <nav className="abas">
            {ABAS.map((a) => (
              <NavLink key={a.para} to={{ pathname: a.para, search: busca }} className="aba">{a.nome}</NavLink>
            ))}
          </nav>
        </header>
        <div className="area-conteudo">
          <Outlet />
        </div>
      </div>
    </FinanceiroContext.Provider>
  )
}
