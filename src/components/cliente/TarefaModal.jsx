import { useEffect, useRef, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { PRIORIDADES } from '../../lib/cores'
import Modal, { BotaoExcluir } from '../Modal'
import Icone from '../Icone'
import { SeletorEtiquetas } from './Etiquetas'
import Checklist from './Checklist'
import Comentarios from './Comentarios'
import MidiasPeca from './MidiasPeca'

const FORMATOS = [
  ['feed', 'Feed'],
  ['carrossel', 'Carrossel'],
  ['story', 'Story'],
  ['video', 'Vídeo'],
]

export default function TarefaModal({ tarefa, colunas, pessoas, etiquetas, aoMudarEtiquetas, aoFechar, aoSalvar, aoExcluir }) {
  const [form, setForm] = useState({
    titulo: tarefa.titulo,
    descricao: tarefa.descricao || '',
    legenda: tarefa.legenda || '',
    formato: tarefa.formato || '',
    coluna_id: tarefa.coluna_id,
    responsavel_id: tarefa.responsavel_id || '',
    prioridade: tarefa.prioridade || '',
    data_inicio: tarefa.data_inicio || '',
    prazo: tarefa.prazo || '',
    etiquetas: tarefa.etiquetas || [],
  })
  const [erro, setErro] = useState('')
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  // Salvamento automático: grava sozinho um instante depois que a pessoa para de digitar.
  // O status, o checklist e as mídias têm gravação própria, por isso ficam de fora daqui.
  const montarCampos = (f) => ({
    titulo: f.titulo.trim() || tarefa.titulo,
    descricao: f.descricao.trim() || null,
    legenda: f.legenda.trim() || null,
    formato: f.formato || null,
    responsavel_id: f.responsavel_id || null,
    prioridade: f.prioridade || null,
    data_inicio: f.data_inicio || null,
    prazo: f.prazo || null,
    etiquetas: f.etiquetas,
  })
  const [salvamento, setSalvamento] = useState('salvo') // 'salvo' | 'pendente' | 'salvando' | 'erro'
  const ultimoSalvo = useRef(JSON.stringify(montarCampos(form)))
  const formAtual = useRef(form)
  formAtual.current = form
  const datasInvalidas = form.data_inicio && form.prazo && form.data_inicio > form.prazo

  async function gravar() {
    const f = formAtual.current
    if (f.data_inicio && f.prazo && f.data_inicio > f.prazo) return false
    const campos = montarCampos(f)
    const chave = JSON.stringify(campos)
    if (chave === ultimoSalvo.current) {
      setSalvamento('salvo')
      return true
    }
    setSalvamento('salvando')
    const { data, error } = await supabase.from('tarefas').update(campos).eq('id', tarefa.id).select().single()
    if (error) {
      setSalvamento('erro')
      setErro(traduzirErro(error))
      return false
    }
    ultimoSalvo.current = chave
    setErro('')
    aoSalvar(data)
    // Se a pessoa continuou digitando enquanto gravava, ainda há algo pendente
    setSalvamento(JSON.stringify(montarCampos(formAtual.current)) === chave ? 'salvo' : 'pendente')
    return true
  }

  useEffect(() => {
    if (datasInvalidas) {
      setErro('A data de início não pode ser depois do prazo.')
      return
    }
    if (JSON.stringify(montarCampos(form)) === ultimoSalvo.current) return
    setSalvamento('pendente')
    const t = setTimeout(gravar, 800)
    return () => clearTimeout(t)
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!datasInvalidas && erro === 'A data de início não pode ser depois do prazo.') setErro('')
  }, [datasInvalidas]) // eslint-disable-line react-hooks/exhaustive-deps

  // Avisa o navegador se a pessoa tentar fechar a aba com algo ainda não gravado
  const pendente = salvamento === 'pendente' || salvamento === 'salvando' || salvamento === 'erro'
  useEffect(() => {
    if (!pendente) return
    const aviso = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [pendente])

  // Ao fechar (X, Esc, clique fora ou botão), grava o que faltar antes de sair.
  // Se a gravação falhar, a janela fica aberta com o aviso; fechar de novo sai mesmo assim.
  const fechando = useRef(false)
  const falhouAoFechar = useRef(false)
  async function fechar() {
    if (fechando.current) return
    if (falhouAoFechar.current) return aoFechar()
    fechando.current = true
    const ok = await gravar()
    fechando.current = false
    if (ok) aoFechar()
    else falhouAoFechar.current = true
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

  // Mídias da peça gravam na hora, como o checklist
  const [midias, setMidias] = useState(tarefa.midias || [])

  async function excluir() {
    const { error } = await supabase.from('tarefas').delete().eq('id', tarefa.id)
    if (error) return setErro(traduzirErro(error))
    aoExcluir(tarefa.id)
  }

  return (
    <Modal
      titulo="Tarefa"
      aoFechar={fechar}
      largura={620}
      rodape={
        <>
          <BotaoExcluir aoConfirmar={excluir} texto="Excluir tarefa" />
          <span className="espaco" />
          <span className={`status-salvamento ${salvamento}`} aria-live="polite">
            {salvamento === 'salvo' && <><Icone nome="confirmar" tamanho={14} /> Tudo salvo</>}
            {salvamento === 'pendente' && 'Alterações não salvas…'}
            {salvamento === 'salvando' && 'Salvando…'}
            {salvamento === 'erro' && 'Não foi possível salvar'}
          </span>
          {salvamento === 'erro' && (
            <button type="button" className="botao botao-secundario" onClick={gravar}>Tentar de novo</button>
          )}
          <button type="button" className="botao botao-principal" onClick={fechar}>Fechar</button>
        </>
      }
    >
      <form id="form-tarefa" className="formulario" onSubmit={(e) => { e.preventDefault(); gravar() }}>
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
          <textarea rows={4} {...campo('descricao')} placeholder="Briefing interno, links, referências… (não vai para o cliente)" />
        </label>

        {/* ---- A peça: o que o cliente vê e aprova ---- */}
        <div className="campo peca-bloco">
          <style>{`
            .peca-bloco { border: 1px solid var(--borda, #e1e1e1); border-radius: 12px; padding: 16px; background: var(--fundo-suave, #fafafc); }
            .peca-bloco-titulo { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 14px; color: var(--texto, #040022); }
            .peca-bloco .campo { margin-top: 12px; }
            .peca-bloco .campo:first-of-type { margin-top: 10px; }
          `}</style>
          <div className="peca-bloco-titulo"><Icone nome="anexo" tamanho={15} /> Peça para aprovação</div>
          <p className="texto-suave bloco">Arte, legenda e formato que o cliente vê na janela de aprovação.</p>

          <label className="campo">
            <span>Formato</span>
            <select {...campo('formato')}>
              <option value="">Sem formato</option>
              {FORMATOS.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
            </select>
          </label>

          <div className="campo">
            <span>Arte / vídeo</span>
            <MidiasPeca
              clienteId={tarefa.cliente_id}
              tarefaId={tarefa.id}
              midias={midias}
              onChange={setMidias}
              aoSalvar={aoSalvar}
              aoErro={setErro}
            />
          </div>

          <label className="campo">
            <span>Legenda (vai para o cliente)</span>
            <textarea rows={5} {...campo('legenda')} placeholder="A legenda final do post, do jeitinho que vai ao ar." />
          </label>
        </div>

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
