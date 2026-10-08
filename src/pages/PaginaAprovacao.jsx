import { useEffect, useMemo, useState } from 'react'
import { supabase, configurado } from '../lib/supabase'

/*
  Janela pública de aprovação do cliente (a ponte Compasso ⇄ Cadência).
  Rota: #/aprovar/<token>  — sem login. Recebe o token por prop (o App
  detecta a rota pelo hash e renderiza esta página fora do portão de login).
  Mostra as peças que estão na coluna "Em aprovação"; ao aprovar, a peça
  pula para a coluna "Aprovado" no Compasso.
  Visual autossuficiente (identidade B Mídia), independente do tema interno.
*/

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const publico = (caminho) =>
  caminho ? `${URL_BASE}/storage/v1/object/public/pecas/${caminho}` : ''

const FORMATOS = {
  feed:      'Feed',
  carrossel: 'Carrossel',
  story:     'Story',
  video:     'Vídeo',
}

function formatarData(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  } catch { return '' }
}

// ------- Galeria de mídias (imagem única, carrossel ou vídeo) -------
function Galeria({ midias }) {
  const itens = useMemo(
    () => [...(midias || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [midias],
  )
  const [ativo, setAtivo] = useState(0)

  if (!itens.length) return <div className="apr-sem-midia">Sem arte anexada</div>

  return (
    <div className="apr-galeria">
      <div
        className="apr-trilho"
        onScroll={(e) => {
          const i = Math.round(e.target.scrollLeft / e.target.clientWidth)
          if (i !== ativo) setAtivo(i)
        }}
      >
        {itens.map((m, i) => (
          <div className="apr-slide" key={i}>
            {m.tipo === 'video' ? (
              <video src={publico(m.caminho)} controls playsInline preload="metadata" />
            ) : (
              <img src={publico(m.caminho)} alt={m.nome || `Arte ${i + 1}`} loading="lazy" />
            )}
          </div>
        ))}
      </div>
      {itens.length > 1 && (
        <div className="apr-pontos">
          {itens.map((_, i) => <span key={i} className={i === ativo ? 'is-ativo' : ''} />)}
        </div>
      )}
    </div>
  )
}

// ------- Comentários de uma peça -------
function Comentarios({ lista }) {
  if (!lista?.length) return null
  return (
    <div className="apr-comentarios">
      {lista.map((c, i) => (
        <div className={`apr-comentario ${c.origem === 'cliente' ? 'is-cliente' : ''}`} key={i}>
          <span className="apr-comentario-autor">{c.autor || 'Equipe'}</span>
          <p>{c.texto}</p>
        </div>
      ))}
    </div>
  )
}

// ------- Cartão de uma peça em aprovação -------
function CartaoPeca({ token, peca, nomeCliente, aoAprovar }) {
  const [texto, setTexto] = useState('')
  const [comentarios, setComentarios] = useState(peca.comentarios || [])
  const [enviando, setEnviando] = useState(false)
  const [aprovando, setAprovando] = useState(false)
  const [erro, setErro] = useState('')

  async function comentar() {
    const t = texto.trim()
    if (!t) return
    setEnviando(true); setErro('')
    const { error } = await supabase.rpc('aprovacao_comentar', {
      p_token: token, p_tarefa_id: peca.id, p_nome: nomeCliente || null, p_texto: t,
    })
    setEnviando(false)
    if (error) { setErro('Não deu para enviar agora. Tente de novo.'); return }
    setComentarios((c) => [...c, { texto: t, autor: nomeCliente || 'Você', origem: 'cliente' }])
    setTexto('')
  }

  async function aprovar() {
    setAprovando(true); setErro('')
    const { error } = await supabase.rpc('aprovacao_aprovar', { p_token: token, p_tarefa_id: peca.id })
    if (error) { setAprovando(false); setErro('Não deu para aprovar agora. Tente de novo.'); return }
    aoAprovar(peca.id)
  }

  return (
    <article className="apr-cartao">
      <Galeria midias={peca.midias} />

      <div className="apr-corpo">
        <div className="apr-cabeca">
          {peca.formato && <span className="apr-selo">{FORMATOS[peca.formato] || peca.formato}</span>}
          {peca.prazo && <span className="apr-prazo">Publicar em {formatarData(peca.prazo)}</span>}
        </div>

        {peca.titulo && <h3 className="apr-titulo">{peca.titulo}</h3>}
        {peca.legenda && <p className="apr-legenda">{peca.legenda}</p>}

        <Comentarios lista={comentarios} />

        <div className="apr-acao-comentar">
          <textarea
            rows={2}
            placeholder="Quer pedir um ajuste? Escreva aqui."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button type="button" className="apr-botao-texto" onClick={comentar} disabled={enviando || !texto.trim()}>
            {enviando ? 'Enviando…' : 'Enviar comentário'}
          </button>
        </div>

        {erro && <p className="apr-erro">{erro}</p>}

        <button type="button" className="apr-botao-aprovar" onClick={aprovar} disabled={aprovando}>
          {aprovando ? 'Aprovando…' : 'Aprovar'}
        </button>
      </div>
    </article>
  )
}

export default function PaginaAprovacao({ token }) {
  const [estado, setEstado] = useState('carregando') // carregando | ok | invalido | erro
  const [dados, setDados] = useState(null)
  const [aprovadosAgora, setAprovadosAgora] = useState([])
  const [nome, setNome] = useState(() => {
    try { return localStorage.getItem('apr-nome') || '' } catch { return '' }
  })
  const [perguntandoNome, setPerguntandoNome] = useState(false)

  async function carregar() {
    if (!configurado) { setEstado('erro'); return }
    const { data, error } = await supabase.rpc('aprovacao_quadro', { p_token: token })
    if (error) { setEstado('erro'); return }
    if (!data) { setEstado('invalido'); return }
    setDados(data)
    setEstado('ok')
  }

  useEffect(() => { carregar() }, [token]) // eslint-disable-line

  useEffect(() => {
    if (estado === 'ok' && !nome) setPerguntandoNome(true)
  }, [estado]) // eslint-disable-line

  function salvarNome(valor) {
    const v = valor.trim()
    setNome(v)
    try { localStorage.setItem('apr-nome', v) } catch {}
    setPerguntandoNome(false)
  }

  function aoAprovar(id) {
    setAprovadosAgora((a) => [...a, id])
  }

  if (estado === 'carregando') {
    return <Casca><p className="apr-vazio">Carregando…</p></Casca>
  }
  if (estado === 'invalido') {
    return (
      <Casca>
        <p className="apr-vazio">
          Este link de aprovação não é válido ou expirou.<br />
          Fale com a sua agência para receber o link atualizado.
        </p>
      </Casca>
    )
  }
  if (estado === 'erro') {
    return (
      <Casca>
        <p className="apr-vazio">Não conseguimos carregar agora. Atualize a página em instantes.</p>
      </Casca>
    )
  }

  const pendentes = (dados.pendentes || []).filter((p) => !aprovadosAgora.includes(p.id))
  const aprovados = [
    ...(dados.aprovados || []),
    ...(dados.pendentes || []).filter((p) => aprovadosAgora.includes(p.id)),
  ]

  return (
    <Casca nomeCliente={dados.cliente?.nome}>
      {perguntandoNome && (
        <div className="apr-nome-caixa">
          <span>Como podemos te chamar? (aparece nos seus comentários)</span>
          <PerguntaNome aoSalvar={salvarNome} />
        </div>
      )}

      {pendentes.length === 0 ? (
        <p className="apr-vazio">Nenhuma peça aguardando a sua aprovação no momento. ✦</p>
      ) : (
        <div className="apr-lista">
          {pendentes.map((p) => (
            <CartaoPeca key={p.id} token={token} peca={p} nomeCliente={nome} aoAprovar={aoAprovar} />
          ))}
        </div>
      )}

      {aprovados.length > 0 && (
        <section className="apr-aprovados">
          <h2>Já aprovadas</h2>
          <div className="apr-aprovados-grade">
            {aprovados.map((p) => (
              <div className="apr-mini" key={p.id}>
                <Galeria midias={p.midias} />
                <div className="apr-mini-info">
                  {p.formato && <span className="apr-selo apr-selo-claro">{FORMATOS[p.formato] || p.formato}</span>}
                  <span className="apr-mini-ok">✓ Aprovada</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Casca>
  )
}

function PerguntaNome({ aoSalvar }) {
  const [v, setV] = useState('')
  return (
    <form className="apr-nome-form" onSubmit={(e) => { e.preventDefault(); aoSalvar(v) }}>
      <input type="text" value={v} onChange={(e) => setV(e.target.value)} placeholder="Seu nome" autoFocus />
      <button type="submit" className="apr-botao-texto">Pronto</button>
    </form>
  )
}

// ------- Casca visual (identidade B Mídia) -------
function Casca({ children, nomeCliente }) {
  return (
    <div className="apr-pagina">
      <EstiloAprovacao />
      <header className="apr-topo">
        <div className="apr-marca">B&nbsp;Mídia</div>
        <div className="apr-sub">Aprovação de conteúdo</div>
        {nomeCliente && <div className="apr-cliente">{nomeCliente}</div>}
      </header>
      <main className="apr-conteudo">{children}</main>
      <footer className="apr-rodape">Feito com intenção por B Mídia.</footer>
    </div>
  )
}

function EstiloAprovacao() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Questrial&family=Alice&display=swap');

      .apr-pagina {
        --tinta: #040022;
        --cinza: #C2C2C2;
        --cinza-claro: #E1E1E1;
        --fundo: #FAFAFC;
        --branco: #FFFFFF;
        min-height: 100vh;
        background: var(--fundo);
        color: var(--tinta);
        font-family: 'Questrial', system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .apr-pagina * { box-sizing: border-box; }

      .apr-topo {
        text-align: center;
        padding: 40px 20px 28px;
        border-bottom: 1px solid var(--cinza-claro);
      }
      .apr-marca {
        font-family: 'Alice', Georgia, serif;
        font-size: 26px; letter-spacing: 0.04em; color: var(--tinta);
      }
      .apr-sub {
        margin-top: 6px; font-size: 12px; letter-spacing: 0.28em;
        text-transform: uppercase; color: var(--cinza);
      }
      .apr-cliente {
        margin-top: 14px; font-family: 'Alice', Georgia, serif;
        font-size: 17px; color: var(--tinta);
      }

      .apr-conteudo { max-width: 560px; margin: 0 auto; padding: 28px 16px 48px; }

      .apr-vazio {
        text-align: center; color: var(--cinza); font-size: 15px;
        line-height: 1.7; padding: 56px 12px;
      }

      .apr-nome-caixa {
        background: var(--branco); border: 1px solid var(--cinza-claro);
        border-radius: 14px; padding: 18px; margin-bottom: 24px; font-size: 14px;
      }
      .apr-nome-caixa > span { color: var(--tinta); display: block; margin-bottom: 10px; }
      .apr-nome-form { display: flex; gap: 8px; }
      .apr-nome-form input {
        flex: 1; padding: 10px 12px; border: 1px solid var(--cinza-claro);
        border-radius: 10px; font-family: inherit; font-size: 15px; color: var(--tinta);
      }
      .apr-nome-form input:focus { outline: none; border-color: var(--tinta); }

      .apr-lista { display: flex; flex-direction: column; gap: 28px; }

      .apr-cartao {
        background: var(--branco); border: 1px solid var(--cinza-claro);
        border-radius: 18px; overflow: hidden; box-shadow: 0 1px 2px rgba(4,0,34,0.04);
      }

      .apr-galeria { position: relative; background: #0f0a2e; }
      .apr-trilho {
        display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
      }
      .apr-trilho::-webkit-scrollbar { display: none; }
      .apr-slide {
        flex: 0 0 100%; scroll-snap-align: center; aspect-ratio: 4 / 5;
        background: #0f0a2e; display: flex; align-items: center; justify-content: center;
      }
      .apr-slide img, .apr-slide video { width: 100%; height: 100%; object-fit: contain; display: block; }
      .apr-sem-midia {
        aspect-ratio: 4 / 5; display: flex; align-items: center; justify-content: center;
        color: var(--cinza); font-size: 14px; background: #0f0a2e;
      }
      .apr-pontos {
        position: absolute; bottom: 12px; left: 0; right: 0;
        display: flex; justify-content: center; gap: 6px;
      }
      .apr-pontos span {
        width: 6px; height: 6px; border-radius: 50%;
        background: rgba(255,255,255,0.45); transition: background .2s;
      }
      .apr-pontos span.is-ativo { background: #fff; }

      .apr-corpo { padding: 20px; }
      .apr-cabeca { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .apr-selo {
        font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
        color: var(--tinta); background: var(--cinza-claro); padding: 4px 10px; border-radius: 999px;
      }
      .apr-selo-claro { background: #EEF0F6; }
      .apr-prazo { font-size: 12px; color: var(--cinza); }

      .apr-titulo {
        font-family: 'Alice', Georgia, serif; font-weight: 400; font-size: 18px;
        margin: 14px 0 0; color: var(--tinta);
      }
      .apr-legenda {
        white-space: pre-wrap; line-height: 1.65; font-size: 15px; color: #1b1733; margin: 12px 0 0;
      }

      .apr-comentarios { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
      .apr-comentario { background: #F4F5F9; border-radius: 10px; padding: 10px 12px; font-size: 14px; }
      .apr-comentario.is-cliente { background: #EAEEF7; }
      .apr-comentario-autor { font-size: 12px; color: var(--cinza); display: block; margin-bottom: 2px; }
      .apr-comentario p { margin: 0; line-height: 1.5; }

      .apr-acao-comentar { margin-top: 16px; }
      .apr-acao-comentar textarea {
        width: 100%; border: 1px solid var(--cinza-claro); border-radius: 10px;
        padding: 10px 12px; font-family: inherit; font-size: 15px; resize: vertical; color: var(--tinta);
      }
      .apr-acao-comentar textarea:focus { outline: none; border-color: var(--tinta); }

      .apr-botao-texto {
        margin-top: 8px; background: none; border: none; cursor: pointer;
        font-family: inherit; font-size: 13px; color: var(--tinta);
        text-decoration: underline; text-underline-offset: 3px; padding: 4px 0;
      }
      .apr-botao-texto:disabled { color: var(--cinza); cursor: default; text-decoration: none; }

      .apr-botao-aprovar {
        margin-top: 18px; width: 100%; padding: 15px; background: var(--tinta); color: #fff;
        border: none; border-radius: 12px; font-family: inherit; font-size: 15px;
        letter-spacing: 0.04em; cursor: pointer; transition: opacity .15s;
      }
      .apr-botao-aprovar:hover { opacity: 0.9; }
      .apr-botao-aprovar:disabled { opacity: 0.5; cursor: default; }

      .apr-erro { color: #b4423a; font-size: 13px; margin: 10px 0 0; }

      .apr-aprovados { margin-top: 44px; }
      .apr-aprovados h2 {
        font-family: 'Alice', Georgia, serif; font-weight: 400; font-size: 15px;
        letter-spacing: 0.02em; color: var(--cinza); text-transform: none;
        border-top: 1px solid var(--cinza-claro); padding-top: 24px; margin: 0 0 16px;
      }
      .apr-aprovados-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .apr-mini {
        background: var(--branco); border: 1px solid var(--cinza-claro);
        border-radius: 12px; overflow: hidden;
      }
      .apr-mini .apr-galeria { border-radius: 0; }
      .apr-mini .apr-slide { aspect-ratio: 1 / 1; }
      .apr-mini-info { padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; }
      .apr-mini-ok { font-size: 12px; color: #4A6FA5; }

      .apr-rodape {
        text-align: center; font-size: 12px; color: var(--cinza);
        padding: 28px 16px 40px; letter-spacing: 0.02em;
      }

      @media (max-width: 420px) {
        .apr-aprovados-grade { grid-template-columns: 1fr; }
      }
    `}</style>
  )
}
