import { useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { PRIORIDADES } from '../../lib/cores'
import Modal, { BotaoExcluir } from '../Modal'
import BotaoSalvar, { pausaParaVer, useSalvar } from '../BotaoSalvar'
import Icone from '../Icone'
import { SeletorEtiquetas } from './Etiquetas'
import Checklist from './Checklist'
import Comentarios from './Comentarios'

export default function TarefaModal({ tarefa, colunas, pessoas, etiquetas, aoMudarEtiquetas, aoFechar, aoSalvar, aoExcluir }) {
  const [form, setForm] = useState({
    titulo: tarefa.titulo,
    descricao: tarefa.descricao || '',
    coluna_id: tarefa.coluna_id,
    responsavel_id: tarefa.responsavel_id || '',
    prioridade: tarefa.prioridade || '',
    data_inicio: tarefa.data_inicio || '',
    prazo: tarefa.prazo || '',
    etiquetas: tarefa.etiquetas || [],
  })
  const [erro, setErro] = useState('')
  const { estado: estadoSalvar, rodar } = useSalvar()
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    if (form.data_inicio && form.prazo && form.data_inicio > form.prazo) {
      return setErro('A data de início não pode ser depois do prazo.')
    }
    setErro('')
    if (await rodar(gravar)) {
      await pausaParaVer()
      aoFechar()
    }
  }

  async function gravar() {
    const campos = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      coluna_id: form.coluna_id,
      responsavel_id: form.responsavel_id || null,
      prioridade: form.prioridade || null,
      data_inicio: form.data_inicio || null,
      prazo: form.prazo || null,
      etiquetas: form.etiquetas,
    }
    const { data, error } = await supabase.from('tarefas').update(campos).eq('id', tarefa.id).select().single()
    if (error) return setErro(traduzirErro(error))
    aoSalvar(data)
    return true
  }

  // Muda o status na hora, sem precisar clicar em Salvar
  const [statusAtual, setStatusAtual] = useState(tarefa.coluna_id)
  const [movida, setMovida] = useState('')
  const [concluidaEm, setConcluidaEm] = useState(tarefa.concluida_em)
  async function mudarStatus(coluna) {
    if (coluna.id === statusAtual) return
    const anterior = statusAtual
    setStatusAtual(coluna.id)
    setForm((f) => ({ ...f, coluna_id: coluna.id }))
    setErro('')
    const { data, error } = await supabase.from('tarefas').update({ coluna_id: coluna.id }).eq('id', tarefa.id).select().single()
    if (error) {
      setStatusAtual(anterior)
      setForm((f) => ({ ...f, coluna_id: anterior }))
      return setErro(traduzirErro(error))
    }
    setConcluidaEm(data.concluida_em)
    aoSalvar(data)
    setMovida(coluna.nome)
  }

  // Checklist grava na hora, como o status
  const [checklist, setChecklist] = useState(tarefa.checklist || [])
  async function mudarChecklist(lista) {
    const anterior = checklist
    setChecklist(lista)
    setErro('')
    const { data, error } = await supabase.from('tarefas').update({ checklist: lista }).eq('id', tarefa.id).select().single()
    if (error) {
      setChecklist(anterior)
      return setErro(traduzirErro(error))
    }
    aoSalvar(data)
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
          <BotaoSalvar type="submit" form="form-tarefa" estado={estadoSalvar} disabled={!form.titulo.trim()} />
        </>
      }
    >
      <form id="form-tarefa" className="formulario" onSubmit={salvar}>
        <div className="campo">
          <span>Status</span>
          <div className="status-tarefa" role="radiogroup" aria-label="Status da tarefa">
            {colunas.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={statusAtual === c.id}
                className={`status-opcao ${statusAtual === c.id ? 'marcado' : ''}`}
                style={c.cor ? { '--cor-coluna': c.cor } : undefined}
                onClick={() => mudarStatus(c)}
              >
                {statusAtual === c.id && <Icone nome="confirmar" tamanho={15} />}
                {c.nome}
              </button>
            ))}
          </div>
          {movida && <small className="status-movida" key={movida}>✓ Movida para “{movida}”</small>}
        </div>

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
        </div>

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
          <span>Checklist</span>
          <Checklist itens={checklist} onChange={mudarChecklist} />
        </div>

        {tarefa.rotina_item_id && (
          <p className="texto-suave origem-rotina"><Icone nome="repetir" tamanho={14} /> Criada pela rotina mensal deste cliente.</p>
        )}
        {concluidaEm && (
          <p className="texto-suave">Concluída em {new Date(concluidaEm).toLocaleDateString('pt-BR')}.</p>
        )}
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>

      <section className="secao-comentarios">
        <h3><Icone nome="comentario" tamanho={16} /> Comentários</h3>
        <Comentarios tarefa={tarefa} pessoas={pessoas} />
      </section>
    </Modal>
  )
}
