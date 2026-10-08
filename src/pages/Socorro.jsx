import { useEffect, useMemo, useState } from 'react'
import { supabase, traduzirErro } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal, { BotaoExcluir } from '../components/Modal'
import Icone from '../components/Icone'

/*
  Socorro — a Biblioteca viva da B Mídia.
  A equipe consulta estruturas de conteúdo (bio por nicho, ganchos de
  Reel/carrossel, CTAs, estrutura de legenda). A admin cria, edita e
  remove itens e categorias pela própria tela (tabelas socorro_*).
*/

export default function Socorro() {
  const { permissoes } = useAuth()
  const admin = !!permissoes.admin

  const [categorias, setCategorias] = useState([])
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [catAtiva, setCatAtiva] = useState('todas')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(null)

  const [editando, setEditando] = useState(null)   // item em edição (ou {novo:true})
  const [novaCategoria, setNovaCategoria] = useState(false)

  async function carregar() {
    const [{ data: cats }, { data: its, error }] = await Promise.all([
      supabase.from('socorro_categorias').select('*').order('ordem'),
      supabase.from('socorro_itens').select('*').eq('ativo', true).order('ordem'),
    ])
    if (error) setErro(traduzirErro(error))
    setCategorias(cats || [])
    setItens(its || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const nomeCategoria = useMemo(() => {
    const m = {}
    categorias.forEach((c) => { m[c.id] = c.nome })
    return m
  }, [categorias])

  const termo = busca.trim().toLowerCase()
  const visiveis = useMemo(() => {
    let lista = itens
    if (termo) {
      lista = lista.filter((i) =>
        (i.titulo + ' ' + i.conteudo + ' ' + (i.nicho || '') + ' ' + (nomeCategoria[i.categoria_id] || ''))
          .toLowerCase().includes(termo))
    } else if (catAtiva !== 'todas') {
      lista = lista.filter((i) => i.categoria_id === catAtiva)
    }
    return lista
  }, [itens, termo, catAtiva, nomeCategoria])

  async function copiar(item) {
    try {
      await navigator.clipboard.writeText(item.conteudo)
      setCopiado(item.id)
      setTimeout(() => setCopiado(null), 1800)
    } catch { setErro('Não deu para copiar. Selecione o texto e copie manualmente.') }
  }

  async function excluirItem(item) {
    setErro('')
    const { error } = await supabase.from('socorro_itens').delete().eq('id', item.id)
    if (error) return setErro(traduzirErro(error))
    setEditando(null)
    carregar()
  }

  return (
    <div className="pagina socorro">
      <EstiloSocorro />

      <header className="socorro-topo">
        <div>
          <h1>Socorro</h1>
          <p className="texto-suave">A biblioteca da B Mídia. Estruturas prontas para consultar na hora de criar.</p>
        </div>
        {admin && (
          <button className="botao botao-principal" onClick={() => setEditando({ novo: true, categoria_id: categorias[0]?.id || '', titulo: '', conteudo: '', nicho: '' })} disabled={!categorias.length}>
            <Icone nome="mais" tamanho={16} /> Novo item
          </button>
        )}
      </header>

      <div className="socorro-busca">
        <Icone nome="busca" tamanho={18} />
        <input
          type="search"
          placeholder="Buscar por tema, nicho ou palavra…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {!termo && (
        <div className="socorro-chips">
          <button className={`chip ${catAtiva === 'todas' ? 'ativo' : ''}`} onClick={() => setCatAtiva('todas')}>Todas</button>
          {categorias.map((c) => (
            <button key={c.id} className={`chip ${catAtiva === c.id ? 'ativo' : ''}`} onClick={() => setCatAtiva(c.id)}>{c.nome}</button>
          ))}
          {admin && (
            <button className="chip chip-add" onClick={() => setNovaCategoria(true)} title="Nova categoria">
              <Icone nome="mais" tamanho={14} /> Categoria
            </button>
          )}
        </div>
      )}

      {erro && <p className="alerta alerta-erro">{erro}</p>}

      {carregando ? (
        <p className="texto-suave recuo">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="cartao vazio">
          <p>{termo ? 'Nada encontrado para essa busca.' : 'Ainda não há itens nesta categoria.'}</p>
        </div>
      ) : (
        <div className="socorro-lista">
          {visiveis.map((item) => (
            <article className="cartao socorro-item" key={item.id}>
              <div className="socorro-item-topo">
                <div>
                  <h3>{item.titulo}</h3>
                  <div className="socorro-tags">
                    {termo && <span className="socorro-cat">{nomeCategoria[item.categoria_id]}</span>}
                    {item.nicho && <span className="socorro-nicho">{item.nicho}</span>}
                  </div>
                </div>
                <div className="socorro-acoes">
                  <button className="botao botao-fantasma botao-pequeno" onClick={() => copiar(item)}>
                    <Icone nome={copiado === item.id ? 'confirmar' : 'notas'} tamanho={15} /> {copiado === item.id ? 'Copiado' : 'Copiar'}
                  </button>
                  {admin && (
                    <button className="botao botao-fantasma botao-pequeno" onClick={() => setEditando(item)}>
                      <Icone nome="config" tamanho={15} /> Editar
                    </button>
                  )}
                </div>
              </div>
              <p className="socorro-conteudo">{item.conteudo}</p>
            </article>
          ))}
        </div>
      )}

      {editando && (
        <ItemModal
          item={editando}
          categorias={categorias}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); carregar() }}
          aoExcluir={excluirItem}
        />
      )}

      {novaCategoria && (
        <CategoriaModal
          ordemProxima={(categorias[categorias.length - 1]?.ordem || 0) + 1}
          aoFechar={() => setNovaCategoria(false)}
          aoSalvar={() => { setNovaCategoria(false); carregar() }}
        />
      )}
    </div>
  )
}

// ------- Modal de item (criar / editar) -------
function ItemModal({ item, categorias, aoFechar, aoSalvar, aoExcluir }) {
  const novo = !!item.novo
  const [form, setForm] = useState({
    categoria_id: item.categoria_id || categorias[0]?.id || '',
    titulo: item.titulo || '',
    nicho: item.nicho || '',
    conteudo: item.conteudo || '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const campo = (n) => ({ value: form[n], onChange: (e) => setForm({ ...form, [n]: e.target.value }) })

  async function salvar() {
    if (!form.titulo.trim() || !form.conteudo.trim() || !form.categoria_id) {
      return setErro('Preencha categoria, título e conteúdo.')
    }
    setSalvando(true); setErro('')
    const dados = {
      categoria_id: form.categoria_id,
      titulo: form.titulo.trim(),
      conteudo: form.conteudo,
      nicho: form.nicho.trim() || null,
    }
    const resp = novo
      ? await supabase.from('socorro_itens').insert(dados)
      : await supabase.from('socorro_itens').update(dados).eq('id', item.id)
    setSalvando(false)
    if (resp.error) return setErro(traduzirErro(resp.error))
    aoSalvar()
  }

  return (
    <Modal
      titulo={novo ? 'Novo item' : 'Editar item'}
      aoFechar={aoFechar}
      largura={620}
      rodape={
        <>
          {!novo && <BotaoExcluir aoConfirmar={() => aoExcluir(item)} texto="Excluir item" />}
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="botao botao-principal" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="campo">
          <span>Categoria</span>
          <select {...campo('categoria_id')}>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Título</span>
          <input {...campo('titulo')} required placeholder="Ex: Bio · Gastronomia" />
        </label>
        <label className="campo">
          <span>Nicho (opcional)</span>
          <input {...campo('nicho')} placeholder="Ex: Gastronomia" />
        </label>
        <label className="campo">
          <span>Conteúdo</span>
          <textarea rows={10} {...campo('conteudo')} placeholder="A estrutura, do jeito que a equipe vai consultar." />
        </label>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

// ------- Modal de nova categoria -------
function CategoriaModal({ ordemProxima, aoFechar, aoSalvar }) {
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome à categoria.')
    setSalvando(true); setErro('')
    const { error } = await supabase.from('socorro_categorias').insert({ nome: nome.trim(), ordem: ordemProxima })
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    aoSalvar()
  }

  return (
    <Modal
      titulo="Nova categoria"
      aoFechar={aoFechar}
      largura={440}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="botao botao-principal" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Criar'}
          </button>
        </>
      }
    >
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="campo">
          <span>Nome da categoria</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Ideias de conteúdo" />
        </label>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

function EstiloSocorro() {
  return (
    <style>{`
      .socorro-topo { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .socorro-topo h1 { margin: 0; }
      .socorro-topo p { margin: 4px 0 0; max-width: 46ch; }

      .socorro-busca { display: flex; align-items: center; gap: 10px; margin: 20px 0 14px; padding: 0 14px;
        border: 1px solid var(--borda, #e1e1e1); border-radius: 12px; background: var(--fundo-suave, #fafafc); color: var(--texto-suave, #888); }
      .socorro-busca input { flex: 1; border: none; background: none; padding: 12px 0; font-family: inherit; font-size: 15px; color: var(--texto, #040022); }
      .socorro-busca input:focus { outline: none; }

      .socorro-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
      .socorro-chips .chip { border: 1px solid var(--borda, #e1e1e1); background: var(--fundo, #fff); color: var(--texto-suave, #666);
        padding: 7px 14px; border-radius: 999px; font-family: inherit; font-size: 13px; cursor: pointer; transition: all .15s; }
      .socorro-chips .chip:hover { border-color: var(--texto, #040022); }
      .socorro-chips .chip.ativo { background: var(--texto, #040022); color: #fff; border-color: var(--texto, #040022); }
      .socorro-chips .chip-add { display: inline-flex; align-items: center; gap: 4px; border-style: dashed; }

      .socorro-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; align-items: start; }
      .socorro-item { padding: 18px 20px; }
      .socorro-item-topo { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .socorro-item-topo h3 { margin: 0; font-size: 16px; }
      .socorro-tags { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
      .socorro-cat, .socorro-nicho { font-size: 11px; letter-spacing: .04em; padding: 3px 9px; border-radius: 999px; }
      .socorro-cat { background: #EEF0F6; color: #4A6FA5; }
      .socorro-nicho { background: var(--cinza-claro, #E1E1E1); color: var(--texto, #040022); }
      .socorro-acoes { display: flex; gap: 4px; flex-shrink: 0; }
      .socorro-conteudo { white-space: pre-wrap; line-height: 1.6; font-size: 14.5px; margin: 14px 0 0; color: var(--texto, #1b1733); }

      @media (max-width: 560px) {
        .socorro-lista { grid-template-columns: 1fr; }
        .socorro-acoes { flex-direction: column; }
      }
    `}</style>
  )
}
