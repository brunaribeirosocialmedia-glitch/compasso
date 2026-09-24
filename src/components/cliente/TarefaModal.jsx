import { useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { PRIORIDADES } from '../../lib/cores'
import Modal, { BotaoExcluir } from '../Modal'

export default function TarefaModal({ tarefa, colunas, pessoas, aoFechar, aoSalvar, aoExcluir }) {
  const [form, setForm] = useState({
    titulo: tarefa.titulo,
    descricao: tarefa.descricao || '',
    coluna_id: tarefa.coluna_id,
    responsavel_id: tarefa.responsavel_id || '',
    prioridade: tarefa.prioridade || '',
    data_inicio: tarefa.data_inicio || '',
    prazo: tarefa.prazo || '',
    etiquetas: (tarefa.etiquetas || []).join(', '),
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    if (form.data_inicio && form.prazo && form.data_inicio > form.prazo) {
      return setErro('A data de início não pode ser depois do prazo.')
    }
    setSalvando(true)
    const campos = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      coluna_id: form.coluna_id,
      responsavel_id: form.responsavel_id || null,
      prioridade: form.prioridade || null,
      data_inicio: form.data_inicio || null,
      prazo: form.prazo || null,
      etiquetas: [...new Set(form.etiquetas.split(',').map((x) => x.trim()).filter(Boolean))],
    }
    const { data, error } = await supabase.from('tarefas').update(campos).eq('id', tarefa.id).select().single()
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    aoSalvar(data)
    aoFechar()
  }

  async function excluir() {
    const { error } = await supabase.from('tarefas').delete().eq('id', tarefa.id)
    if (error) return setErro(traduzirErro(error))
    aoExcluir(tarefa.id)
  }

  return (
    <Modal
      titulo="Tarefa"
      aoFechar={aoFechar}
      largura={620}
      rodape={
        <>
          <BotaoExcluir aoConfirmar={excluir} texto="Excluir tarefa" />
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-tarefa" className="botao botao-principal" disabled={salvando || !form.titulo.trim()}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="form-tarefa" className="formulario" onSubmit={salvar}>
        <label className="campo">
          <span>Título</span>
          <input {...campo('titulo')} required />
        </label>
        <label className="campo">
          <span>Descrição</span>
          <textarea rows={5} {...campo('descricao')} placeholder="Detalhes, links, referências…" />
        </label>

        <div className="grade-campos">
          <label className="campo">
            <span>Status</span>
            <select {...campo('coluna_id')}>
              {colunas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
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
          <label className="campo">
            <span>Início</span>
            <input type="date" {...campo('data_inicio')} />
          </label>
          <label className="campo">
            <span>Prazo</span>
            <input type="date" {...campo('prazo')} />
          </label>
          <label className="campo">
            <span>Etiquetas</span>
            <input {...campo('etiquetas')} placeholder="reels, carrossel" />
          </label>
        </div>

        {tarefa.concluida_em && (
          <p className="texto-suave">Concluída em {new Date(tarefa.concluida_em).toLocaleDateString('pt-BR')}.</p>
        )}
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}
