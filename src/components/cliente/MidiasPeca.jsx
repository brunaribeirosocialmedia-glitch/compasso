import { useRef, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import Icone from '../Icone'

/*
  Mídias da peça: fotos e vídeos de uma tarefa (o conteúdo que o cliente
  vai ver e aprovar). Gravam na hora (fora do salvamento automático de texto),
  igual ao checklist e ao status.
  - Arquivos vão para o bucket público "pecas", em <cliente_id>/<tarefa_id>/<arquivo>.
  - A lista fica em tarefas.midias (jsonb): [{caminho, nome, tipo, ordem}].
*/

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const LIMITE = 50 * 1024 * 1024 // 50 MB (bate com o bucket)
const publico = (caminho) =>
  caminho ? `${URL_BASE}/storage/v1/object/public/pecas/${caminho}` : ''

const nomeSeguro = (n) =>
  n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-')

export default function MidiasPeca({ clienteId, tarefaId, midias, onChange, aoSalvar, aoErro }) {
  const [enviando, setEnviando] = useState(false)
  const entrada = useRef(null)

  const ordenadas = [...(midias || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

  // Grava a lista nova no banco e avisa quem precisa
  async function gravar(lista) {
    const limpa = lista.map((m, i) => ({ ...m, ordem: i }))
    const { data, error } = await supabase
      .from('tarefas').update({ midias: limpa }).eq('id', tarefaId).select().single()
    if (error) { aoErro?.(traduzirErro(error)); return false }
    onChange(limpa)
    aoSalvar?.(data)
    return true
  }

  async function enviar(e) {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (!arquivos.length) return
    aoErro?.('')

    for (const f of arquivos) {
      if (f.size > LIMITE) { aoErro?.(`"${f.name}" passa de 50 MB. Comprima o arquivo e tente de novo.`); return }
    }

    setEnviando(true)
    const novas = []
    for (const f of arquivos) {
      const ehVideo = (f.type || '').startsWith('video/')
      const caminho = `${clienteId}/${tarefaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nomeSeguro(f.name)}`
      const { error } = await supabase.storage.from('pecas').upload(caminho, f, {
        contentType: f.type || undefined, upsert: false,
      })
      if (error) { setEnviando(false); aoErro?.(traduzirErro(error)); return }
      novas.push({ caminho, nome: f.name, tipo: ehVideo ? 'video' : 'image', ordem: 0 })
    }

    const ok = await gravar([...(midias || []), ...novas])
    if (!ok) {
      // desfaz os uploads se o banco recusou
      await supabase.storage.from('pecas').remove(novas.map((n) => n.caminho))
    }
    setEnviando(false)
  }

  async function remover(caminho) {
    aoErro?.('')
    const ok = await gravar((midias || []).filter((m) => m.caminho !== caminho))
    if (ok) await supabase.storage.from('pecas').remove([caminho])
  }

  async function mover(i, dir) {
    const j = i + dir
    if (j < 0 || j >= ordenadas.length) return
    const copia = [...ordenadas]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    await gravar(copia)
  }

  return (
    <div className="peca-midias">
      <style>{`
        .peca-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; margin-bottom: 10px; }
        .peca-item { position: relative; border-radius: 10px; overflow: hidden; border: 1px solid var(--borda, #e1e1e1); background: #0f0a2e; aspect-ratio: 4 / 5; }
        .peca-item img, .peca-item video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .peca-video-tag { position: absolute; left: 6px; top: 6px; background: rgba(4,0,34,0.7); color: #fff; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; padding: 2px 6px; border-radius: 999px; }
        .peca-ferramentas { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 4px; background: linear-gradient(transparent, rgba(4,0,34,0.75)); }
        .peca-ferramentas button { background: rgba(255,255,255,0.92); border: none; border-radius: 6px; width: 24px; height: 24px; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; color: #040022; }
        .peca-ferramentas button:disabled { opacity: .35; cursor: default; }
        .peca-reordenar { display: flex; gap: 3px; }
        .peca-remover { color: #b4423a !important; }
        .peca-ordem { position: absolute; right: 6px; top: 6px; background: rgba(4,0,34,0.7); color: #fff; font-size: 11px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      `}</style>

      {ordenadas.length > 0 && (
        <div className="peca-grade">
          {ordenadas.map((m, i) => (
            <div className="peca-item" key={m.caminho}>
              {m.tipo === 'video'
                ? <><video src={publico(m.caminho)} preload="metadata" muted /><span className="peca-video-tag">Vídeo</span></>
                : <img src={publico(m.caminho)} alt={m.nome || `Arte ${i + 1}`} loading="lazy" />}
              {ordenadas.length > 1 && <span className="peca-ordem">{i + 1}</span>}
              <div className="peca-ferramentas">
                <div className="peca-reordenar">
                  <button type="button" title="Mover para a esquerda" onClick={() => mover(i, -1)} disabled={i === 0}>‹</button>
                  <button type="button" title="Mover para a direita" onClick={() => mover(i, 1)} disabled={i === ordenadas.length - 1}>›</button>
                </div>
                <button type="button" className="peca-remover" title="Remover" onClick={() => remover(m.caminho)}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={entrada}
        type="file"
        hidden
        multiple
        accept="image/*,video/*"
        onChange={enviar}
        disabled={enviando}
      />
      <button
        type="button"
        className="botao botao-secundario botao-pequeno"
        onClick={() => entrada.current?.click()}
        disabled={enviando}
      >
        <Icone nome="anexo" tamanho={15} /> {enviando ? 'Enviando…' : 'Adicionar arte ou vídeo'}
      </button>
      <small className="texto-suave bloco">
        Imagens e vídeos até 50 MB. Em carrossel, a ordem aqui é a ordem que o cliente vê.
      </small>
    </div>
  )
}
