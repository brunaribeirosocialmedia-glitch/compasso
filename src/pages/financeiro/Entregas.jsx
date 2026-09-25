import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { formatarData } from '../../lib/datas'
import { formatarMoeda } from '../../lib/moeda'
import Icone from '../../components/Icone'
import { useFinanceiro } from './Financeiro'
import { FormularioLancamento } from './Lancamentos'

const CONFIG_ENTREGAS = {
  tabela: 'fin_entregas',
  titulo: 'Entrega',
  novo: 'Nova entrega',
  campos: [
    { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, largura: 'toda', dica: 'Carrossel lançamento, reels semana 2…' },
    { chave: 'cliente_id', rotulo: 'Cliente', tipo: 'select', opcoes: (apoio) => Object.fromEntries(apoio.clientes.map((c) => [c.id, c.nome])) },
    { chave: 'tipo_servico', rotulo: 'Tipo de serviço', tipo: 'texto', sugestoes: ['Carrossel', 'Reels', 'Post estático', 'Stories', 'Gestão mensal', 'Identidade visual', 'Fotografia'] },
    { chave: 'valor_cobrado', rotulo: 'Valor cobrado', tipo: 'moeda', obrigatorio: true },
    { chave: 'data_entrega', rotulo: 'Data da entrega', tipo: 'data' },
    { chave: 'observacoes', rotulo: 'Observações', tipo: 'area', largura: 'toda' },
  ],
  padrao: {},
}

export function Margem({ valor, percentual }) {
  const classe = valor < 0 ? 'negativa' : 'positiva'
  return (
    <span className={`margem ${classe}`}>
      {valor < 0 ? '▼' : '▲'} {formatarMoeda(valor)}
      {percentual != null && <small> ({String(percentual).replace('.', ',')}%)</small>}
    </span>
  )
}

export default function Entregas() {
  const { competencia, clientes, versao, avisarMudanca } = useFinanceiro()
  const [linhas, setLinhas] = useState(null)
  const [brutas, setBrutas] = useState([])
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const [{ data: calc, error }, { data: ent }] = await Promise.all([
      supabase.from('fin_custo_entregas').select('*').eq('competencia', competencia).order('data_entrega', { nullsFirst: false }),
      supabase.from('fin_entregas').select('*').eq('competencia', competencia),
    ])
    if (error) setErro(traduzirErro(error))
    setLinhas(calc || [])
    setBrutas(ent || [])
  }, [competencia])

  useEffect(() => { setLinhas(null) }, [competencia])
  useEffect(() => { carregar() }, [carregar, versao])

  const cliente = (id) => clientes.find((c) => c.id === id)?.nome
  const soma = (campo) => (linhas || []).reduce((s, l) => s + Number(l[campo] || 0), 0)
  const cobrado = soma('valor_cobrado')
  const custo = soma('custo_real')

  return (
    <div className="secao-financeiro">
      <div className="barra-ferramentas">
        <div className="totais">
          <span>Entregas <strong>{linhas?.length ?? '…'}</strong></span>
          <span>Cobrado <strong>{formatarMoeda(cobrado)}</strong></span>
          <span>Custo real <strong>{formatarMoeda(custo)}</strong></span>
          {linhas?.length > 0 && <span>Margem <Margem valor={cobrado - custo} percentual={cobrado ? Math.round(1000 * (cobrado - custo) / cobrado) / 10 : null} /></span>}
        </div>
        <span className="espaco" />
        <button className="botao botao-principal botao-pequeno" onClick={() => setEditando({})}>
          <Icone nome="mais" tamanho={16} /> Nova entrega
        </button>
      </div>

      <p className="texto-suave recuo explicacao">
        Cada entrega recebe uma parte igual dos custos fixos do mês (custos fixos + colaboradores fixos + pró-labore ÷ nº de entregas),
        somada aos custos variáveis ligados a ela — inclusive IA. Ligue um custo a uma entrega em <Link to={`../custos-variaveis?mes=${competencia.slice(0, 7)}`}>Custos variáveis</Link>.
      </p>

      {erro && <p className="alerta alerta-erro recuo">{erro}</p>}

      {linhas === null ? (
        <p className="texto-suave recuo">Carregando…</p>
      ) : linhas.length === 0 ? (
        <div className="cartao vazio recuo">
          <p>Nenhuma entrega registrada neste mês. As entregas são a base do rateio dos custos fixos na calculadora.</p>
        </div>
      ) : (
        <div className="recuo cartao tabela-rolagem">
          <table className="tabela tabela-lancamentos">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Cliente</th>
                <th className="direita">Cobrado</th>
                <th className="direita">Custo fixo rateado</th>
                <th className="direita">Custos variáveis</th>
                <th className="direita">Custo real</th>
                <th className="direita">Margem</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.entrega_id} className="linha-clicavel" onClick={() => setEditando(brutas.find((b) => b.id === l.entrega_id))}>
                  <td data-rotulo="Entrega">
                    <strong>{l.descricao}</strong>
                    <small className="texto-suave bloco">
                      {[l.tipo_servico, l.data_entrega && formatarData(l.data_entrega)].filter(Boolean).join(' · ')}
                    </small>
                  </td>
                  <td data-rotulo="Cliente">{cliente(l.cliente_id) || <span className="texto-suave">—</span>}</td>
                  <td data-rotulo="Cobrado" className="direita valor">{formatarMoeda(l.valor_cobrado)}</td>
                  <td data-rotulo="Fixo rateado" className="direita valor">{formatarMoeda(l.custo_fixo_rateado)}</td>
                  <td data-rotulo="Variáveis" className="direita valor">
                    {formatarMoeda(l.custos_variaveis)}
                    {Number(l.custo_ia) > 0 && <small className="texto-suave bloco">IA {formatarMoeda(l.custo_ia)}</small>}
                  </td>
                  <td data-rotulo="Custo real" className="direita valor"><strong>{formatarMoeda(l.custo_real)}</strong></td>
                  <td data-rotulo="Margem" className="direita"><Margem valor={Number(l.margem_valor)} percentual={l.margem_percentual} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormularioLancamento
          config={CONFIG_ENTREGAS}
          item={editando}
          apoio={{ clientes, entregas: [] }}
          competencia={competencia}
          aoFechar={() => setEditando(null)}
          aoSalvar={avisarMudanca}
        />
      )}
    </div>
  )
}
