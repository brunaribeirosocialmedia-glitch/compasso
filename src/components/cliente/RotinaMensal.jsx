import { useCallback, useEffect, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useCliente } from '../../pages/AreaCliente'
import { PRIORIDADES } from '../../lib/cores'
import Modal, { BotaoExcluir } from '../Modal'
import BotaoSalvar, { pausaParaVer, useSalvar } from '../BotaoSalvar'
import Icone from '../Icone'
import Checklist from './Checklist'
import { SeletorEtiquetas } from './Etiquetas'

const VAZIO = {
  titulo: '', descricao: '', responsavel_id: '', prioridade: '',
  dia_inicio: '', dia_prazo: '', etiquetas: [], checklist: [], ativo: true,
}

function FormItem({ item, pessoas, etiquetas, aoMudarEtiquetas, aoVoltar, aoSalvo }) {
  const { cliente } = useCliente()
  const [form, setForm] = useState(item ? {
    ...VAZIO, ...item,
    descricao: item.descricao || '', responsavel_id: item.responsavel_id || '', prioridade: item.prioridade || '',
    dia_inicio: item.dia_inicio ?? '', dia_prazo: item.dia_prazo ?? '',
  } : VAZIO)
  const [erro, setErro] = useState('')
  const { estado, rodar } = useSalvar()
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    const inicio = form.dia_inicio === '' ? null : Number(form.dia_inicio)
    const prazo = Number(form.dia_prazo)
    if (!prazo) return setErro('Informe o dia do prazo.')
    if (inicio && inicio > prazo) return setErro('O dia de início não pode ser depois do dia do prazo.')
    setErro('')
    const ok = await rodar(async () => {
      const campos = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        responsavel_id: form.responsavel_id || null,
        prioridade: form.prioridade || null,
        dia_inicio: inicio,
        dia_prazo: prazo,
        etiquetas: form.etiquetas,
        checklist: form.checklist.map((i) => ({ ...i, feito: false })),
        ativo: form.ativo,
      }
      const { error } = item
        ? await supabase.from('rotina_itens').update(campos).eq('id', item.id)
        : await supabase.from('rotina_itens').insert({ ...campos, cliente_id: cliente.id })
      if (error) { setErro(traduzirErro(error)); return false }
      return true
    })
    if (ok) { await pausaParaVer(); aoSalvo() }
  }

  async function excluir() {
    const { error } = await supabase.from('rotina_itens').delete().eq('id', item.id)
    if (error) return setErro(traduzirErro(error))
    aoSalvo()
  }

  const dias = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <form className="formulario" onSubmit={salvar}>
      <label className="campo">
        <span>Tarefa</span>
        <input {...campo('titulo')} placeholder="Ex.: Planejamento do mês, Relatório mensal" required autoFocus />
      </label>
      <label className="campo">
        <span>Descrição</span>
        <textarea rows={3} {...campo('descricao')} placeholder="Detalhes que se repetem todo mês" />
      </label>
      <div className="grade-campos">
        <label className="campo">
          <span>Começa no dia</span>
          <select {...campo('dia_inicio')}>
            <option value="">Sem data de início</option>
            {dias.map((d) => <option key={d} value={d}>Dia {d}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Prazo no dia</span>
          <select {...campo('dia_prazo')} required>
            <option value="">Escolha o dia</option>
            {dias.map((d) => <option key={d} value={d}>Dia {d}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Responsável</span>
          <select {...campo('responsavel_id')}>
            <option value="">Ninguém</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Prioridade</span>
          <select {...campo('prioridade')}>
            <option value="">Sem prioridade</option>
            {Object.entries(PRIORIDADES).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
          </select>
        </label>
      </div>
      <small className="texto-suave">Em meses mais curtos, dias como 30 e 31 caem no último dia do mês.</small>

      <div className="campo">
        <span>Etiquetas</span>
        <SeletorEtiquetas
          valor={form.etiquetas}
          onChange={(lista) => setForm((f) => ({ ...f, etiquetas: lista }))}
          etiquetas={etiquetas}
          aoMudarLista={aoMudarEtiquetas}
        />
      </div>
      <div className="campo">
        <span>Checklist da tarefa</span>
        <Checklist itens={form.checklist} onChange={(lista) => setForm((f) => ({ ...f, checklist: lista }))} mostrarMarcar={false} />
      </div>
      <label className="marcar">
        <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
        Ativa (desmarque para pausar sem apagar)
      </label>

      {erro && <p className="alerta alerta-erro">{erro}</p>}
      <div className="modal-rodape rodape-interno">
        {item && <BotaoExcluir aoConfirmar={excluir} texto="Excluir da rotina" />}
        <span className="espaco" />
        <button type="button" className="botao botao-secundario" onClick={aoVoltar}>Voltar</button>
        <BotaoSalvar type="submit" estado={estado} disabled={!form.titulo.trim() || !form.dia_prazo} />
      </div>
    </form>
  )
}

export default function RotinaMensal({ etiquetas, aoMudarEtiquetas, aoFechar, aoMudar }) {
  const { cliente, pessoas } = useCliente()
  const [itens, setItens] = useState(null)
  const [editando, setEditando] = useState(null)   // null = lista; 'novo' ou o item
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('rotina_itens').select('*').eq('cliente_id', cliente.id).order('dia_prazo').order('criado_em')
    setItens(data || [])
  }, [cliente.id])

  useEffect(() => { carregar() }, [carregar])

  async function aoSalvo() {
    setEditando(null)
    await carregar()
    const { data } = await supabase.rpc('gerar_rotina_do_mes', { p_cliente_id: cliente.id })
    setAviso(data > 0 ? `${data} tarefa${data === 1 ? '' : 's'} deste mês ${data === 1 ? 'foi criada' : 'foram criadas'} no quadro.` : '')
    aoMudar()
  }

  const nomeDe = (id) => {
    const p = pessoas.find((x) => x.id === id)
    return p ? (p.nome || p.email) : null
  }

  return (
    <Modal titulo={editando ? (editando === 'novo' ? 'Nova tarefa da rotina' : 'Editar tarefa da rotina') : 'Rotina mensal'} aoFechar={aoFechar} largura={620}>
      {editando ? (
        <FormItem
          item={editando === 'novo' ? null : editando}
          pessoas={pessoas}
          etiquetas={etiquetas}
          aoMudarEtiquetas={aoMudarEtiquetas}
          aoVoltar={() => setEditando(null)}
          aoSalvo={aoSalvo}
        />
      ) : (
        <div className="formulario">
          <p className="texto-suave">
            Tarefas que se repetem todo mês com {cliente.nome}. No começo de cada mês elas aparecem sozinhas no quadro,
            com o prazo no dia escolhido. Se você excluir uma tarefa gerada, ela não volta naquele mês.
          </p>
          {aviso && <p className="alerta alerta-ok">{aviso}</p>}
          {itens === null ? (
            <p className="texto-suave">Carregando…</p>
          ) : itens.length === 0 ? (
            <p className="texto-suave">Nenhuma tarefa na rotina ainda. Comece pelo que você faz todo mês: planejamento, roteiros, aprovação, relatório…</p>
          ) : (
            <ul className="lista-rotina">
              {itens.map((r) => (
                <li key={r.id} className={r.ativo ? '' : 'pausada'}>
                  <button type="button" onClick={() => setEditando(r)}>
                    <span className="rotina-dia">
                      <small>dia</small>
                      <strong>{r.dia_prazo}</strong>
                    </span>
                    <span className="rotina-info">
                      <strong>{r.titulo}</strong>
                      <small className="texto-suave">
                        {[
                          r.dia_inicio && `começa dia ${r.dia_inicio}`,
                          nomeDe(r.responsavel_id),
                          r.checklist?.length > 0 && `${r.checklist.length} ite${r.checklist.length === 1 ? 'm' : 'ns'} no checklist`,
                          !r.ativo && 'pausada',
                        ].filter(Boolean).join(' · ') || 'Sem responsável'}
                      </small>
                    </span>
                    <Icone nome="avancar" tamanho={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button type="button" className="botao botao-principal botao-pequeno" onClick={() => setEditando('novo')}>
              <Icone nome="mais" tamanho={16} /> Adicionar tarefa à rotina
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
