import { useEffect, useState } from 'react'
import { traduzirErro } from '../lib/supabase'
import { formatarMoeda, lerMoeda, paraCampoMoeda } from '../lib/moeda'
import { buscarMeta, ritmoEsperado, salvarMeta } from '../lib/metas'
import BarraMeta from './BarraMeta'
import BotaoSalvar, { pausaParaVer, useSalvar } from './BotaoSalvar'

// Meta do mês dentro da aba (com valores). A tela inicial mostra só a barra.
export default function CartaoMeta({ area, competencia, atual, titulo }) {
  const [meta, setMeta] = useState(undefined)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const { estado: estadoSalvar, rodar } = useSalvar()

  useEffect(() => {
    setMeta(undefined)
    buscarMeta(area, competencia).then((m) => setMeta(m))
  }, [area, competencia])

  function abrir() {
    setTexto(paraCampoMoeda(meta?.valor))
    setErro('')
    setEditando(true)
  }

  async function salvar(e) {
    e.preventDefault()
    const valor = lerMoeda(texto)
    if (!(valor > 0)) return setErro('Digite um valor maior que zero.')
    setErro('')
    const ok = await rodar(async () => {
      const { error } = await salvarMeta(area, competencia, valor)
      if (error) return setErro(traduzirErro(error))
      return true
    })
    if (ok) {
      await pausaParaVer()
      setMeta({ competencia, valor })
      setEditando(false)
    }
  }

  if (meta === undefined) return null
  const herdada = meta && meta.competencia !== competencia

  return (
    <section className="cartao secao cartao-meta">
      <div className="linha-topo">
        <h2>{titulo}</h2>
        {!editando && (
          <button className="botao-link" onClick={abrir}>{meta ? 'Mudar meta' : 'Definir meta'}</button>
        )}
      </div>

      {editando ? (
        <form className="form-meta" onSubmit={salvar}>
          <div className="campo-moeda">
            <span>R$</span>
            <input inputMode="decimal" placeholder="0,00" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus aria-label="Valor da meta" />
          </div>
          <BotaoSalvar estado={estadoSalvar} textoSalvo="Meta salva" className="botao-pequeno" />
          <button type="button" className="botao botao-secundario botao-pequeno" onClick={() => setEditando(false)}>Cancelar</button>
          <small className="texto-suave">Vale para este mês e os próximos, até você mudar de novo.</small>
          {erro && <p className="alerta alerta-erro">{erro}</p>}
        </form>
      ) : meta ? (
        <BarraMeta
          atual={atual}
          meta={Number(meta.valor)}
          esperado={ritmoEsperado(competencia)}
          detalhe={`${formatarMoeda(atual)} de ${formatarMoeda(meta.valor)}${herdada ? ' · meta herdada do mês anterior' : ''}`}
        />
      ) : (
        <p className="texto-suave">Sem meta definida. Com uma meta, a tela inicial mostra se você está perto ou longe dela.</p>
      )}
    </section>
  )
}
