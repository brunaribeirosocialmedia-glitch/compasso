import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useTempoReal } from '../../lib/useTempoReal'
import { useCliente } from '../../pages/AreaCliente'
import { formatarHora, hojeISO, paraCampoDataHora, paraISO, semanasDoMes } from '../../lib/datas'
import { TIPOS_EVENTO } from '../../lib/cores'
import Modal, { BotaoExcluir } from '../Modal'
import Icone from '../Icone'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function EventoModal({ evento, diaInicial, clienteId, aoFechar, aoMudar }) {
  const novo = !evento.id
  const [form, setForm] = useState(() => ({
    titulo: evento.titulo || '',
    tipo: evento.tipo || 'reuniao',
    dia_inteiro: evento.dia_inteiro ?? false,
    dia: evento.inicio ? paraISO(new Date(evento.inicio)) : diaInicial,
    inicio: evento.inicio ? paraCampoDataHora(evento.inicio) : `${diaInicial}T10:00`,
    fim: evento.fim ? paraCampoDataHora(evento.fim) : '',
    descricao: evento.descricao || '',
  }))
  const [erro, setErro] = useState('')
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    const [a, m, d] = form.dia.split('-').map(Number)
    const inicio = form.dia_inteiro ? new Date(a, m - 1, d) : new Date(form.inicio)
    const fim = !form.dia_inteiro && form.fim ? new Date(form.fim) : null
    if (fim && fim < inicio) return setErro('O fim precisa ser depois do início.')
    const campos = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      dia_inteiro: form.dia_inteiro,
      inicio: inicio.toISOString(),
      fim: fim?.toISOString() || null,
      descricao: form.descricao.trim() || null,
    }
    const { error } = novo
      ? await supabase.from('eventos').insert({ ...campos, cliente_id: clienteId })
      : await supabase.from('eventos').update(campos).eq('id', evento.id)
    if (error) return setErro(traduzirErro(error))
    aoMudar()
    aoFechar()
  }

  async function excluir() {
    const { error } = await supabase.from('eventos').delete().eq('id', evento.id)
    if (error) return setErro(traduzirErro(error))
    aoMudar()
    aoFechar()
  }

  return (
    <Modal
      titulo={novo ? 'Novo evento' : 'Evento'}
      aoFechar={aoFechar}
      largura={520}
      rodape={
        <>
          {!novo && <BotaoExcluir aoConfirmar={excluir} texto="Excluir evento" />}
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-evento" className="botao botao-principal" disabled={!form.titulo.trim()}>Salvar</button>
        </>
      }
    >
      <form id="form-evento" className="formulario" onSubmit={salvar}>
        <label className="campo">
          <span>Título</span>
          <input {...campo('titulo')} required autoFocus />
        </label>
        <div className="grade-campos">
          <label className="campo">
            <span>Tipo</span>
            <select {...campo('tipo')}>
              {Object.entries(TIPOS_EVENTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          <label className="marcar marcar-campo">
            <input type="checkbox" checked={form.dia_inteiro} onChange={(e) => setForm({ ...form, dia_inteiro: e.target.checked })} />
            Dia inteiro
          </label>
        </div>
        {form.dia_inteiro ? (
          <label className="campo">
            <span>Data</span>
            <input type="date" {...campo('dia')} required />
          </label>
        ) : (
          <div className="grade-campos">
            <label className="campo">
              <span>Início</span>
              <input type="datetime-local" {...campo('inicio')} required />
            </label>
            <label className="campo">
              <span>Fim (opcional)</span>
              <input type="datetime-local" {...campo('fim')} />
            </label>
          </div>
        )}
        <label className="campo">
          <span>Descrição</span>
          <textarea rows={3} {...campo('descricao')} />
        </label>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function Calendario() {
  const { cliente } = useCliente()
  const navigate = useNavigate()
  const hoje = new Date()
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() })
  const [eventos, setEventos] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [modal, setModal] = useState(null) // { evento, dia }

  const semanas = useMemo(() => semanasDoMes(mes.ano, mes.mes), [mes])
  const primeiroDia = paraISO(semanas[0][0])
  const ultimoDia = paraISO(semanas.at(-1)[6])

  const carregar = useCallback(async () => {
    const inicio = new Date(semanas[0][0])
    const fim = new Date(semanas.at(-1)[6])
    fim.setDate(fim.getDate() + 1)
    const [{ data: ev }, { data: ta }] = await Promise.all([
      supabase.from('eventos').select('*').eq('cliente_id', cliente.id)
        .gte('inicio', inicio.toISOString()).lt('inicio', fim.toISOString()).order('inicio'),
      supabase.from('tarefas').select('id, titulo, prazo, concluida_em').eq('cliente_id', cliente.id)
        .gte('prazo', primeiroDia).lte('prazo', ultimoDia),
    ])
    setEventos(ev || [])
    setTarefas(ta || [])
  }, [cliente.id, semanas, primeiroDia, ultimoDia])

  useEffect(() => { carregar() }, [carregar])
  useTempoReal(['eventos', 'tarefas'], cliente.id, carregar)

  // agrupa tudo por dia (AAAA-MM-DD, horário local)
  const porDia = useMemo(() => {
    const mapa = {}
    const add = (dia, item) => (mapa[dia] ||= []).push(item)
    eventos.forEach((e) => add(paraISO(new Date(e.inicio)), { ...e, origem: 'evento' }))
    tarefas.forEach((t) => add(t.prazo, { ...t, origem: 'tarefa' }))
    Object.values(mapa).forEach((lista) => lista.sort((a, b) =>
      (a.origem === 'evento' && !a.dia_inteiro ? new Date(a.inicio).getHours() * 60 + new Date(a.inicio).getMinutes() : -1) -
      (b.origem === 'evento' && !b.dia_inteiro ? new Date(b.inicio).getHours() * 60 + new Date(b.inicio).getMinutes() : -1)))
    return mapa
  }, [eventos, tarefas])

  const mudarMes = (delta) => setMes(({ ano, mes: m }) => {
    const d = new Date(ano, m + delta, 1)
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })

  const titulo = new Date(mes.ano, mes.mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const hojeTexto = hojeISO()

  function abrirItem(item) {
    if (item.origem === 'tarefa') navigate(`../tarefas?tarefa=${item.id}`)
    else setModal({ evento: item })
  }

  return (
    <div className="calendario">
      <div className="barra-ferramentas">
        <div className="navegacao-mes">
          <button className="botao-icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="voltar" /></button>
          <h2>{titulo}</h2>
          <button className="botao-icone" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="avancar" /></button>
          <button className="botao botao-secundario botao-pequeno" onClick={() => setMes({ ano: hoje.getFullYear(), mes: hoje.getMonth() })}>
            Hoje
          </button>
        </div>
        <span className="espaco" />
        <span className="legenda"><i className="ponto ponto-evento" /> Evento</span>
        <span className="legenda"><i className="ponto ponto-tarefa" /> Prazo de tarefa</span>
        <button className="botao botao-principal botao-pequeno" onClick={() => setModal({ evento: {}, dia: hojeTexto })}>
          <Icone nome="mais" tamanho={16} /> Evento
        </button>
      </div>

      <div className="grade-mes-rolagem">
        <div className="grade-mes">
          {DIAS_SEMANA.map((d) => <div key={d} className="dia-semana">{d}</div>)}
          {semanas.flat().map((data) => {
            const iso = paraISO(data)
            const itens = porDia[iso] || []
            const foraDoMes = data.getMonth() !== mes.mes
            return (
              <div
                key={iso}
                className={`dia ${foraDoMes ? 'fora' : ''} ${iso === hojeTexto ? 'hoje' : ''}`}
                onClick={(e) => e.target === e.currentTarget && setModal({ evento: {}, dia: iso })}
              >
                <button className="dia-numero" onClick={() => setModal({ evento: {}, dia: iso })} title="Criar evento neste dia">
                  {data.getDate()}
                </button>
                {itens.map((item) => (
                  <button
                    key={item.origem + item.id}
                    className={`item-agenda item-${item.origem} ${item.concluida_em ? 'concluido' : ''} ${item.origem === 'tarefa' && !item.concluida_em && iso < hojeTexto ? 'atrasado' : ''}`}
                    onClick={() => abrirItem(item)}
                    title={item.titulo}
                  >
                    {item.origem === 'evento' && !item.dia_inteiro && <b>{formatarHora(item.inicio)}</b>}
                    {item.titulo}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {modal && (
        <EventoModal
          evento={modal.evento}
          diaInicial={modal.dia}
          clienteId={cliente.id}
          aoFechar={() => setModal(null)}
          aoMudar={carregar}
        />
      )}
    </div>
  )
}
